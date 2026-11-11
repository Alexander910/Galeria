'use strict';
const fs = require('node:fs');
const path = require('node:path');

const folder = __dirname;
const read = name => {
    const file = path.join(folder, name);
    if (!fs.existsSync(file)) throw new Error('Falta el archivo traducciones/${name}');
      const lines = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.trim());
    while (lines.length && !lines[lines.length - 1]) lines.pop();
    return lines;
}
const quote = text => JSON.stringify(text);

const problems = [];
function pair(spanishFile, qeqchiFile) {
    const spanish = read(spanishFile);
    const qeqchi = read(qeqchiFile);
    if(spanish.length !== qeqchi.length) {
        throw new Error('${qeqchiFile} tiene ${qeqchi.length} líneas y ${spanishFile} tiene ${spanish.length}. Deben tener las mismas, en el mismo orden.');
    }
    return spanish.map((key, index) => {
        const value = qeqchi[index];
        const expected = (key.match(/\{\w+\}/g) || []).sort().join(' ');
        const found = (value.match(/\{\w+\}/g) || []).sort().join(' ');
        if (expected !== found) problems.push(`Línea ${index + 1}: se esperaba "${expected}" y llego "${found || 'nada'}" → ${value}`);
        if (!value) problems.push(`Línea ${index + 1} de ${qeqchiFile}: está vacia`);
        return [key, value];
    });
}

const phrases = [...pair('frases-es-1.txt', 'frases-kek-1.txt'), ...pair('frases-es-2.txt', 'frases-kek-2.txt')];
const labels = fs.existsSync(path.join(folder, 'etiquetas-kek.txt')) ? pair('etiquetas-es.txt', 'etiquetas-kek.txt') : [];
const output = [
  '    kek: {',
  "      // Traducción automática de Google Translate (español → Q'eqchi'), pendiente de revisión por hablantes.",
  ...phrases.map(([key, value]) => `      ${quote(key)}: ${quote(value)},`),
  '    },',
  '',
  '  const qeqchiLabels = {',
  ...labels.map(([key, value]) => `    ${quote(key.toLowerCase())}: ${quote(value)},`),
  '  };',
  '',
].join('\n');

fs.writeFileSync(path.join(folder, 'salida-kek.txt'), output, 'utf8');
console.log(`Listo: ${phrases.length} frases y ${labels.length} etiquetas en traducciones/salida-kek.txt`);
if (problems.length) {
  console.log(`\nRevisa estas ${problems.length} líneas antes de pegar:`);
  for (const problem of problems) console.log('  - ' + problem);
  process.exitCode = 1;
}