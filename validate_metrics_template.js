const fs = require('fs');

const template = fs.readFileSync('/Users/shivamjha/Documents/NPM_Package/templates/src/core/monitoring/metricsCollector.ts.mustache', 'utf8');

console.log('Template length:', template.length);

// Find all unclosed mustache tags
const lines = template.split('\n');
let openTags = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const tagRegex = /\{\{([#^\/]?)([^}]*)\}\}/g;
  let match;
  
  while ((match = tagRegex.exec(line)) !== null) {
    const tagType = match[1];
    const tagName = match[2].trim();
    
    if (tagType === '#' || tagType === '^') {
      openTags.push({ tag: tagName, line: i + 1, pos: match.index });
    } else if (tagType === '/') {
      const openTag = openTags.pop();
      if (!openTag || openTag.tag !== tagName) {
        console.log(`❌ Line ${i + 1}: Mismatched closing tag "${tagName}", expected "${openTag?.tag || 'none'}"`);
      }
    }
  }
}

console.log('\nRemaining open tags:');
openTags.forEach(tag => {
  console.log(`❌ Unclosed tag: "${tag.tag}" at line ${tag.line}`);
});

if (openTags.length === 0) {
  console.log('✅ All tags are properly closed');
} else {
  console.log(`\n❌ Found ${openTags.length} unclosed tags`);
}