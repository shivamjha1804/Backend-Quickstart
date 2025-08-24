const fs = require('fs');
const Mustache = require('mustache');

const template = fs.readFileSync('/Users/shivamjha/Documents/NPM_Package/templates/src/shared/middlewares/enterpriseSecurity.ts.mustache', 'utf8');

console.log('=== TypeScript Version (first 20 lines) ===');
const tsResult = Mustache.render(template, { typescript: true });
const tsLines = tsResult.split('\n').slice(0, 20);
tsLines.forEach((line, i) => console.log(`${i + 1}: ${line}`));

console.log('\n=== JavaScript Version (first 20 lines) ===');
const jsResult = Mustache.render(template, { typescript: false });
const jsLines = jsResult.split('\n').slice(0, 20);
jsLines.forEach((line, i) => console.log(`${i + 1}: ${line}`));

console.log('\n=== Template Statistics ===');
console.log(`TypeScript version: ${tsResult.split('\n').length} lines`);
console.log(`JavaScript version: ${jsResult.split('\n').length} lines`);
console.log('Both versions generated successfully!');