const fs = require('fs');

const template = fs.readFileSync('/Users/shivamjha/Documents/NPM_Package/templates/src/core/cluster/clusterManager.ts.mustache', 'utf8');

console.log('Template length:', template.length);

// Find all unclosed mustache tags
const lines = template.split('\n');
let charPos = 0;
let openTags = [];
let lineNum = 1;

for (const line of lines) {
  let match;
  const tagRegex = /\{\{([#^\/]?)([^}]*)\}\}/g;
  
  while ((match = tagRegex.exec(line)) !== null) {
    const tagType = match[1];
    const tagName = match[2].trim();
    const position = charPos + match.index;
    
    if (tagType === '#' || tagType === '^') {
      // Opening tag
      openTags.push({ tag: tagName, line: lineNum, pos: position });
    } else if (tagType === '/') {
      // Closing tag
      const openTag = openTags.pop();
      if (!openTag || openTag.tag !== tagName) {
        console.log(`❌ Mismatched closing tag: ${tagName} at line ${lineNum}, expected: ${openTag?.tag || 'none'}`);
      }
    }
  }
  
  charPos += line.length + 1; // +1 for newline
  lineNum++;
}

console.log('\nRemaining open tags:');
openTags.forEach(tag => {
  console.log(`❌ Unclosed tag: ${tag.tag} at line ${tag.line}`);
});

if (openTags.length === 0) {
  console.log('✅ All tags are properly closed');
}