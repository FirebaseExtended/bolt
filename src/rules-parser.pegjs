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

  var ast = require('./ast');
  var util = require('./util');

  var errorCount = 0;

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
  symbols.setLoggers({
    error: error,
    warn: warn
  });

  function ensureLowerCase(s, m) {
    if (s instanceof Array) {
      s = s.map(function(id) {
        return ensureLowerCase(id, m);
      });
      return s;
    }
    var canonical = s[0].toLowerCase() + s.slice(1);
    if (s != canonical) {
      warn(m + " should begin with a lowercase letter: ('" + s + "' should be '" + canonical + "').");
    }
    return s;
  }

  function ensureUpperCase(s, m) {
    if (s instanceof Array) {
      s = s.map(function(id) {
        return ensureUpperCase(id, m);
      });
      return s;
    }
    var canonical = s[0].toUpperCase() + s.slice(1);
    if (s != canonical) {
      warn(m + " should begin with an uppercase letter: ('" + s + "' should be '" + canonical + "').");
    }
    return s;
  }

  function error(s) {
    errorCount += 1;
    console.error(errorString({line: line(), column: column()}, s));
  }

  function warn(s) {
    console.warn(errorString({line: line(), column: column()}, s));
  }

  function errorString(loc, s) {
    return 'bolt:' + loc.line + ':' + loc.column + ': ' + s;
  }
}

start = _ Statements _ {
  if (errorCount != 0) {
    throw(new Error("Fatal errors: " + errorCount));
  }
  return symbols;
}

Statements = rules:(Statement _)*

Statement = f:Function { symbols.registerFunction(f.name, f.params, f.body); }
  / p:Path { symbols.registerPath(p.parts, p.isType, p.methods); }
  / s:Schema { symbols.registerSchema(s.name, s.derivedFrom, s.properties, s.methods, s.params); }

Function "function definition" = ("function" __)? name:Identifier params:ParameterList _ body:FunctionBody {
  return {
    name: ensureLowerCase(name, "Function names"),
    params: params,
    body: body
  }
}

Path "path statement" = ("path" __)? path:PathExpression isType:("is" __ id:TypeExpression _ { return id; })?
  methods:("{" _ methods:Methods "}" { return methods; }
           / ";" { return {}; } )? _ {
   var result = {
     parts: path,
     methods: methods || {}
   };
   if (isType) {
     result.isType = isType;
   }
   return result;
 }

PathExpression "path" =  parts:("/" part:Identifier { return part; })+ _ { return parts; }
  / "/" _ { return []; }

Schema "type statement" =
  "type" __ type:Identifier
  params:("<" list:IdentifierList ">" { return ensureUpperCase(list, "Type names"); })?
  ext:(__ "extends" __ type:TypeExpression  _ { return type; })?
  properties:(_ "{" _ properties:Properties? "}" { return properties; }
              / _ ";" { return null; } ) {
    var result = {
      name: ensureUpperCase(type, "Type names"),
      methods: {},
      properties: {}
    };
    if (params) {
      result.params = params;
    }
    if (properties) {
      result.methods = properties.methods;
      result.properties = properties.properties;
    }
    if (ext) {
      result.derivedFrom = ext;
    }
    return result;
}

Properties = head:PropertyDefinition tail:(_ ","? _ part:PropertyDefinition { return part; })* _ ","? _ {
  var result = {
     properties: {},
     methods: {}
  };

  function addPart(part) {
    // TODO: Make sure methods and properties don't shadow each other.
    if ('type' in part) {
      if (result.properties[part.name]) {
        error("Duplicate property name: " + part.name);
      }
      result.properties[part.name] = part.type;
    } else {
      if (result.methods[part.name]) {
        error("Duplicate method name: " + part.name);
      }
      result.methods[part.name] = ast.method(part.params, part.body);
    }
  }

  addPart(head);
  for (var i = 0; i < tail.length; i++) {
    addPart(tail[i]);
  }
  return result;
}

PropertyDefinition = name:Identifier _ ":" _ type:TypeExpression {
      return {
        name:  name,
        type: type
      };
    }
  / Method

Methods = all:(Method)* _ {
  var result = {};
  for (var i = 0; i < all.length; i++) {
    var method = all[i];
    if (method.name in result) {
      error("Duplicate method name: " + method.name);
    }
    result[method.name] = ast.method(method.params, method.body);
  }
  return result;
}

Method "method" = name:Identifier params:ParameterList _ body:FunctionBody {
  return {
    name:  ensureLowerCase(name, "Method names"),
    params: params,
    body:  body
  };
}

FunctionBody = "{" _ ("return" _)? exp:Expression _ ";"? _ "}" _ { return exp; }
  / "=" _ exp:Expression _ ";" _ { return exp; }

ParameterList = "(" list:IdentifierList ")" _ { return ensureLowerCase(list, "Function arguments"); }

IdentifierList =  head:Identifier? tail:(_ "," _ id:Identifier { return id; })*  _ {
  if (!head) {
    return [];
  }
  tail.unshift(head);
  return tail;
}

TypeExpression  = head:SingleType tail:(_ "|" _ type:SingleType { return type; } )* _ {
  if (tail.length == 0) {
    return head;
  }
  tail.unshift(head);
  return ast.unionType(tail);
}

// Type, Type[], or Type<X, ... >
// where Type[] === Map<String, Type>
SingleType = type:Identifier opt:("\[\]" {return {isMap: true}; }
                                  / "<" _ types:TypeList ">" {return {types: types};})? _ {
  type = ensureUpperCase(type, "Type names");
  if (!opt) {
    return ast.typeType(type);
  }
  if (opt.isMap) {
    return ast.genericType('Map', [ast.typeType('String'),
                                   ast.typeType(type)]);
  }
  return ast.genericType(type, opt.types);
}

TypeList = head:TypeExpression tail:(_ "," _ type:TypeExpression { return type; })* _ {
  var result = [head];
  util.extendArray(result, tail);
  return result;
}

// ======================================
// Expressions
// ======================================

PrimaryExpression
  = !Literal name:Identifier _ { return ast.variable(name); }
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
        var exp = typeof accessors[i] == 'string' ? ast.string(accessors[i]) : accessors[i];
        result = ast.reference(result, exp);
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
          result = ast.reference(result, ast.string(part));
        } else if (util.isType(part, 'array')) {
          result = ast.call(result, part);
        } else {
          result = ast.reference(result, part);
        }
      }
      return result;
    }
    / MemberExpression

Arguments = "(" _ args:ArgumentList? _ ")" {
  return args !== null ? args : [];
}

ArgumentList = head:Expression tail:(_ "," _ exp: Expression { return exp; })* {
  tail.unshift(head);
  return tail;
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

RelationalOperator
  = "<="
  / ">="
  / "<"
  / ">"

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

Identifier "identifier" = start:[a-zA-Z_$] rest:[a-zA-Z0-9_]* {
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
