const fs = require('fs');
const path = require('path');

function findMustacheFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      findMustacheFiles(fullPath, files);
    } else if (item.endsWith('.mustache')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function fixTemplateFile(filePath) {
  console.log(`Checking: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // Fix malformed method signatures with return types
  const regex1 = /\{\{#typescript\}\}(.+?): (.+?) \{\{\{\/typescript\}\}\{\{\^typescript\}\}(.+?) \{\{\{\/typescript\}\}/g;
  const newContent1 = content.replace(regex1, '{{#typescript}}$1: $2{{/typescript}}{{^typescript}}$3{{/typescript}} {');
  if (newContent1 !== content) {
    content = newContent1;
    changed = true;
  }
  
  // Fix malformed method signatures without return types
  const regex2 = /\{\{#typescript\}\}(.+?) \{\{\{\/typescript\}\}\{\{\^typescript\}\}(.+?) \{\{\{\/typescript\}\}/g;
  const newContent2 = content.replace(regex2, '{{#typescript}}$1{{/typescript}}{{^typescript}}$2{{/typescript}} {');
  if (newContent2 !== content) {
    content = newContent2;
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed: ${filePath}`);
  }
  
  // Validate template
  try {
    const Mustache = require('mustache');
    Mustache.parse(content);
    console.log(`✅ Valid: ${filePath}`);
  } catch (error) {
    console.log(`❌ Invalid: ${filePath} - ${error.message}`);
    
    // Try to identify problematic tags
    const lines = content.split('\n');
    let openTags = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const tagRegex = /\{\{([#^\/]?)([^}]*)\}\}/g;
      let match;
      
      while ((match = tagRegex.exec(line)) !== null) {
        const tagType = match[1];
        const tagName = match[2].trim();
        
        if (tagType === '#' || tagType === '^') {
          openTags.push({ tag: tagName, line: i + 1 });
        } else if (tagType === '/') {
          const openTag = openTags.pop();
          if (!openTag || openTag.tag !== tagName) {
            console.log(`    ❌ Line ${i + 1}: Closing tag "${tagName}" doesn't match opening tag "${openTag?.tag || 'none'}"`);
          }
        }
      }
    }
    
    if (openTags.length > 0) {
      console.log(`    ❌ Unclosed tags:`);
      openTags.forEach(tag => {
        console.log(`      - "${tag.tag}" at line ${tag.line}`);
      });
    }
  }
  
  return changed;
}

// Find all mustache templates
const templatesDir = path.join(__dirname, 'templates');
const mustacheFiles = findMustacheFiles(templatesDir);

console.log(`Found ${mustacheFiles.length} mustache templates`);
console.log('='.repeat(50));

let totalFixed = 0;
mustacheFiles.forEach(filePath => {
  if (fixTemplateFile(filePath)) {
    totalFixed++;
  }
  console.log('-'.repeat(30));
});

console.log(`Fixed ${totalFixed} templates`);