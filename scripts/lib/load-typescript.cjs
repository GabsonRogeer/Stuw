const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function loadTypeScript(file, dependencies = {}) {
  const filename = path.resolve(file);
  const compiled = new Module(filename);
  compiled.require = (name) => {
    if (name in dependencies) return dependencies[name];
    if (name.startsWith('@/'))
      return loadTypeScript(path.join('src', name.slice(2) + '.ts'), dependencies);
    return require(name);
  };
  compiled._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
  return compiled.exports;
}
module.exports = { loadTypeScript };
