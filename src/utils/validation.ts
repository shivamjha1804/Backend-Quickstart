import * as path from 'path';
import * as fs from 'fs-extra';
import validateNpmName from 'validate-npm-package-name';

export function validateProjectName(name: string): { valid: boolean; problems?: string[] } {
  const validation = validateNpmName(name);
  
  if (validation.validForNewPackages) {
    return { valid: true };
  }
  
  return {
    valid: false,
    problems: [
      ...(validation.errors || []),
      ...(validation.warnings || [])
    ]
  };
}

export function validateProjectPath(projectPath: string): { valid: boolean; error?: string } {
  try {
    const absolutePath = path.resolve(projectPath);
    
    if (fs.existsSync(absolutePath)) {
      const stats = fs.statSync(absolutePath);
      if (stats.isFile()) {
        return {
          valid: false,
          error: 'Path exists and is a file, not a directory'
        };
      }
      
      const files = fs.readdirSync(absolutePath);
      if (files.length > 0) {
        return {
          valid: false,
          error: 'Directory is not empty'
        };
      }
    }
    
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Unable to access path: ${(error as Error).message}`
    };
  }
}

export function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_.]/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .replace(/[-.]{2,}/g, '-');
}