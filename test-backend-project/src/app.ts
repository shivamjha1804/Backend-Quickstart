import express from 'express';
import morgan from 'morgan';
import { config } from './config';
import { logger } from './core/utils/logger';
import { errorHandler } from './shared/middlewares/errorHandler';
import { notFoundHandler } from './shared/middlewares/notFoundHandler';

// Enterprise Security & Monitoring
import { applySecurityHardening } from './core/security/securityHardening';
import { metricsCollector } from './core/monitoring/metricsCollector';
import { healthEndpoints } from './core/monitoring/healthCheck';
import { 
  advancedSanitization,
  advancedXssProtection,
  sqlInjectionProtection,
  requestFingerprinting,
  createAdvancedRateLimit,
  requestSlowDown,
  parameterPollutionProtection,
  enhancedSecurityHeaders,
  requestTracking
} from './shared/middlewares/enterpriseSecurity';

// Import routes
import authRoutes from './api/v1/routes/auth';
import userRoutes from './api/v1/routes/users';

import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const app = express();

// ENTERPRISE SECURITY HARDENING - Apply comprehensive security measures
const securityManager = applySecurityHardening(app);

// ENTERPRISE MONITORING - Request tracking and correlation
app.use(requestTracking);

// ENTERPRISE MONITORING - Metrics collection for all HTTP requests
app.use(metricsCollector.collectHttpMetrics());

// ENTERPRISE SECURITY - Request fingerprinting for advanced rate limiting
app.use(requestFingerprinting);

// ENTERPRISE SECURITY - Advanced request sanitization
app.use(advancedSanitization);

// ENTERPRISE SECURITY - XSS protection with deep sanitization
app.use(advancedXssProtection);

// ENTERPRISE SECURITY - SQL injection protection
app.use(sqlInjectionProtection);

// ENTERPRISE SECURITY - HTTP Parameter Pollution protection
app.use(parameterPollutionProtection);

// ENTERPRISE SECURITY - Enhanced security headers
app.use(enhancedSecurityHeaders);

// ENTERPRISE SECURITY - Request slowdown before rate limiting
app.use(requestSlowDown);

// ENTERPRISE SECURITY - Advanced tiered rate limiting
const generalRateLimit = createAdvancedRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: config.server.env === 'production' ? 100 : 1000
});
app.use(generalRateLimit);

// Logging with enterprise correlation tracking
if (config.server.env !== 'test') {
  app.use(morgan(config.server.env === 'production' ? 'combined' : 'dev', {
    stream: { write: (message) => logger.info(message.trim()) }
  }));
}

// Swagger documentation
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'test-backend-project API',
      version: '1.0.0',
      description: 'A production-ready backend API',
    },
    servers: [
      {
        url: `http://localhost:${config.server.port}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/api/v1/routes/*.ts'],
};

const swaggerSpec = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ENTERPRISE HEALTH & MONITORING ENDPOINTS
app.get('/health', healthEndpoints.health);
app.get('/health/ping', healthEndpoints.ping);
app.get('/health/ready', healthEndpoints.ready);
app.get('/health/live', healthEndpoints.live);

// ENTERPRISE METRICS ENDPOINT (for Prometheus/monitoring)
app.get('/metrics', async (req, res) => {
  try {
    const metrics = await metricsCollector.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.end(metrics);
  } catch (error) {
    logger.error('Error generating metrics', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error generating metrics',
        statusCode: 500
      }
    });
  }
});

// ENTERPRISE STATUS ENDPOINT
app.get('/status', (req, res) => {
  const status = {
    service: 'test-backend-project',
    version: '1.0.0',
    environment: config.server.env,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    security: securityManager.getSecurityStatus(),
    metrics: metricsCollector.getMetricsSummary()
  };
  
  res.json({
    success: true,
    data: status
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handling middleware
app.use(errorHandler);

export default app;