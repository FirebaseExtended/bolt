let rulesParser = require('./rules-parser');
let fs = require('fs');
/*
  Imports file parser for split file systems
  Note: Using a modified ES6 syntax to include imports
*/
export function parseWithImports(filename: string) {
  // creating a stream through which each file will pass
  let contents = fs.readFileSync(filename, "utf8");
  return parserWrapper(contents, filename);
}

/*
  *************************** Function Section ****************************
*/

/* ******** wrapper for recursive parsing ******* */
function parserWrapper(data: string, filename: string) {
  var sym = rulesParser.parse(data);

  // Process any imports in symbol list
  for (let i = 0; i < sym.imports.length; i++) {
    let next = sym.imports[i];
    var nextFilename = getNextFilenameFromContextAndImport(filename, next.filename);
    let contents = fs.readFileSync(nextFilename, 'utf8');
    let nextSymbols = parserWrapper(contents, nextFilename);
    sym.imports[i].symbols = nextSymbols; // add it to the next part of the tree
  }
  return sym;
}; // end function

// Convert absolute filenames to relative
// Convert relative filenames to include original path
function getNextFilenameFromContextAndImport(current: string, nextImport: any) {
  current = current.replace('.bolt', '');
  nextImport = nextImport.replace('.bolt', '');
  var currentFn = current.split('/');
  var nextFn = nextImport.split('/');
  let result = '';
  if (nextFn[0] !== '.' && nextFn[0] !== '..') { // global reference
    result = './node_modules/' + nextImport + '/index.bolt';
  } else {
    // import {./something} -> ['.','something'] -> ''
    // import {./something/anotherthing} -> ['.','something','anotherthing'] -> something
    currentFn.pop(); // remove trailing file name and leave only the directory
    nextFn = currentFn.concat(nextFn);
    // if file.bolt exists then we have it otherwise return
    if (fs.existsSync(nextFn.join('/') + '.bolt')) {
      result = nextFn.join('/') + '.bolt';
    } else {
      result = nextFn.join('/') + '/index.bolt';
    }
  }
  return result;
}
