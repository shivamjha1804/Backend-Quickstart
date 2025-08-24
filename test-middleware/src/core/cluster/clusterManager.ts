import cluster from 'cluster';
import os from 'os';
import { config } from '../../config';
import { logger } from '../utils/logger';
import { dbConnectionManager } from '../database/connectionManager';

/**
 * Enterprise cluster manager for high availability and scalability
 * Manages worker processes, graceful shutdown, and load distribution
 */

interface WorkerStats {
  id: number;
  pid: number;
  startTime: Date;
  restarts: number;
  memory: number;
  cpu: number;
  status: 'online' | 'disconnected' | 'dead' | 'restart';
}

interface ClusterStats {
  master: {
    pid: number;
    uptime: number;
    memory: number;
    cpu: number;
  };
  workers: WorkerStats[];
  totalRestarts: number;
  activeWorkers: number;
  failedWorkers: number;
}

export class ClusterManager {
  private workerStats: Map<number, WorkerStats> = new Map();
  private totalRestarts = 0;
  private isShuttingDown = false;
  private maxWorkers: number;
  private minWorkers: number;
  private restartThreshold: number;

  constructor() {
    this.maxWorkers = config.cluster?.maxWorkers || os.cpus().length;
    this.minWorkers = config.cluster?.minWorkers || Math.max(1, Math.floor(this.maxWorkers / 2));
    this.restartThreshold = config.cluster?.restartThreshold || 10;
  }

  /**
   * Start cluster manager
   */
  start(): void {
    if (cluster.isMaster || cluster.isPrimary) {
      this.startMaster();
    } else {
      this.startWorker();
    }
  }

  /**
   * Start master process
   */
  private startMaster(): void {
    logger.info(`Master process ${process.pid} starting with ${this.maxWorkers} workers`);

    // Set process title for monitoring
    process.title = `${config.server.name || 'backend-api'}-master`;

    // Fork initial workers
    this.forkWorkers();

    // Setup cluster event handlers
    this.setupClusterEventHandlers();

    // Setup graceful shutdown handlers
    this.setupGracefulShutdown();

    // Setup monitoring and health checks
    this.setupMonitoring();

    // Setup admin commands
    this.setupAdminInterface();

    logger.info('Cluster master started successfully');
  }

  /**
   * Start worker process
   */
  private startWorker(): void {
    try {
      // Set process title for monitoring
      process.title = `${config.server.name || 'backend-api'}-worker-${process.pid}`;

      // Import and start the application
      const { startServer } = require('../../server');
      startServer();

      // Setup worker-specific handlers
      this.setupWorkerHandlers();

      logger.info(`Worker process ${process.pid} started`);
    } catch (error) {
      logger.error(`Worker ${process.pid} startup failed`, error);
      process.exit(1);
    }
  }

  /**
   * Fork worker processes
   */
  private forkWorkers(): void {
    const workersToFork = Math.min(this.maxWorkers, os.cpus().length);
    
    for (let i = 0; i < workersToFork; i++) {
      this.forkWorker();
    }
  }

  /**
   * Fork a single worker
   */
  private forkWorker(): cluster.Worker {
    const worker = cluster.fork();
    
    // Initialize worker stats
    this.workerStats.set(worker.id, {
      id: worker.id,
      pid: worker.process.pid,
      startTime: new Date(),
      restarts: 0,
      memory: 0,
      cpu: 0,
      status: 'online'
    });

    return worker;
  }

  /**
   * Setup cluster event handlers
   */
  private setupClusterEventHandlers(): void {
    // Worker online event
    cluster.on('online', (worker) => {
      logger.info(`Worker ${worker.process.pid} is online`);
      this.updateWorkerStatus(worker.id, 'online');
    });

    // Worker disconnect event
    cluster.on('disconnect', (worker) => {
      logger.warn(`Worker ${worker.process.pid} disconnected`);
      this.updateWorkerStatus(worker.id, 'disconnected');
    });

    // Worker exit event
    cluster.on('exit', (worker, code, signal) => {
      logger.error(`Worker ${worker.process.pid} died`, { code, signal });
      this.handleWorkerExit(worker, code, signal);
    });

    // Handle worker messages
    cluster.on('message', (worker, message) => {
      this.handleWorkerMessage(worker, message);
    });

    // Fork event
    cluster.on('fork', (worker) => {
      logger.info(`Forking worker ${worker.process.pid}`);
    });
  }

  /**
   * Handle worker exit and restart if needed
   */
  private handleWorkerExit(worker: cluster.Worker, code: number, signal: string): void {
    const stats = this.workerStats.get(worker.id);
    
    if (stats) {
      stats.status = 'dead';
      this.updateWorkerStats(worker.id, stats);
    }

    // Don't restart during shutdown
    if (this.isShuttingDown) {
      return;
    }

    // Check restart threshold
    if (stats && stats.restarts >= this.restartThreshold) {
      logger.error(`Worker ${worker.process.pid} exceeded restart threshold, not restarting`, {
        restarts: stats.restarts,
        threshold: this.restartThreshold
      });
      return;
    }

    // Restart worker if it crashed unexpectedly
    if (code !== 0 && !signal) {
      logger.info(`Restarting worker ${worker.process.pid}`);
      this.totalRestarts++;
      
      const newWorker = this.forkWorker();
      
      // Update restart count
      if (stats) {
        const newStats = this.workerStats.get(newWorker.id);
        if (newStats) {
          newStats.restarts = stats.restarts + 1;
          this.updateWorkerStats(newWorker.id, newStats);
        }
      }
    }
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(worker: cluster.Worker, message: any): void {
    switch (message.type) {
      case 'stats':
        this.updateWorkerStats(worker.id, message.data);
        break;
      case 'health':
        this.handleHealthReport(worker.id, message.data);
        break;
      case 'error':
        logger.error(`Worker ${worker.process.pid} reported error`, message.data);
        break;
      case 'shutdown':
        logger.info(`Worker ${worker.process.pid} requesting shutdown`);
        this.gracefulWorkerShutdown(worker);
        break;
      default:
        logger.debug(`Unknown message from worker ${worker.process.pid}`, message);
    }
  }

  /**
   * Update worker statistics
   */
  private updateWorkerStats(workerId: number, stats: Partial<WorkerStats>): void {
    const currentStats = this.workerStats.get(workerId);
    if (currentStats) {
      Object.assign(currentStats, stats);
      this.workerStats.set(workerId, currentStats);
    }
  }

  /**
   * Update worker status
   */
  private updateWorkerStatus(workerId: number, status: WorkerStats['status']): void {
    this.updateWorkerStats(workerId, { status });
  }

  /**
   * Handle health reports from workers
   */
  private handleHealthReport(workerId: number, healthData: any): void {
    if (!healthData.healthy) {
      logger.warn(`Worker ${workerId} reported unhealthy status`, healthData);
      
      // Consider restarting unhealthy worker
      const worker = this.getWorkerById(workerId);
      if (worker) {
        this.gracefulWorkerRestart(worker);
      }
    }
  }

  /**
   * Get worker by ID
   */
  private getWorkerById(workerId: number): cluster.Worker | undefined {
    return Object.values(cluster.workers).find(worker => worker && worker.id === workerId);
  }

  /**
   * Gracefully restart a worker
   */
  private gracefulWorkerRestart(worker: cluster.Worker): void {
    logger.info(`Gracefully restarting worker ${worker.process.pid}`);
    
    // Fork replacement first
    const newWorker = this.forkWorker();
    
    // Wait for new worker to be ready, then kill old one
    newWorker.once('online', () => {
      worker.send({ type: 'shutdown' });
      
      setTimeout(() => {
        if (!worker.isDead()) {
          worker.kill('SIGTERM');
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Gracefully shutdown a worker
   */
  private gracefulWorkerShutdown(worker: cluster.Worker): void {
    worker.disconnect();
    
    setTimeout(() => {
      if (!worker.isDead()) {
        worker.kill('SIGTERM');
        
        setTimeout(() => {
          if (!worker.isDead()) {
            worker.kill('SIGKILL');
          }
        }, 5000);
      }
    }, 30000);
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdownSignals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    shutdownSignals.forEach(signal => {
      process.on(signal, () => {
        logger.info(`Received ${signal}, starting graceful shutdown`);
        this.gracefulShutdown();
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception in master process', error);
      this.gracefulShutdown();
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection in master process', { reason, promise });
      this.gracefulShutdown();
    });
  }

  /**
   * Perform graceful shutdown
   */
  private gracefulShutdown(): void {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Starting graceful cluster shutdown');

    // Stop accepting new work
    const workers = Object.values(cluster.workers);
    
    // Send shutdown signal to all workers
    workers.forEach(worker => {
      if (worker) {
        worker.send({ type: 'shutdown' });
        worker.disconnect();
      }
    });

    // Wait for workers to shut down
    const shutdownTimeout = setTimeout(() => {
      logger.warn('Forcing cluster shutdown due to timeout');
      workers.forEach(worker => {
        if (worker && !worker.isDead()) {
          worker.kill('SIGKILL');
        }
      });
      process.exit(1);
    }, 30000); // 30 second timeout

    // Monitor worker shutdown
    let shutdownWorkers = 0;
    const totalWorkers = workers.length;

    const checkShutdown = () => {
      shutdownWorkers++;
      if (shutdownWorkers >= totalWorkers) {
        clearTimeout(shutdownTimeout);
        logger.info('All workers shut down successfully');
        process.exit(0);
      }
    };

    workers.forEach(worker => {
      if (worker) {
        worker.once('disconnect', checkShutdown);
      } else {
        checkShutdown();
      }
    });
  }

  /**
   * Setup monitoring and health checks
   */
  private setupMonitoring(): void {
    // Monitor worker health every 30 seconds
    setInterval(() => {
      this.monitorWorkerHealth();
    }, 30000);

    // Monitor system resources every 60 seconds
    setInterval(() => {
      this.monitorSystemResources();
    }, 60000);
  }

  /**
   * Monitor worker health
   */
  private monitorWorkerHealth(): void {
    const workers = Object.values(cluster.workers);
    let healthyWorkers = 0;

    workers.forEach(worker => {
      if (worker && !worker.isDead()) {
        // Request health status from worker
        worker.send({ type: 'health-check' });
        healthyWorkers++;
      }
    });

    // Ensure minimum number of workers
    if (healthyWorkers < this.minWorkers) {
      const workersToFork = this.minWorkers - healthyWorkers;
      logger.warn(`Only ${healthyWorkers} healthy workers, forking ${workersToFork} more`);
      
      for (let i = 0; i < workersToFork; i++) {
        this.forkWorker();
      }
    }
  }

  /**
   * Monitor system resources
   */
  private monitorSystemResources(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    logger.debug('Master process resource usage', {
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024)
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: Math.round(process.uptime())
    });
  }

  /**
   * Setup admin interface for cluster management
   */
  private setupAdminInterface(): void {
    // Listen for admin commands via process signals
    process.on('SIGUSR1', () => {
      logger.info('Received SIGUSR1, printing cluster status');
      this.printClusterStatus();
    });

    process.on('SIGUSR2', () => {
      logger.info('Received SIGUSR2, reloading all workers');
      this.reloadAllWorkers();
    });
  }

  /**
   * Print cluster status
   */
  private printClusterStatus(): void {
    const stats = this.getClusterStats();
    console.log('\n=== Cluster Status ===');
    console.log(`Master PID: ${stats.master.pid}`);
    console.log(`Uptime: ${Math.round(stats.master.uptime)} seconds`);
    console.log(`Active Workers: ${stats.activeWorkers}`);
    console.log(`Total Restarts: ${stats.totalRestarts}`);
    console.log('\nWorker Details:');
    
    stats.workers.forEach(worker => {
      console.log(`  Worker ${worker.id} (PID ${worker.pid}): ${worker.status} - Restarts: ${worker.restarts}`);
    });
    console.log('=====================\n');
  }

  /**
   * Reload all workers gracefully
   */
  private reloadAllWorkers(): void {
    logger.info('Reloading all workers');
    
    const workers = Object.values(cluster.workers);
    let reloadedCount = 0;
    
    const reloadNext = () => {
      if (reloadedCount >= workers.length) {
        logger.info('All workers reloaded successfully');
        return;
      }
      
      const worker = workers[reloadedCount];
      if (worker && !worker.isDead()) {
        this.gracefulWorkerRestart(worker);
      }
      
      reloadedCount++;
      setTimeout(reloadNext, 5000); // Wait 5 seconds between restarts
    };
    
    reloadNext();
  }

  /**
   * Setup worker-specific handlers
   */
  private setupWorkerHandlers(): void {
    // Handle messages from master
    process.on('message', (message) => {
      switch (message.type) {
        case 'shutdown':
          this.workerGracefulShutdown();
          break;
        case 'health-check':
          this.reportWorkerHealth();
          break;
        default:
          logger.debug('Unknown message from master', message);
      }
    });

    // Setup worker shutdown handlers
    const shutdownSignals = ['SIGTERM', 'SIGINT'];
    shutdownSignals.forEach(signal => {
      process.on(signal, () => {
        logger.info(`Worker ${process.pid} received ${signal}`);
        this.workerGracefulShutdown();
      });
    });
  }

  /**
   * Worker graceful shutdown
   */
  private workerGracefulShutdown(): void {
    logger.info(`Worker ${process.pid} starting graceful shutdown`);
    
    // Stop accepting new connections
    const server = require('../../server').server;
    if (server) {
      server.close(() => {
        logger.info(`Worker ${process.pid} HTTP server closed`);
      });
    }

    // Close database connections
    dbConnectionManager.shutdown().then(() => {
      logger.info(`Worker ${process.pid} database connections closed`);
      process.exit(0);
    }).catch((error) => {
      logger.error(`Worker ${process.pid} error during shutdown`, error);
      process.exit(1);
    });

    // Force exit after timeout
    setTimeout(() => {
      logger.warn(`Worker ${process.pid} forced exit due to timeout`);
      process.exit(1);
    }, 30000);
  }

  /**
   * Report worker health to master
   */
  private reportWorkerHealth(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const healthData = {
      healthy: true,
      memory: memUsage.heapUsed,
      cpu: cpuUsage.user + cpuUsage.system,
      uptime: process.uptime()
    };

    process.send && process.send({
      type: 'health',
      data: healthData
    });
  }

  /**
   * Get comprehensive cluster statistics
   */
  getClusterStats(): ClusterStats {
    const workers = Object.values(cluster.workers);
    const activeWorkers = workers.filter(w => w && !w.isDead()).length;
    const failedWorkers = workers.length - activeWorkers;

    return {
      master: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage().heapUsed,
        cpu: process.cpuUsage().user + process.cpuUsage().system
      },
      workers: Array.from(this.workerStats.values()),
      totalRestarts: this.totalRestarts,
      activeWorkers,
      failedWorkers
    };
  }
}

// Export singleton instance
export const clusterManager = new ClusterManager();