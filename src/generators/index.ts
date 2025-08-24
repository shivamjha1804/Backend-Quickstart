import * as fs from 'fs-extra';
import * as path from 'path';
import Mustache from 'mustache';
import { GeneratorOptions, TemplateContext } from '../types';

export async function generateProject(options: GeneratorOptions): Promise<void> {
  const { projectPath, config, overwrite = false } = options;
  
  if (await fs.pathExists(projectPath)) {
    if (!overwrite) {
      throw new Error(`Directory ${projectPath} already exists. Use --force to overwrite.`);
    }
    await fs.remove(projectPath);
  }
  
  await fs.ensureDir(projectPath);
  
  const templateContext: TemplateContext = {
    ...config,
    currentYear: new Date().getFullYear().toString(),
    kebabCase: config.name.toLowerCase().replace(/\s+/g, '-'),
    camelCase: config.name.replace(/[-\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')),
    pascalCase: config.name.replace(/[-\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^./, c => c.toUpperCase()),
    // Database-specific boolean flags for templates
    postgresql: config.database === 'postgresql',
    mysql: config.database === 'mysql',
    sqlite: config.database === 'sqlite',
    mongodb: config.database === 'mongodb',
  };
  
  const templatesDir = path.join(__dirname, '../../templates');
  await copyTemplate(templatesDir, projectPath, templateContext);
}

async function copyTemplate(
  templatesDir: string, 
  targetDir: string, 
  context: TemplateContext
): Promise<void> {
  const items = await fs.readdir(templatesDir);
  
  for (const item of items) {
    const itemPath = path.join(templatesDir, item);
    const stats = await fs.stat(itemPath);
    
    if (stats.isDirectory()) {
      const targetItemDir = path.join(targetDir, item);
      await fs.ensureDir(targetItemDir);
      await copyTemplate(itemPath, targetItemDir, context);
    } else {
      await processTemplateFile(itemPath, targetDir, context);
    }
  }
}

async function processTemplateFile(
  sourceFile: string, 
  targetDir: string, 
  context: TemplateContext
): Promise<void> {
  const fileName = path.basename(sourceFile);
  let targetFileName = fileName;
  
  // Handle conditional files based on file content, not filename
  // We'll process the content and let Mustache handle conditionals
  
  if (fileName.endsWith('.mustache')) {
    targetFileName = fileName.replace('.mustache', '');
    
    // Handle TypeScript vs JavaScript extensions
    if (context.typescript) {
      targetFileName = targetFileName.replace(/\.js$/, '.ts');
    } else {
      targetFileName = targetFileName.replace(/\.ts$/, '.js');
    }
  }
  
  if (targetFileName.startsWith('_')) {
    targetFileName = targetFileName.replace(/^_/, '.');
  }
  
  const targetFile = path.join(targetDir, targetFileName);
  
  if (fileName.endsWith('.mustache')) {
    try {
      const templateContent = await fs.readFile(sourceFile, 'utf-8');
      const renderedContent = Mustache.render(templateContent, context);
      await fs.writeFile(targetFile, renderedContent);
    } catch (error) {
      console.error(`Error processing template: ${sourceFile}`);
      throw error;
    }
  } else {
    await fs.copy(sourceFile, targetFile);
  }
}