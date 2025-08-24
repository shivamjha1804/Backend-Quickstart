import dotenv from 'dotenv';
import { createServer } from 'http';


// Load environment variables first
dotenv.config();

import app from './app';
import { config } from './config';
import { logger } from './core/utils/logger';


// Enterprise imports
import { dbConnectionManager } from './core/database/connectionManager';
import { clusterManager } from './core/cluster/clusterManager';
import { healthCheckService } from './core/monitoring/healthCheck';


// Global server instance for cluster management
let server: any;

async function startServer(): Promise<void> {

  try {
    logger.info('🚀 Starting enterprise backend server...');
    
    // ENTERPRISE: Initialize database connection manager
    logger.info('📊 Initializing enterprise database connection manager...');
    await dbConnectionManager.initialize();
    
    // ENTERPRISE: Initialize health check service
    logger.info('🏥 Initializing enterprise health check service...');
    await healthCheckService.performHealthCheck();
    
    // Create HTTP server with enterprise configuration
    server = createServer(app);
    
    // ENTERPRISE: Configure server timeouts for production
    server.timeout = config.server.timeout || 120000; // 2 minutes
    server.keepAliveTimeout = config.server.keepAliveTimeout || 65000; // 65 seconds
    server.headersTimeout = config.server.headersTimeout || 66000; // 66 seconds
    
    // Start server
    server.listen(config.server.port, config.server.host, () => {
      logger.info(`🚀 Enterprise server running on ${config.server.host}:${config.server.port}`);
      logger.info(`📖 API Documentation: http://${config.server.host}:${config.server.port}/api-docs`);
      logger.info(`🏥 Health Check: http://${config.server.host}:${config.server.port}/health`);
      logger.info(`📊 Metrics Endpoint: http://${config.server.host}:${config.server.port}/metrics`);
      logger.info(`📈 Status Endpoint: http://${config.server.host}:${config.server.port}/status`);
      logger.info(`🌍 Environment: ${config.server.env}`);
      logger.info(`🔒 Security: Enterprise hardening enabled`);
      logger.info(`📡 Monitoring: Enterprise observability enabled`);
      
      // Log startup performance
      const uptime = process.uptime();
      logger.info(`⚡ Server startup completed in ${uptime.toFixed(2)}s`);
    });

    // ENTERPRISE: Setup graceful shutdown with proper cleanup order
    setupGracefulShutdown();

  } catch (error) {
    logger.error('💥 Failed to start enterprise server:', error);
    await gracefulShutdown();
    process.exit(1);
  }
}

/**
 * Enterprise graceful shutdown with proper cleanup order
 */
async function setupGracefulShutdown(): Promise<void> {

  const shutdownSignals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
  
  shutdownSignals.forEach(signal => {
    process.on(signal, () => {
      logger.info(`🛑 Received ${signal}, starting graceful shutdown...`);
      gracefulShutdown();
    });
  });
}

/**
 * Perform graceful shutdown with proper cleanup
 */
async function gracefulShutdown(): Promise<void> {

  logger.info('🛑 Starting graceful shutdown sequence...');
  
  try {
    // Step 1: Stop accepting new connections
    if (server) {
      logger.info('🔌 Closing HTTP server...');
      server.close();
    }
    
    // Step 2: Close database connections
    logger.info('🗄️ Closing database connections...');
    await dbConnectionManager.shutdown();
    
    // Step 3: Final cleanup
    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
    
  } catch (error) {
    logger.error('💥 Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions with enterprise logging
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception - Enterprise server will shutdown:', error);
  gracefulShutdown();
});

// Handle unhandled promise rejections with enterprise logging  
process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection - Enterprise server will shutdown:', { reason, promise });
  gracefulShutdown();
});

// ENTERPRISE STARTUP: Cluster or single instance
if (config.cluster?.enabled && config.server.env === 'production') {
  logger.info('🔧 Starting in ENTERPRISE CLUSTER mode...');
  clusterManager.start();
} else {
  logger.info('🔧 Starting in SINGLE INSTANCE mode...');
  startServer();
}

// Export for testing and external use
export { server, startServer, gracefulShutdown };

