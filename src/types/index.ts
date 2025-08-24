export interface ProjectConfig {
  name: string;
  description: string;
  author: string;
  version: string;
  license: string;
  typescript: boolean;
  database: 'postgresql' | 'mysql' | 'sqlite' | 'mongodb';
  authentication: boolean;
  swagger: boolean;
  testing: boolean;
  docker: boolean;
  redis: boolean;
  websockets: boolean;
  backgroundJobs: boolean;
  cors: boolean;
  rateLimit: boolean;
  monitoring: boolean;
  features: string[];
}

export interface TemplateContext extends ProjectConfig {
  [key: string]: any;
}

export interface GeneratorOptions {
  projectPath: string;
  config: ProjectConfig;
  overwrite?: boolean;
}