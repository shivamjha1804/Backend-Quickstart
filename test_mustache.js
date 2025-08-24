const fs = require('fs');
const Mustache = require('mustache');

try {
  const template = fs.readFileSync('/Users/shivamjha/Documents/NPM_Package/templates/src/shared/middlewares/enterpriseSecurity.ts.mustache', 'utf8');
  
  // Test with TypeScript context
  console.log('Testing with TypeScript=true...');
  const tsResult = Mustache.render(template, { typescript: true });
  console.log('✓ TypeScript rendering successful');
  
  // Test with JavaScript context
  console.log('Testing with TypeScript=false...');
  const jsResult = Mustache.render(template, { typescript: false });
  console.log('✓ JavaScript rendering successful');
  
  console.log('\nTemplate syntax is valid!');
  
} catch (error) {
  console.error('Mustache template syntax error:', error.message);
  process.exit(1);
}