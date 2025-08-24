import { Sequelize, ConnectionError, TimeoutError } from 'sequelize';

import { config } from '../../config';
import { logger } from '../utils/logger';

/**
 * Enterprise-grade database connection manager with advanced pooling,
 * failover, health monitoring, and connection recovery
 */

interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  lastHealthCheck: Date;
  isHealthy: boolean;
  errors: string[];
}

interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  dialect: string;
  pool: {
    max: number;
    min: number;
    acquire: number;
    idle: number;
    evict: number;
    handleDisconnects: boolean;
  };
  retry: {
    max: number;
    timeout: number;
    match: string[];
  };
  logging: boolean | Function;
  benchmark: boolean;
  isolationLevel: string;
  ssl: boolean | object;
  dialectOptions: {
    ssl?: object;
    connectTimeout?: number;
    acquireTimeout?: number;
    timeout?: number;
    requestTimeout?: number;
  };
}

export class DatabaseConnectionManager {
  private sequelize: Sequelize | null = null;
  
  private connectionStats: ConnectionStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingConnections: 0,
    lastHealthCheck: new Date(),
    isHealthy: false,
    errors: []
  };

  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private isConnecting = false;

  /**
   * Initialize database connection with enterprise configurations
   */
  async initialize(): Promise<void> {
    try {
      this.isConnecting = true;
      
      await this.initializeSequelize();
      
      
      await this.performHealthCheck();
      this.startHealthCheckInterval();
      this.setupConnectionEventHandlers();
      
      this.isConnecting = false;
      logger.info('Database connection manager initialized successfully');
    } catch (error) {
      this.isConnecting = false;
      logger.error('Failed to initialize database connection manager', error);
      throw error;
    }
  }

  /**
   * Initialize Sequelize with enterprise pooling and failover
   */
  private async initializeSequelize(): Promise<void> {
    const dbConfig: ConnectionConfig = {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      username: config.database.username,
      password: config.database.password,
      dialect: config.database.dialect,
      
      // Enterprise connection pooling
      pool: {
        max: config.database.pool?.max || 20,
        min: config.database.pool?.min || 5,
        acquire: config.database.pool?.acquire || 60000,
        idle: config.database.pool?.idle || 10000,
        evict: config.database.pool?.evict || 1000,
        handleDisconnects: true
      },
      
      // Advanced retry configuration
      retry: {
        max: 5,
        timeout: 60000,
        match: [
          ConnectionError,
          TimeoutError,
          /ETIMEDOUT/,
          /EHOSTUNREACH/,
          /ECONNRESET/,
          /ECONNREFUSED/,
          /timeout/,
          /SequelizeConnectionError/,
          /SequelizeConnectionRefusedError/,
          /SequelizeHostNotFoundError/,
          /SequelizeHostNotReachableError/,
          /SequelizeInvalidConnectionError/,
          /SequelizeConnectionTimedOutError/,
        ]
      },
      
      // Logging and benchmarking
      logging: config.server.env === 'development' 
        ? (sql: string, timing?: number) => {
            logger.debug('Database Query', { sql, timing });
          }
        : false,
      benchmark: config.server.env !== 'production',
      
      // Transaction isolation
      isolationLevel: config.database.isolationLevel || 'READ_COMMITTED',
      
      // SSL configuration
      ssl: config.database.ssl || false,
      
      // Dialect-specific options
      dialectOptions: {
        ssl: config.database.ssl ? {
          require: true,
          rejectUnauthorized: false
        } : false,
        connectTimeout: 60000,
        acquireTimeout: 60000,
        timeout: 60000,
        requestTimeout: 60000
      }
    };

    this.sequelize = new Sequelize(dbConfig);

    // Test connection with retry logic
    await this.connectWithRetry();
  }

  /**
   * Initialize Mongoose with enterprise configurations
   */
  

  /**
   * Connect with exponential backoff retry
   */
  private async connectWithRetry(): Promise<void> {
    const maxRetries = 5;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.sequelize.authenticate();
        logger.info('Database connection established successfully');
        this.reconnectAttempts = 0;
        return;
      } catch (error) {
        lastError = error;
        this.connectionStats.errors.push(`Attempt ${attempt}: ${error.message}`);
        
        if (attempt === maxRetries) {
          logger.error('Failed to connect to database after maximum retries', {
            attempts: maxRetries,
            error: error.message
          });
          throw error;
        }

        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        logger.warn(`Database connection failed, retrying in ${backoffDelay}ms (attempt ${attempt}/${maxRetries})`, {
          error: error.message
        });
        
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<boolean> {
    try {
      // Sequelize health check
      if (this.sequelize) {
        await this.sequelize.authenticate();
        
        // Get connection pool stats
        const pool = this.sequelize.connectionManager.pool;
        if (pool) {
          this.connectionStats = {
            totalConnections: pool.size,
            activeConnections: pool.used,
            idleConnections: pool.available,
            waitingConnections: pool.pending,
            lastHealthCheck: new Date(),
            isHealthy: true,
            errors: []
          };
        }
      }
      
      

      logger.debug('Database health check passed', this.connectionStats);
      return true;
    } catch (error) {
      this.connectionStats.isHealthy = false;
      this.connectionStats.errors.push(error.message);
      this.connectionStats.lastHealthCheck = new Date();
      
      logger.warn('Database health check failed', {
        error: error.message,
        stats: this.connectionStats
      });
      
      return false;
    }
  }

  /**
   * Start periodic health check
   */
  private startHealthCheckInterval(): void {
    // Health check every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      const isHealthy = await this.performHealthCheck();
      
      if (!isHealthy && !this.isConnecting) {
        logger.warn('Database unhealthy, attempting reconnection');
        await this.handleReconnection();
      }
    }, 30000);
  }

  /**
   * Handle connection recovery
   */
  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Maximum reconnection attempts reached, giving up');
      return;
    }

    this.reconnectAttempts++;
    const backoffDelay = Math.min(5000 * Math.pow(2, this.reconnectAttempts - 1), 60000);

    logger.info(`Attempting database reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, {
      backoffDelay
    });

    await new Promise(resolve => setTimeout(resolve, backoffDelay));

    try {
      if (this.sequelize) {
        await this.sequelize.close();
        await this.initializeSequelize();
      }
      
      

      this.reconnectAttempts = 0;
      logger.info('Database reconnection successful');
    } catch (error) {
      logger.error('Database reconnection failed', {
        attempt: this.reconnectAttempts,
        error: error.message
      });
    }
  }

  /**
   * Setup connection event handlers
   */
  private setupConnectionEventHandlers(): void {
    if (this.sequelize) {
      // Sequelize connection events
      this.sequelize.connectionManager.on('connect', () => {
        logger.info('Database connection established');
      });

      this.sequelize.connectionManager.on('disconnect', () => {
        logger.warn('Database connection lost');
      });

      this.sequelize.connectionManager.on('error', (error) => {
        logger.error('Database connection error', error);
      });
    }

    
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): ConnectionStats {
    return { ...this.connectionStats };
  }

  /**
   * Get database connection instance
   */
  getSequelize(): Sequelize | null {
    return this.sequelize;
  }

  

  /**
   * Check if database is ready
   */
  isReady(): boolean {
    return this.connectionStats.isHealthy && !this.isConnecting;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      if (this.sequelize) {
        await this.sequelize.close();
        logger.info('Sequelize connection closed');
      }

      

    } catch (error) {
      logger.error('Error during database shutdown', error);
      throw error;
    }
  }

  /**
   * Execute query with connection verification
   */
  async executeQuery(query: string, options?: any): Promise<any> {
    if (!this.isReady()) {
      throw new Error('Database connection is not ready');
    }

    try {
      return await this.sequelize.query(query, options);
    } catch (error) {
      logger.error('Query execution failed', {
        query: query.substring(0, 200),
        error: error.message
      });
      
      // Trigger health check on query failure
      await this.performHealthCheck();
      throw error;
    }
  }

  /**
   * Get detailed connection metrics for monitoring
   */
  getDetailedMetrics(): object {
    return {
      connectionStats: this.connectionStats,
      reconnectAttempts: this.reconnectAttempts,
      isConnecting: this.isConnecting,
      maxReconnectAttempts: this.maxReconnectAttempts,
      sequelizeReady: !!this.sequelize,
      
      uptime: Date.now() - this.connectionStats.lastHealthCheck.getTime()
    };
  }
}

// Export singleton instance
export const dbConnectionManager = new DatabaseConnectionManager();