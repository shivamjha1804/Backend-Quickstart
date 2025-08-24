const fs = require('fs');

let content = fs.readFileSync('/Users/shivamjha/Documents/NPM_Package/templates/src/core/cluster/clusterManager.ts.mustache', 'utf8');

// Fix all malformed method signatures
const fixes = [
  // Method signatures with return types
  [/\{\{#typescript\}\}(.+?): (.+?) \{\{\{\/typescript\}\}\{\{\^typescript\}\}(.+?) \{\{\{\/typescript\}\}/g, 
   '{{#typescript}}$1: $2{{/typescript}}{{^typescript}}$3{{/typescript}} {'],
  
  // Method signatures without return types
  [/\{\{#typescript\}\}(.+?) \{\{\{\/typescript\}\}\{\{\^typescript\}\}(.+?) \{\{\{\/typescript\}\}/g, 
   '{{#typescript}}$1{{/typescript}}{{^typescript}}$2{{/typescript}} {']
];

fixes.forEach(([regex, replacement]) => {
  content = content.replace(regex, replacement);
});

fs.writeFileSync('/Users/shivamjha/Documents/NPM_Package/templates/src/core/cluster/clusterManager.ts.mustache', content);
console.log('✅ Fixed cluster template');