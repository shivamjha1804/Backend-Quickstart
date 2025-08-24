const fs = require('fs');

const template = fs.readFileSync('/Users/shivamjha/Documents/NPM_Package/templates/src/api/v1/controllers/AuthController.ts.mustache', 'utf8');

console.log('Template length:', template.length);
console.log('Character at position 12678:', template[12678]);
console.log('Characters around position 12678:');
console.log('From 12670 to 12690:', JSON.stringify(template.substring(12670, 12690)));

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
    
    if (position >= 12670 && position <= 12690) {
      console.log(`Tag at position ${position}: ${match[0]} (line ${lineNum})`);
    }
  }
  
  charPos += line.length + 1; // +1 for newline
  lineNum++;
}

console.log('\nRemaining open tags:');
openTags.forEach(tag => {
  console.log(`❌ Unclosed tag: ${tag.tag} at line ${tag.line}`);
});