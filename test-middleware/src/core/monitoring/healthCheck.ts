import { Request, Response } from 'express';
import { config } from '../../config';
import { logger } from '../utils/logger';
import { dbConnectionManager } from '../database/connectionManager';
import { metricsCollector } from './metricsCollector';
import Redis from 'ioredis';

/**
 * Enterprise-grade health check system with comprehensive diagnostics
 * Provides detailed health status for all system components including
 * database, cache, external services, and system resources
 */

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    [key: string]: ComponentHealth;
  };
  metrics: {
    memory: MemoryMetrics;
    cpu: CpuMetrics;
    database: DatabaseMetrics;
    cache?: CacheMetrics;
    network: NetworkMetrics;
  };
}

interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details: string;
  lastCheck: string;
  error?: string;
}

interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
}

interface CpuMetrics {
  user: number;
  system: number;
  loadAverage: number[];
}

interface DatabaseMetrics {
  connected: boolean;
  connectionPool: {
    total: number;
    active: number;
    idle: number;
    waiting: number;
  };
  responseTime: number;
  errors: number;
}

interface CacheMetrics {
  connected: boolean;
  responseTime: number;
  memoryUsage: number;
  connectedClients: number;
}

interface NetworkMetrics {
  activeConnections: number;
  requestsPerSecond: number;
  averageResponseTime: number;
}

export class HealthCheckService {
  private redis: Redis | null = null;
  private healthHistory: HealthStatus[] = [];
  private readonly MAX_HISTORY = 100;

  constructor() {
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection for health checks
   */
  private initializeRedis(): void {
    try {
      this.redis = new Redis({
        host: config.redis?.host || 'localhost',
        port: config.redis?.port || 6379,
        password: config.redis?.password,
        connectTimeout: 5000,
        lazyConnect: true,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3
      });
    } catch (error) {
      logger.warn('Failed to initialize Redis for health checks', error);
    }
  }

  /**
   * Comprehensive health check endpoint
   */
  async performHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Perform all health checks in parallel
      const [
        databaseHealth,
        cacheHealth,
        memoryMetrics,
        cpuMetrics,
        networkMetrics
      ] = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkCacheHealth(),
        this.getMemoryMetrics(),
        this.getCpuMetrics(),
        this.getNetworkMetrics()
      ]);

      const checks: { [key: string]: ComponentHealth } = {
        database: databaseHealth,
        cache: cacheHealth
      };

      // Determine overall health status
      const overallStatus = this.determineOverallStatus(checks);

      const healthStatus: HealthStatus = {
        status: overallStatus,
        timestamp,
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.server.env,
        checks,
        metrics: {
          memory: memoryMetrics,
          cpu: cpuMetrics,
          database: await this.getDatabaseMetrics(),
          cache: await this.getCacheMetrics(),
          network: networkMetrics
        }
      };

      // Store in history
      this.addToHistory(healthStatus);

      const duration = Date.now() - startTime;
      logger.debug('Health check completed', { duration, status: overallStatus });

      return healthStatus;
    } catch (error) {
      logger.error('Health check failed', error);
      
      const errorStatus: HealthStatus = {
        status: 'unhealthy',
        timestamp,
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.server.env,
        checks: {
          system: {
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            details: 'Health check system failure',
            lastCheck: timestamp,
            error: error.message
          }
        },
        metrics: {
          memory: this.getMemoryMetrics(),
          cpu: await this.getCpuMetrics(),
          database: { connected: false, connectionPool: { total: 0, active: 0, idle: 0, waiting: 0 }, responseTime: 0, errors: 1 },
          network: { activeConnections: 0, requestsPerSecond: 0, averageResponseTime: 0 }
        }
      };

      this.addToHistory(errorStatus);
      return errorStatus;
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const isHealthy = await dbConnectionManager.performHealthCheck();
      const responseTime = Date.now() - startTime;

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        responseTime,
        details: isHealthy ? 'Database connection is healthy' : 'Database connection issues detected',
        lastCheck: new Date().toISOString(),
        ...(isHealthy ? {} : { error: 'Database health check failed' })
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: 'Database connection failed',
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Check cache (Redis) health
   */
  private async checkCacheHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    if (!this.redis) {
      return {
        status: 'unhealthy',
        responseTime: 0,
        details: 'Redis not configured',
        lastCheck: new Date().toISOString(),
        error: 'Redis connection not initialized'
      };
    }

    try {
      await this.redis.ping();
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        details: 'Cache connection is healthy',
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: 'Cache connection failed',
        lastCheck: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Get memory metrics
   */
  private getMemoryMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024) // MB
    };
  }

  /**
   * Get CPU metrics
   */
  private async getCpuMetrics(): Promise<CpuMetrics> {
    const os = require('os');
    const cpuUsage = process.cpuUsage();
    
    return {
      user: cpuUsage.user / 1000000, // Convert to seconds
      system: cpuUsage.system / 1000000, // Convert to seconds
      loadAverage: os.loadavg()
    };
  }

  /**
   * Get database metrics
   */
  private async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      const stats = dbConnectionManager.getConnectionStats();
      return {
        connected: stats.isHealthy,
        connectionPool: {
          total: stats.totalConnections,
          active: stats.activeConnections,
          idle: stats.idleConnections,
          waiting: stats.waitingConnections
        },
        responseTime: Date.now() - stats.lastHealthCheck.getTime(),
        errors: stats.errors.length
      };
    } catch (error) {
      return {
        connected: false,
        connectionPool: { total: 0, active: 0, idle: 0, waiting: 0 },
        responseTime: 0,
        errors: 1
      };
    }
  }

  /**
   * Get cache metrics
   */
  private async getCacheMetrics(): Promise<CacheMetrics> {
    if (!this.redis) {
      return {
        connected: false,
        responseTime: 0,
        memoryUsage: 0,
        connectedClients: 0
      };
    }

    try {
      const startTime = Date.now();
      const info = await this.redis.info('memory');
      const responseTime = Date.now() - startTime;
      
      // Parse memory info
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const clientsMatch = info.match(/connected_clients:(\d+)/);
      
      return {
        connected: true,
        responseTime,
        memoryUsage: memoryMatch ? parseInt(memoryMatch[1]) / 1024 / 1024 : 0, // MB
        connectedClients: clientsMatch ? parseInt(clientsMatch[1]) : 0
      };
    } catch (error) {
      return {
        connected: false,
        responseTime: 0,
        memoryUsage: 0,
        connectedClients: 0
      };
    }
  }

  /**
   * Get network metrics
   */
  private getNetworkMetrics(): NetworkMetrics {
    // These would typically be collected from request metrics
    const summary = metricsCollector.getMetricsSummary();
    
    return {
      activeConnections: 0, // Would be tracked by connection middleware
      requestsPerSecond: 0, // Would be calculated from request metrics
      averageResponseTime: 0 // Would be calculated from response time metrics
    };
  }

  /**
   * Determine overall health status from component checks
   */
  private determineOverallStatus(checks: { [key: string]: ComponentHealth }): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(checks).map(check => check.status);
    
    if (statuses.every(status => status === 'healthy')) {
      return 'healthy';
    } else if (statuses.some(status => status === 'unhealthy')) {
      return 'unhealthy';
    } else {
      return 'degraded';
    }
  }

  /**
   * Add health check to history
   */
  private addToHistory(healthStatus: HealthStatus): void {
    this.healthHistory.unshift(healthStatus);
    
    // Keep only the last MAX_HISTORY entries
    if (this.healthHistory.length > this.MAX_HISTORY) {
      this.healthHistory = this.healthHistory.slice(0, this.MAX_HISTORY);
    }
  }

  /**
   * Get health history
   */
  getHealthHistory(limit = 10): HealthStatus[] {
    return this.healthHistory.slice(0, limit);
  }

  /**
   * Simple health check for load balancer
   */
  async simpleHealthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      const dbHealthy = await dbConnectionManager.performHealthCheck();
      return {
        status: dbHealthy ? 'OK' : 'ERROR',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'ERROR',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Readiness check (for Kubernetes)
   */
  async readinessCheck(): Promise<{ ready: boolean; details: string }> {
    try {
      const dbReady = dbConnectionManager.isReady();
      const cacheReady = this.redis ? await this.redis.ping().then(() => true).catch(() => false) : true;
      
      const ready = dbReady && cacheReady;
      
      return {
        ready,
        details: ready ? 'Service is ready to accept requests' : 'Service is not ready - dependencies not available'
      };
    } catch (error) {
      return {
        ready: false,
        details: `Readiness check failed: ${error.message}`
      };
    }
  }

  /**
   * Liveness check (for Kubernetes)
   */
  async livenessCheck(): Promise<{ alive: boolean; uptime: number }> {
    return {
      alive: true,
      uptime: Math.floor(process.uptime())
    };
  }
}

/**
 * Express middleware for health check endpoints
 */
export const createHealthCheckEndpoints = (healthCheck: HealthCheckService) => {
  return {
    // Comprehensive health check
    health: async (req: Request, res: Response): Promise<void> => {
      try {
        const healthStatus = await healthCheck.performHealthCheck();
        const statusCode = healthStatus.status === 'healthy' ? 200 
                         : healthStatus.status === 'degraded' ? 200 
                         : 503;
        
        res.status(statusCode).json({
          success: healthStatus.status !== 'unhealthy',
          data: healthStatus
        });
      } catch (error) {
        res.status(503).json({
          success: false,
          error: {
            message: 'Health check failed',
            details: error.message
          }
        });
      }
    },

    // Simple health check for load balancers
    ping: async (req: Request, res: Response): Promise<void> => {
      try {
        const result = await healthCheck.simpleHealthCheck();
        res.status(result.status === 'OK' ? 200 : 503).json(result);
      } catch (error) {
        res.status(503).json({
          status: 'ERROR',
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
    },

    // Kubernetes readiness probe
    ready: async (req: Request, res: Response): Promise<void> => {
      try {
        const result = await healthCheck.readinessCheck();
        res.status(result.ready ? 200 : 503).json(result);
      } catch (error) {
        res.status(503).json({
          ready: false,
          details: `Readiness check failed: ${error.message}`
        });
      }
    },

    // Kubernetes liveness probe
    live: async (req: Request, res: Response): Promise<void> => {
      try {
        const result = await healthCheck.livenessCheck();
        res.status(200).json(result);
      } catch (error) {
        res.status(503).json({
          alive: false,
          uptime: 0,
          error: error.message
        });
      }
    }
  };
};

// Export singleton instance
export const healthCheckService = new HealthCheckService();
export const healthEndpoints = createHealthCheckEndpoints(healthCheckService);