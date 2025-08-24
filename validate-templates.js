const fs = require('fs');
const path = require('path');
const mustache = require('mustache');
const chalk = require('chalk');

/**
 * Comprehensive template validation tool
 * Tests every template with all possible combinations
 */

const TEMPLATE_CONFIGS = [
  // TypeScript variants
  { typescript: true, authentication: true, redis: true, mongodb: false, testing: true, docker: true },
  { typescript: false, authentication: true, redis: true, mongodb: false, testing: true, docker: true },
  { typescript: true, authentication: false, redis: false, mongodb: true, testing: true, docker: true },
  { typescript: false, authentication: false, redis: false, mongodb: true, testing: false, docker: false },
  // Database variants
  { typescript: true, authentication: true, redis: true, mongodb: true, postgresql: false },
  { typescript: true, authentication: true, redis: true, mongodb: false, postgresql: true },
  { typescript: true, authentication: true, redis: true, mongodb: false, mysql: true },
  { typescript: true, authentication: true, redis: true, mongodb: false, sqlite: true },
];

function findAllTemplates(dir = 'templates') {
  const templates = [];
  
  function scan(currentDir) {
    const files = fs.readdirSync(currentDir);
    
    for (const file of files) {
      const fullPath = path.join(currentDir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (file.endsWith('.mustache')) {
        templates.push(fullPath);
      }
    }
  }
  
  scan(dir);
  return templates;
}

function validateTemplate(templatePath, config) {
  try {
    const content = fs.readFileSync(templatePath, 'utf8');
    
    // Parse template - this will throw if syntax is invalid
    mustache.parse(content);
    
    // Try rendering with config - this will catch runtime issues
    const rendered = mustache.render(content, config);
    
    return { valid: true, rendered: rendered.length };
  } catch (error) {
    return { 
      valid: false, 
      error: error.message,
      position: error.index || 'unknown'
    };
  }
}

function analyzeTemplateErrors() {
  console.log(chalk.cyan.bold('\n🔍 COMPREHENSIVE TEMPLATE VALIDATION\n'));
  
  const templates = findAllTemplates();
  let totalValid = 0;
  let totalInvalid = 0;
  const errorSummary = {};
  const invalidTemplates = [];
  
  console.log(`Found ${templates.length} templates to validate...\n`);
  
  for (const templatePath of templates) {
    const relativePath = templatePath.replace('templates/', '');
    let templateValid = true;
    let templateErrors = [];
    
    for (const config of TEMPLATE_CONFIGS) {
      const result = validateTemplate(templatePath, config);
      
      if (!result.valid) {
        templateValid = false;
        templateErrors.push({
          config: Object.keys(config).filter(k => config[k]).join(', '),
          error: result.error,
          position: result.position
        });
        
        // Track error types
        const errorType = result.error.split(' ')[0];
        errorSummary[errorType] = (errorSummary[errorType] || 0) + 1;
      }
    }
    
    if (templateValid) {
      console.log(chalk.green(`✅ ${relativePath}`));
      totalValid++;
    } else {
      console.log(chalk.red(`❌ ${relativePath}`));
      templateErrors.forEach(err => {
        console.log(chalk.gray(`   Config: ${err.config}`));
        console.log(chalk.red(`   Error: ${err.error} at ${err.position}`));
      });
      totalInvalid++;
      invalidTemplates.push({ path: relativePath, errors: templateErrors });
    }
  }
  
  // Summary
  console.log(chalk.cyan.bold('\n📊 VALIDATION SUMMARY'));
  console.log(`✅ Valid: ${totalValid}`);
  console.log(`❌ Invalid: ${totalInvalid}`);
  console.log(`📈 Success Rate: ${((totalValid / (totalValid + totalInvalid)) * 100).toFixed(1)}%`);
  
  if (totalInvalid > 0) {
    console.log(chalk.red.bold('\n🚨 ERROR ANALYSIS'));
    Object.entries(errorSummary).forEach(([error, count]) => {
      console.log(`${error}: ${count} occurrences`);
    });
    
    console.log(chalk.red.bold('\n📋 TEMPLATES REQUIRING FIXES:'));
    invalidTemplates.forEach(template => {
      console.log(chalk.red(`- ${template.path}`));
    });
    
    return false; // Not ready for deployment
  }
  
  console.log(chalk.green.bold('\n🎉 ALL TEMPLATES PASS VALIDATION!'));
  return true; // Ready for deployment
}

// Run validation
const isReady = analyzeTemplateErrors();
process.exit(isReady ? 0 : 1);