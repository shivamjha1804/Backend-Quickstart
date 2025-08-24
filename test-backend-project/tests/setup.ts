import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { Application } from 'express';
import { config } from '../src/config';
import { dbConnectionManager } from '../src/core/database/connectionManager';
import Redis from 'ioredis';
import { logger } from '../src/core/utils/logger';


/**
 * Global test setup and utilities for enterprise testing
 * Provides database management, fixtures, mocking, and test isolation
 */

// Test database configuration
const TEST_DB_CONFIG = {
  host: process.env.TEST_DB_HOST || config.database.host,
  port: parseInt(process.env.TEST_DB_PORT) || config.database.port,
  database: `${config.database.name}_test`,
  username: process.env.TEST_DB_USER || config.database.username,
  password: process.env.TEST_DB_PASSWORD || config.database.password,
  dialect: config.database.dialect
  
};

// Test Redis configuration
const TEST_REDIS_CONFIG = {
  host: process.env.TEST_REDIS_HOST || 'localhost',
  port: parseInt(process.env.TEST_REDIS_PORT) || 6379,
  db: 15 // Use dedicated test database
};

let testApp: Application;
let testRedis: Redis;

/**
 * Global setup - runs once before all tests
 */
beforeAll(async () => {
  try {
    // Set test environment
    process.env.NODE_ENV = 'test';
    
    // Suppress logs during testing unless explicitly enabled
    if (!process.env.TEST_LOGS) {
      logger.silent = true;
    }

    // Initialize test database
    await initializeTestDatabase();
    
    // Initialize test Redis
    await initializeTestRedis();

    // Initialize test application
    testApp = await initializeTestApp();

    logger.info('Test environment initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize test environment', error);
    throw error;
  }
}, 30000); // 30 second timeout

/**
 * Global teardown - runs once after all tests
 */
afterAll(async () => {
  try {
    // Clean up database connections
    await dbConnectionManager.shutdown();
    
    // Clean up Redis connections
    if (testRedis) {
      await testRedis.disconnect();
    }

    logger.info('Test environment cleaned up successfully');
  } catch (error) {
    logger.error('Failed to clean up test environment', error);
  }
}, 10000);

/**
 * Setup before each test - runs before every test
 */
beforeEach(async () => {
  // Clear all data before each test for isolation
  await clearTestData();
  
  // Clear Redis cache
  if (testRedis) {
    await testRedis.flushdb();
  }
});

/**
 * Cleanup after each test - runs after every test
 */
afterEach(async () => {
  // Optional cleanup - data is cleared in beforeEach
  // This can be used for additional cleanup if needed
});

/**
 * Initialize test database
 */
async function initializeTestDatabase() {
  try {
    // Override database configuration for testing
    config.database = { ...config.database, ...TEST_DB_CONFIG };
    
    

    // Initialize database connection manager
    await dbConnectionManager.initialize();
    
    // Run migrations for SQL databases
    await runTestMigrations();
    
    logger.info('Test database initialized');
  } catch (error) {
    logger.error('Failed to initialize test database', error);
    throw error;
  }
}

/**
 * Run database migrations for tests
 */
async function runTestMigrations() {
  try {
    const { sequelize } = require('../src/core/database/connection');
    
    // Sync database schema
    await sequelize.sync({ force: true });
    
    logger.info('Test database migrations completed');
  } catch (error) {
    logger.error('Test database migration failed', error);
    throw error;
  }
}

/**
 * Initialize test Redis
 */
async function initializeTestRedis() {
  try {
    testRedis = new Redis(TEST_REDIS_CONFIG);
    
    // Test connection
    await testRedis.ping();
    
    logger.info('Test Redis initialized');
  } catch (error) {
    logger.error('Failed to initialize test Redis', error);
    throw error;
  }
}

/**
 * Initialize test application
 */
async function initializeTestApp(): Promise<Application> {

  try {
    // Import app after environment setup
    const { app } = require('../src/app');
    return app;
  } catch (error) {
    logger.error('Failed to initialize test app', error);
    throw error;
  }
}

/**
 * Clear all test data for isolation
 */
async function clearTestData() {
  try {
    const { sequelize } = require('../src/core/database/connection');
    
    // Get all model names
    const modelNames = Object.keys(sequelize.models);
    
    // Truncate all tables in reverse order to handle foreign keys
    for (const modelName of modelNames.reverse()) {
      const model = sequelize.models[modelName];
      await model.destroy({ 
        where: {}, 
        force: true,
        cascade: true 
      });
    }
    
    
    
  } catch (error) {
    logger.error('Failed to clear test data', error);
    // Don't throw here to avoid breaking test flow
  }
}

/**
 * Test utilities and helpers
 */
export const TestUtils = {

  /**
   * Get test application instance
   */
  getApp(): Application {
    if (!testApp) {
      throw new Error('Test app not initialized. Make sure to call this within a test.');
    }
    return testApp;
  },

  /**
   * Get test Redis instance
   */
  getRedis(): Redis {
    if (!testRedis) {
      throw new Error('Test Redis not initialized.');
    }
    return testRedis;
  },

  /**
   * Wait for a specified amount of time
   */
  async wait(ms: number = 100): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Generate random test data
   */
  generateRandomString(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  generateRandomEmail(): string {
    return `test${this.generateRandomString(8)}@example.com`;
  },

  generateRandomUser(): object {
    return {
      email: this.generateRandomEmail(),
      password: 'TestPassword123!',
      firstName: `Test${this.generateRandomString(5)}`,
      lastName: `User${this.generateRandomString(5)}`
    };
  },

  /**
   * Create authenticated test user and return token
   */
  async createAuthenticatedUser(userData?: any): Promise<{ user: any; token: string }> {
    const { User } = require('../src/core/database/models/User');
    
    const { tokenManager } = require('../src/core/auth/TokenManager');

    const userPayload = userData || this.generateRandomUser();
    const user = await User.create(userPayload);
    const token = await tokenManager.generateAccessToken(user);

    return { user, token };
  },

  /**
   * Make authenticated request helper
   */
  getAuthHeaders(token: string): { Authorization: string } {
    return {
      Authorization: `Bearer ${token}`
    };
  },

  /**
   * Database seeding utilities
   */
  async seedDatabase(fixtures: any) {
    const seededData: any = {};

    for (const [modelName, data] of Object.entries(fixtures)) {
      const model = require(`../src/core/database/models/${modelName}`)[modelName];
      
      
      if (Array.isArray(data)) {
        seededData[modelName] = await model.bulkCreate(data);
      } else {
        seededData[modelName] = await model.create(data);
      }
    }

    return seededData;
  },

  /**
   * Mock external services
   */
  mockExternalService(serviceName: string, mockImplementation: any) {
    jest.mock(serviceName, () => mockImplementation);
  },

  /**
   * Assert error response format
   */
  assertErrorResponse(response: any, expectedStatusCode: number, expectedMessage?: string) {
    expect(response.status).toBe(expectedStatusCode);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toHaveProperty('statusCode', expectedStatusCode);
    
    if (expectedMessage) {
      expect(response.body.error.message).toContain(expectedMessage);
    }
  },

  /**
   * Assert success response format
   */
  assertSuccessResponse(response: any, expectedStatusCode: number = 200) {
    expect(response.status).toBe(expectedStatusCode);
    expect(response.body).toHaveProperty('success', true);
  },

  /**
   * Test pagination response
   */
  assertPaginationResponse(response: any, expectedPage: number, expectedLimit: number) {
    expect(response.body).toHaveProperty('pagination');
    expect(response.body.pagination).toHaveProperty('page', expectedPage);
    expect(response.body.pagination).toHaveProperty('limit', expectedLimit);
    expect(response.body.pagination).toHaveProperty('total');
    expect(response.body.pagination).toHaveProperty('totalPages');
  },

  /**
   * Performance testing utilities
   */
  async measureExecutionTime(fn: () => Promise<any>): Promise<{ result: any; executionTime: number }> {
    const startTime = performance.now();
    const result = await fn();
    const executionTime = performance.now() - startTime;
    
    return { result, executionTime };
  },

  /**
   * Load testing helper
   */
  async runConcurrentRequests(requestFn: () => Promise<any>, concurrency: number = 10): Promise<any[]> {
    const requests = Array(concurrency).fill(null).map(() => requestFn());
    return Promise.all(requests);
  }
};

