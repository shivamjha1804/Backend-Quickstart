const fs = require('fs');
const Mustache = require('mustache');

// Test template with minimal context
const template = fs.readFileSync('/Users/shivamjha/Documents/NPM_Package/templates/src/api/v1/controllers/AuthController.ts.mustache', 'utf8');

const context = {
  authentication: true,
  typescript: true,
  mongodb: false
};

try {
  const result = Mustache.render(template, context);
  console.log('✅ Template renders successfully');
  console.log('Length:', result.length);
} catch (error) {
  console.error('❌ Template error:', error.message);
  console.error('Error details:', error);
}