const fs = require('fs');
const Mustache = require('mustache');

const template = fs.readFileSync('/Users/shivamjha/Documents/NPM_Package/templates/src/shared/middlewares/enterpriseSecurity.ts.mustache', 'utf8');

console.log('Template length:', template.length);
console.log('Error at position:', 11838);
console.log('Characters around error position:');
console.log(template.substring(11830, 11838));
console.log('---END---');

// Try to parse the template to see detailed error
try {
  Mustache.parse(template);
} catch (error) {
  console.error('Parse error:', error.message);
}