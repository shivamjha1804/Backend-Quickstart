import { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import { config } from '../../config';
import { logger } from '../utils/logger';

/**
 * Enterprise-grade security hardening configuration
 * Implements comprehensive security measures including advanced CORS,
 * security headers, input validation, and protection against common attacks
 */

interface SecurityConfig {
  cors: {
    origins: string[];
    credentials: boolean;
    optionsSuccessStatus: number;
    maxAge: number;
  };
  helmet: {
    contentSecurityPolicy: boolean | object;
    crossOriginEmbedderPolicy: boolean;
    crossOriginOpenerPolicy: boolean;
    crossOriginResourcePolicy: boolean;
    dnsPrefetchControl: boolean;
    frameguard: boolean | object;
    hidePoweredBy: boolean;
    hsts: boolean | object;
    ieNoOpen: boolean;
    noSniff: boolean;
    originAgentCluster: boolean;
    permittedCrossDomainPolicies: boolean;
    referrerPolicy: boolean | object;
    xssFilter: boolean;
  };
  compression: {
    level: number;
    threshold: number;
    filter: (req: Request, res: Response) => boolean;
  };
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    standardHeaders: boolean;
    legacyHeaders: boolean;
  };
}

export class SecurityHardening {
  private app: Application;
  private securityConfig: SecurityConfig;

  constructor(app: Application) {
    this.app = app;
    this.securityConfig = this.getSecurityConfig();
  }

  /**
   * Apply all security hardening measures
   */
  applySecurityHardening(): void {
    try {
      // Apply security measures in order of importance
      this.configureHelmet();
      this.configureCORS();
      this.configureCompression();
      this.configureRequestSizeLimit();
      this.configureTrustedProxies();
      this.configureSecurityHeaders();
      this.configureContentTypeValidation();
      this.configureIPValidation();
      this.configureSessionSecurity();
      this.configureErrorHandling();
      
      logger.info('Security hardening applied successfully');
    } catch (error) {
      logger.error('Failed to apply security hardening', error);
      throw error;
    }
  }

  /**
   * Get security configuration based on environment
   */
  private getSecurityConfig(): SecurityConfig {
    const isProd = config.server.env === 'production';
    
    return {
      cors: {
        origins: config.cors?.origins || (isProd ? [] : ['http://localhost:3000', 'http://localhost:8080']),
        credentials: true,
        optionsSuccessStatus: 200,
        maxAge: isProd ? 86400 : 300 // 24h in prod, 5min in dev
      },
      helmet: {
        contentSecurityPolicy: isProd ? {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            workerSrc: ["'self'"],
            upgradeInsecureRequests: []
          }
        } : false, // Disable in development for easier debugging
        crossOriginEmbedderPolicy: isProd,
        crossOriginOpenerPolicy: isProd ? { policy: "same-origin" } : false,
        crossOriginResourcePolicy: isProd ? { policy: "cross-origin" } : false,
        dnsPrefetchControl: { allow: false },
        frameguard: { action: 'deny' },
        hidePoweredBy: true,
        hsts: isProd ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        } : false,
        ieNoOpen: true,
        noSniff: true,
        originAgentCluster: true,
        permittedCrossDomainPolicies: false,
        referrerPolicy: { policy: "strict-origin-when-cross-origin" },
        xssFilter: true
      },
      compression: {
        level: 6,
        threshold: 1024,
        filter: (req: Request, res: Response) => {
          // Don't compress if the request includes a Cache-Control no-transform directive
          if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
            return false;
          }
          // Use compression filter
          return compression.filter(req, res);
        }
      },
      rateLimiting: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: isProd ? 100 : 1000,
        skipSuccessfulRequests: false,
        standardHeaders: true,
        legacyHeaders: false
      }
    };
  }

  /**
   * Configure Helmet security headers
   */
  private configureHelmet(): void {
    this.app.use(helmet(this.securityConfig.helmet));
    
    // Additional custom security headers
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      // Prevent MIME type sniffing
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // Prevent clickjacking
      res.setHeader('X-Frame-Options', 'DENY');
      
      // Enable XSS filtering
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      // Referrer policy
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // Permissions policy (formerly Feature-Policy)
      res.setHeader('Permissions-Policy', 
        'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
      );
      
      // Prevent information disclosure
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');
      
      // Cache control for security-sensitive responses
      if (req.path.includes('/auth/') || req.path.includes('/admin/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      
      next();
    });

    logger.debug('Helmet security headers configured');
  }

  /**
   * Configure CORS with advanced settings
   */
  private configureCORS(): void {
    const corsOptions = {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
          return callback(null, true);
        }

        // Check if origin is in allowed list
        if (this.securityConfig.cors.origins.length === 0 || 
            this.securityConfig.cors.origins.includes(origin) ||
            this.isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          logger.warn('CORS: Origin not allowed', { origin });
          callback(new Error('CORS: Origin not allowed'), false);
        }
      },
      credentials: this.securityConfig.cors.credentials,
      optionsSuccessStatus: this.securityConfig.cors.optionsSuccessStatus,
      maxAge: this.securityConfig.cors.maxAge,
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-API-Key',
        'X-Request-ID',
        'X-Correlation-ID'
      ],
      exposedHeaders: [
        'X-Request-ID',
        'X-Correlation-ID',
        'X-Total-Count',
        'X-Page-Count'
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']
    };

    this.app.use(cors(corsOptions));
    
    // Handle preflight OPTIONS requests
    this.app.options('*', cors(corsOptions));

    logger.debug('CORS configured with origins', { origins: this.securityConfig.cors.origins });
  }

  /**
   * Check if origin is allowed based on patterns
   */
  private isOriginAllowed(origin: string): boolean {
    const isDev = config.server.env === 'development';
    
    // Allow localhost in development
    if (isDev && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return true;
    }
    
    // Add custom origin validation logic here
    // For example: checking against domain patterns, subdomains, etc.
    
    return false;
  }

  /**
   * Configure response compression
   */
  private configureCompression(): void {
    this.app.use(compression(this.securityConfig.compression));
    logger.debug('Response compression configured');
  }

  /**
   * Configure request size limits
   */
  private configureRequestSizeLimit(): void {
    const express = require('express');
    
    // JSON body size limit
    this.app.use(express.json({ 
      limit: config.security?.maxRequestSize || '10mb',
      verify: (req: any, res: Response, buf: Buffer) => {
        // Store raw body for webhook signature verification if needed
        (req as any).rawBody = buf;
      }
    }));
    
    // URL encoded body size limit
    this.app.use(express.urlencoded({ 
      limit: config.security?.maxRequestSize || '10mb',
      extended: true 
    }));
    
    // Custom middleware to validate request size
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const contentLength = req.get('Content-Length');
      const maxSize = parseInt(config.security?.maxRequestSize?.replace('mb', '')) * 1024 * 1024 || 10485760; // 10MB default
      
      if (contentLength && parseInt(contentLength) > maxSize) {
        return res.status(413).json({
          success: false,
          error: {
            message: 'Request entity too large',
            statusCode: 413
          }
        });
      }
      
      next();
    });

    logger.debug('Request size limits configured');
  }

  /**
   * Configure trusted proxies for proper IP detection
   */
  private configureTrustedProxies(): void {
    // Trust proxy settings for load balancers
    if (config.server.trustProxy) {
      this.app.set('trust proxy', config.server.trustProxy);
    } else if (config.server.env === 'production') {
      // In production, trust first proxy (load balancer)
      this.app.set('trust proxy', 1);
    }
    
    logger.debug('Trusted proxy configuration set');
  }

  /**
   * Additional security headers middleware
   */
  private configureSecurityHeaders(): void {
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      // Prevent search engine indexing in non-production environments
      if (config.server.env !== 'production') {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow, nosnippet, noarchive');
      }
      
      // API versioning header
      res.setHeader('X-API-Version', '1.0.0');
      
      // Request processing time (for monitoring)
      const startTime = Date.now();
      res.on('finish', () => {
        const processingTime = Date.now() - startTime;
        res.setHeader('X-Response-Time', `${processingTime}ms`);
      });
      
      next();
    });

    logger.debug('Additional security headers configured');
  }

  /**
   * Content-Type validation middleware
   */
  private configureContentTypeValidation(): void {
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      // Only validate content type for requests with body
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.get('Content-Type');
        const allowedTypes = [
          'application/json',
          'application/x-www-form-urlencoded',
          'multipart/form-data',
          'text/plain'
        ];

        if (contentType && !allowedTypes.some(type => contentType.includes(type))) {
          return res.status(415).json({
            success: false,
            error: {
              message: 'Unsupported Media Type',
              statusCode: 415,
              allowedTypes
            }
          });
        }
      }
      
      next();
    });

    logger.debug('Content-Type validation configured');
  }

  /**
   * IP validation and filtering
   */
  private configureIPValidation(): void {
    // IP blacklist/whitelist middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const clientIP = req.ip;
      
      // Check against blacklist
      const blacklistedIPs = config.security?.blacklistedIPs || [];
      if (blacklistedIPs.includes(clientIP)) {
        logger.warn('Blocked request from blacklisted IP', { ip: clientIP });
        return res.status(403).json({
          success: false,
          error: {
            message: 'Access denied',
            statusCode: 403
          }
        });
      }
      
      // Check against whitelist (if configured)
      const whitelistedIPs = config.security?.whitelistedIPs || [];
      if (whitelistedIPs.length > 0 && !whitelistedIPs.includes(clientIP)) {
        logger.warn('Blocked request from non-whitelisted IP', { ip: clientIP });
        return res.status(403).json({
          success: false,
          error: {
            message: 'Access denied',
            statusCode: 403
          }
        });
      }
      
      next();
    });

    logger.debug('IP validation configured');
  }

  /**
   * Session security configuration
   */
  private configureSessionSecurity(): void {
    // Disable default Express session if not needed
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      // Remove session-related headers if not using sessions
      if (!config.session?.enabled) {
        res.removeHeader('Set-Cookie');
      }
      next();
    });

    logger.debug('Session security configured');
  }

  /**
   * Security-focused error handling
   */
  private configureErrorHandling(): void {
    // Global error handler that doesn't leak sensitive information
    this.app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      // Log the full error for debugging
      logger.error('Unhandled application error', {
        error: err.message,
        stack: config.server.env === 'development' ? err.stack : undefined,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Don't leak sensitive error information in production
      const isDev = config.server.env === 'development';
      const statusCode = err.statusCode || err.status || 500;
      
      res.status(statusCode).json({
        success: false,
        error: {
          message: isDev ? err.message : 'Internal Server Error',
          statusCode,
          ...(isDev && { stack: err.stack })
        }
      });
    });

    logger.debug('Security-focused error handling configured');
  }

  /**
   * Get current security configuration
   */
  getSecurityStatus(): object {
    return {
      environment: config.server.env,
      securityHeaders: true,
      corsEnabled: true,
      compressionEnabled: true,
      requestSizeLimitEnabled: true,
      trustedProxyConfigured: !!config.server.trustProxy,
      contentTypeValidationEnabled: true,
      ipValidationEnabled: true,
      sessionSecurityEnabled: true,
      errorHandlingSecure: true,
      corsOrigins: this.securityConfig.cors.origins,
      helmetEnabled: true
    };
  }
}

/**
 * Factory function to create and apply security hardening
 */
export function applySecurityHardening(app: Application): SecurityHardening {
  const security = new SecurityHardening(app);
  security.applySecurityHardening();
  return security;
}

