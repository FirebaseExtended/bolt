/*
 * Firebase Bolt - Security Rules Language
 *
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

{
  "use strict";
  var ast = namespace.firebase.rules.ast;

  // Return a left-associative binary structure
  // consisting of head (exp), and tail (op, exp)*.
  function leftAssociative(head, tail) {
    var result = head;
    for (var i = 0; i < tail.length; i++) {
      result = ast.op(tail[i].op, [result, tail[i].exp]);
    }
    return result;
  }

  var symbols = new ast.Symbols();
}

start = _ rules:Rules _ {
  return symbols;
}

Rules = rules:(Rule _)*

Rule = f:Function { symbols.registerFunction(f.name, f.params, f.body); }
     / p:Path { symbols.registerPath(p.parts, p.methods); }
     / s:Schema { symbols.registerSchema(s.name, s.derivedFrom, s.properties, s.methods); }

Function = "function" __ name:Identifier params:ParameterList "{" _
  body:FunctionBody _
  "}" {
  return {
    name: name,
    params: params,
    body: body
  };
}

Path = "path" __ path:PathExpression _ "{" _ methods:Methods _ "}" {
  return {
    parts: path,
    methods: methods
  };
}

PathExpression = "/" Whitespace {
    return [];
  }
  / parts:("/" part:Identifier {
    return part;
  })+ {
    return parts;
  }

Schema =
  "type" __ id:Identifier _ derived:("extends" __ Identifier _)? "{" _
  properties:Properties?
  "}" {
    var result = {
      name: id,
      methods: {},
      properties: {}
    };
    if (properties) {
      result.methods = properties.methods;
      result.properties = properties.properties;
    }
    if (derived) {
      result.derivedFrom = derived[2];
    }
    return result;
}

Properties = head:PropertyDefinition tail:(_ ","? _ part:PropertyDefinition { return part; })* _ ","? _ {
  var result = {
     properties: {},
     methods: {}
  };

  function addPart(part) {
    if ('types' in part) {
      if (result.properties[part.name]) {
        error("Duplicate propert name: " + part.name);
      }
      result.properties[part.name] = {
        types: part.types
      };
    } else {
      if (result.methods[part.name]) {
        error("Duplicate method name: " + part.name);
      }
      result.methods[part.name] = {
        params: part.params,
        body: part.body
      };
    }
  }

  addPart(head);
  for (var i = 0; i < tail.length; i++) {
    addPart(tail[i]);
  }
  return result;
}

PropertyDefinition
  = name:Identifier _ ":" _ types:TypeExpression {
      return {
        name:  name,
        types: types
      };
    }
  / Method

Methods = all:(Method _)* {
  var result = {};
  for (var i = 0; i < all.length; i++) {
    var method = all[i][0];
    if (method.name in result) {
      error("Duplicate method name: " + method.name);
    }
    result[method.name] = {
      params: method.params,
      body: method.body
    };
  }
  return result;
}

Method = name:Identifier params:ParameterList
    "{" _ body:FunctionBody _ "}" {
      return {
        name:  name,
        params: params,
        body:  body
      };
}

FunctionBody = "return" _ exp:Expression _ ";" {
  return exp;
}

ParameterList = "(" _ ")" _ {
    return [];
  }
  / "(" _ head:Identifier tail:(_ "," _ Identifier)* _ ")" _ {
    var result = [head];
    for (var i = 0; i < tail.length; i++) {
      result.push(tail[i][3]);
    }
    return result;
}

// TODO: Allow for union types, e.g., Type1 | Type2
// TODO: Allow for generic types, e.g., Type<A, B>
TypeExpression "type" =
  head:Identifier tail:(_ "|" _ id:Identifier { return id; } )* _{
    var result = [head];
    for (var i = 0; i < tail.length; i++) {
      result.push(tail[i]);
    }
    return result;
  }


// ======================================
// Expressions
// ======================================

PrimaryExpression
  = !Literal name:Identifier { return ast.variable(name); }
  / Literal
  / "(" _ expression:Expression _ ")" { return expression; }

MemberExpression
  = base:(
        PrimaryExpression
    )
    accessors:(
        _ "[" _ name:Expression _ "]" { return name; }
      / _ "." _ name:Identifier    { return name; }
    )* {
      var result = base;
      for (var i = 0; i < accessors.length; i++) {
        result = ast.reference(result, accessors[i]);
      }
      return result;
    }

// PEG's don't support left-recursion - so this is more complicated than the base case.
CallExpression
  = base:(
      ref:MemberExpression args:Arguments {
        return ast.call(ref, args);
      }
    )
    argumentsOrAccessors:(
      _ args:Arguments { return args }
      / _ "[" _ name:Expression _ "]" { return name }
      / _ "." _ name:Identifier { return name }
    )* {
      var result = base;
      for (var i = 0; i < argumentsOrAccessors.length; i++) {
        var part = argumentsOrAccessors[i];
        if (typeof part == 'string') {
          result = ast.reference(result, part);
        } else {
          result = ast.call(result, part);
        }
      }
      return result;
    }
    / MemberExpression

Arguments = "(" _ args:ArgumentList? _ ")" {
  return args !== null ? args : [];
}

ArgumentList = head:Expression tail:(_ "," _ Expression)* {
  var result = [head];
  for (var i = 0; i < tail.length; i++) {
    result.push(tail[i][3]);
  }
  return result;
}

UnaryExpression
  = CallExpression
  / op:UnaryOperator expression:UnaryExpression {
      if (op == "noop") {
        return expression;
      }
      return ast.op(op, [expression]);
    }

UnaryOperator  = ("+" { return "noop"; })
               / ("-" { return "neg"; })
               /  "!"

// TODO: Collapse Multiplicative, Additive, Relational, Equality, LogicalAnd and LogicalOr
// expressions into a single rule - using operator precedence to derive the correct
// binary tree shape based on binding powers and associativity (left and right hand
// binding powers different).
MultiplicativeExpression
  = head:UnaryExpression
    tail:(_ op:MultiplicativeOperator _ exp:UnaryExpression { return {op: op, exp: exp}; })* {
      return leftAssociative(head, tail);
    }

MultiplicativeOperator = "*"
                       / "/"
                       / "%"

AdditiveExpression
  = head:MultiplicativeExpression
    tail:(_ op:AdditiveOperator _ exp:MultiplicativeExpression { return {op: op, exp: exp}; })* {
      return leftAssociative(head, tail);
    }

AdditiveOperator = "+" / "-"

// Kind of strange to allow "a < b < c" -> (a < b) < c - most likely an error
RelationalExpression
  = head:AdditiveExpression
    tail:(_ op:RelationalOperator _ exp:AdditiveExpression { return {op: op, exp: exp}; })* {
      return leftAssociative(head, tail);
    }

// TODO: instanceof should require a TypeExpression on right
RelationalOperator
  = "<="
  / ">="
  / "<"
  / ">"
  / "instanceof"

EqualityExpression
  = head:RelationalExpression
    tail:(_ op:EqualityOperator _ exp:RelationalExpression { return {op: op, exp: exp}; })* {
      return leftAssociative(head, tail);
    }

EqualityOperator = ("===" / "==") { return "=="; }
                 / ("!==" / "!=") { return "!="; }

LogicalANDExpression
  = head:EqualityExpression
    tail:(_ op:LogicalANDOperator _ exp:EqualityExpression { return {op: op, exp: exp}; })* {
      return leftAssociative(head, tail);
    }

LogicalANDOperator = ("&&" / "and") { return "&&"; }

LogicalORExpression
  = head:LogicalANDExpression
    tail:(_ op:LogicalOROperator _ exp:LogicalANDExpression { return {op: op, exp: exp}; })* {
      return leftAssociative(head, tail);
    }

LogicalOROperator = ("||" / "or") { return "||"; }

ConditionalExpression
  = condition:LogicalORExpression _
    "?" _ trueExpression:Expression _
    ":" _ falseExpression:Expression {
      return ast.op('?:', [condition, trueExpression, falseExpression]);
    }
  / LogicalORExpression
Expression = ConditionalExpression


// ===================================
// Literals
// ===================================

Literal
  = "null" { return ast.nullType() }
  / value:BooleanLiteral { return ast.boolean(value); }
  / value:NumericLiteral { return ast.number(value); }
  / value:StringLiteral { return ast.string(value); }
  / elements:ArrayLiteral { return ast.array(elements); }

ArrayLiteral = "[" _ elements:ArgumentList? _ "]" { return elements; }

BooleanLiteral
  = "true"  { return true; }
  / "false" { return false; }

NumericLiteral "number"
  = unary:([+-])? literal:(HexIntegerLiteral / DecimalLiteral) {
      if (unary == '-') {
         return -literal;
      }
      return literal;
    }

DecimalLiteral
  = parts:$(DecimalIntegerLiteral "." DecimalDigits? ExponentPart?) {
      return parseFloat(parts);
    }
  / parts:$("." DecimalDigits ExponentPart?)     { return parseFloat(parts); }
  / parts:$(DecimalIntegerLiteral ExponentPart?) { return parseFloat(parts); }

DecimalIntegerLiteral
  = "0" / NonZeroDigit DecimalDigits?

DecimalDigits = DecimalDigit+

DecimalDigit = [0-9]

NonZeroDigit = [1-9]

ExponentPart = ExponentIndicator SignedInteger

ExponentIndicator = [eE]

SignedInteger = [-+]? DecimalDigits

HexIntegerLiteral = "0" [xX] digits:$HexDigit+ { return parseInt(digits, 16); }

HexDigit = [0-9a-fA-F]

StringLiteral "string"
  = parts:('"' DoubleStringCharacters? '"' / "'" SingleStringCharacters? "'") {
      return parts[1];
    }

DoubleStringCharacters
  = chars:DoubleStringCharacter+ { return chars.join(""); }

SingleStringCharacters
  = chars:SingleStringCharacter+ { return chars.join(""); }

DoubleStringCharacter
  = !('"' / "\\" / NewLine) char_:. { return char_;     }
  / "\\" sequence:EscapeSequence                         { return sequence;  }
  / LineContinuation

SingleStringCharacter
  = !("'" / "\\" / NewLine) char_:. { return char_;     }
  / "\\" sequence:EscapeSequence                         { return sequence;  }
  / LineContinuation

LineContinuation
  = "\\" sequence:NewLine { return sequence; }

EscapeSequence
  = CharacterEscapeSequence
  / "0" !DecimalDigit { return "\0"; }
  / HexEscapeSequence
  / UnicodeEscapeSequence

CharacterEscapeSequence
  = SingleEscapeCharacter
  / NonEscapeCharacter

SingleEscapeCharacter
  = char_:['"\\bfnrt] {
      return char_
        .replace("b", "\b")
        .replace("f", "\f")
        .replace("n", "\n")
        .replace("r", "\r")
        .replace("t", "\t")
    }

NonEscapeCharacter
  = (!EscapeCharacter / NewLine) char_:. { return char_; }

EscapeCharacter
  = SingleEscapeCharacter
  / DecimalDigit
  / "x"
  / "u"

HexEscapeSequence
  = "x" digits:$(HexDigit HexDigit) {
      return String.fromCharCode(parseInt(digits, 16));
    }

UnicodeEscapeSequence
  = "u" digits:$(HexDigit HexDigit HexDigit HexDigit) {
      return String.fromCharCode(parseInt(digits, 16));
    }

Identifier "identifier" = start:[a-zA-Z_$] rest:[a-zA-Z0-9_]* _ {
  return start + rest.join("");
}

// Require some whitespace
__ = (Whitespace / Comment)+

// Optional whitespace
_ = (Whitespace / Comment)*

Whitespace = [ \t\r\n]+

Comment "comment"
  = MultiLineComment
  / SingleLineComment

MultiLineComment
  = "/*" (!"*/" .)* "*/"

SingleLineComment
  = "//" (!NewLine .)*;


NewLine = [\n\r]
