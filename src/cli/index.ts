#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as path from 'path';
import * as fs from 'fs-extra';
import { collectProjectInfo, confirmGeneration } from './prompts';
import { validateProjectPath } from '../utils/validation';
import { generateProject } from '../generators';

const program = new Command();

program
  .name('create-backend-quickstart')
  .description('Generate a production-ready backend API with Express.js, TypeScript, and more')
  .version('1.0.0')
  .argument('[project-name]', 'Name of the project')
  .option('-d, --dir <directory>', 'Target directory (default: ./project-name)')
  .option('-f, --force', 'Overwrite target directory if it exists')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action(async (projectName, options) => {
    try {
      console.log(chalk.cyan.bold('Backend Quickstart Generator v1.0.0'));
      
      let config;
      if (options.yes && projectName) {
        config = {
          name: projectName,
          description: 'A production-ready backend API',
          author: '',
          version: '1.0.0',
          license: 'MIT',
          typescript: true,
          database: 'postgresql' as const,
          authentication: true,
          swagger: true,
          testing: true,
          docker: true,
          redis: true,
          websockets: false,
          backgroundJobs: true,
          cors: true,
          rateLimit: true,
          monitoring: true,
          features: ['authentication', 'swagger', 'testing', 'docker', 'redis', 'backgroundJobs', 'cors', 'rateLimit', 'monitoring']
        };
      } else {
        config = await collectProjectInfo(projectName);
      }
      
      const targetDir = options.dir || config.name;
      const projectPath = path.resolve(targetDir);
      
      if (!options.force) {
        const pathValidation = validateProjectPath(projectPath);
        if (!pathValidation.valid) {
          console.error(chalk.red(`Error: ${pathValidation.error}`));
          process.exit(1);
        }
      }
      
      if (!options.yes) {
        const shouldProceed = await confirmGeneration(config);
        if (!shouldProceed) {
          console.log(chalk.yellow('Project generation cancelled.'));
          process.exit(0);
        }
      }
      
      const spinner = ora('Generating project...').start();
      
      try {
        await generateProject({
          projectPath,
          config,
          overwrite: options.force
        });
        
        spinner.succeed(chalk.green('Project generated successfully!'));
        
        console.log(chalk.cyan.bold('\n🎉 Your backend project is ready!\n'));
        console.log(chalk.white('Next steps:'));
        console.log(chalk.gray(`  cd ${path.basename(projectPath)}`));
        console.log(chalk.gray('  npm install'));
        console.log(chalk.gray('  cp .env.example .env'));
        console.log(chalk.gray('  # Update .env with your database credentials'));
        console.log(chalk.gray('  npm run migrate'));
        console.log(chalk.gray('  npm run dev'));
        
        console.log(chalk.cyan.bold('\n📚 Documentation:'));
        console.log(chalk.gray('  • README.md - Getting started guide'));
        console.log(chalk.gray('  • docs/API.md - API documentation'));
        console.log(chalk.gray('  • http://localhost:3000/docs - Swagger UI (when running)'));
        
      } catch (error) {
        spinner.fail(chalk.red('Project generation failed'));
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
      
    } catch (error) {
      console.error(chalk.red('An unexpected error occurred:'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

program.parse();