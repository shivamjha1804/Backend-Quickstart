import inquirer from 'inquirer';
import { ProjectConfig } from '../types';
import { validateProjectName, sanitizeProjectName } from '../utils/validation';
import chalk from 'chalk';

export async function collectProjectInfo(projectName?: string): Promise<ProjectConfig> {
  console.log(chalk.cyan.bold('\n🚀 Welcome to Backend Quickstart Generator!\n'));
  console.log(chalk.gray('Let\'s set up your production-ready backend project.\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: projectName || 'my-backend-api',
      validate: (input: string) => {
        const validation = validateProjectName(input);
        if (!validation.valid) {
          return `Invalid project name: ${validation.problems?.join(', ')}`;
        }
        return true;
      },
      filter: sanitizeProjectName
    },
    {
      type: 'input',
      name: 'description',
      message: 'Project description:',
      default: 'A production-ready backend API'
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author name:',
      default: ''
    },
    {
      type: 'list',
      name: 'license',
      message: 'License:',
      choices: ['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'Unlicense'],
      default: 'MIT'
    },
    {
      type: 'confirm',
      name: 'typescript',
      message: 'Use TypeScript?',
      default: true
    },
    {
      type: 'list',
      name: 'database',
      message: 'Choose database:',
      choices: [
        { name: 'PostgreSQL (SQL - Recommended)', value: 'postgresql' },
        { name: 'MongoDB (NoSQL - Popular)', value: 'mongodb' },
        { name: 'MySQL (SQL)', value: 'mysql' },
        { name: 'SQLite (Development only)', value: 'sqlite' }
      ],
      default: 'postgresql'
    },
    {
      type: 'confirm',
      name: 'authentication',
      message: 'Include JWT authentication system?',
      default: true
    },
    {
      type: 'confirm',
      name: 'swagger',
      message: 'Include Swagger/OpenAPI documentation?',
      default: true
    },
    {
      type: 'confirm',
      name: 'testing',
      message: 'Include testing setup (Jest + Supertest)?',
      default: true
    },
    {
      type: 'confirm',
      name: 'docker',
      message: 'Include Docker configuration?',
      default: true
    },
    {
      type: 'confirm',
      name: 'redis',
      message: 'Include Redis for caching and sessions?',
      default: true
    },
    {
      type: 'confirm',
      name: 'websockets',
      message: 'Include WebSocket support (Socket.io)?',
      default: false
    },
    {
      type: 'confirm',
      name: 'backgroundJobs',
      message: 'Include background job processing (Bull)?',
      default: true
    },
    {
      type: 'confirm',
      name: 'cors',
      message: 'Include CORS middleware?',
      default: true
    },
    {
      type: 'confirm',
      name: 'rateLimit',
      message: 'Include rate limiting?',
      default: true
    },
    {
      type: 'confirm',
      name: 'monitoring',
      message: 'Include monitoring and health checks?',
      default: true
    }
  ]);

  const features: string[] = [];
  if (answers.authentication) features.push('authentication');
  if (answers.swagger) features.push('swagger');
  if (answers.testing) features.push('testing');
  if (answers.docker) features.push('docker');
  if (answers.redis) features.push('redis');
  if (answers.websockets) features.push('websockets');
  if (answers.backgroundJobs) features.push('backgroundJobs');
  if (answers.cors) features.push('cors');
  if (answers.rateLimit) features.push('rateLimit');
  if (answers.monitoring) features.push('monitoring');

  return {
    ...answers,
    version: '1.0.0',
    features
  } as ProjectConfig;
}

export async function confirmGeneration(config: ProjectConfig): Promise<boolean> {
  console.log(chalk.cyan.bold('\n📋 Project Configuration Summary:\n'));
  
  const summary = [
    `Project: ${chalk.yellow(config.name)}`,
    `Description: ${config.description}`,
    `Author: ${config.author || 'Not specified'}`,
    `License: ${config.license}`,
    `TypeScript: ${config.typescript ? chalk.green('Yes') : chalk.red('No')}`,
    `Database: ${chalk.yellow(config.database.toUpperCase())}`,
    `Features: ${config.features.length > 0 ? config.features.map(f => chalk.green(f)).join(', ') : 'None'}`
  ];
  
  summary.forEach(line => console.log(`  ${line}`));
  
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: '\nProceed with project generation?',
      default: true
    }
  ]);
  
  return confirm;
}