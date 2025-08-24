const fs = require('fs');

const template = fs.readFileSync('/Users/shivamjha/Documents/NPM_Package/templates/src/shared/middlewares/enterpriseSecurity.ts.mustache', 'utf8');

// Find all Mustache tags with their positions
const tagPattern = /(\{\{[#^/]typescript\}\})/g;
let match;
const tags = [];
let stack = [];

while ((match = tagPattern.exec(template)) !== null) {
  const tag = match[1];
  const position = match.index;
  const lineNum = template.substring(0, position).split('\n').length;
  
  tags.push({
    tag: tag,
    position: position,
    line: lineNum
  });
  
  if (tag === '{{#typescript}}' || tag === '{{^typescript}}') {
    stack.push({ tag, line: lineNum, position });
  } else if (tag === '{{/typescript}}') {
    if (stack.length === 0) {
      console.log(`Error: Closing tag without opening at line ${lineNum}`);
    } else {
      const opened = stack.pop();
      console.log(`Matched: ${opened.tag} (line ${opened.line}) -> ${tag} (line ${lineNum})`);
    }
  }
}

if (stack.length > 0) {
  console.log('\nUnclosed tags:');
  stack.forEach(tag => {
    console.log(`${tag.tag} at line ${tag.line} (position ${tag.position})`);
  });
} else {
  console.log('\nAll tags appear to be balanced');
}

console.log(`\nTotal tags found: ${tags.length}`);
console.log(`Final stack depth: ${stack.length}`);