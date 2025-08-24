import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { body, validationResult, ValidationError } from 'express-validator';
import hpp from 'hpp';
import { config } from '../../config';
import { logger } from '../../core/utils/logger';

/**
 * Enterprise-grade security middleware stack
 */

/**
 * Advanced request sanitization
 */
export const advancedSanitization = (req: Request, res: Response, next: NextFunction): void => {
  // Request size validation
  const maxSize = parseInt(config.security?.maxRequestSize || '10mb');
  if (req.get('Content-Length') && parseInt(req.get('Content-Length')!) > maxSize) {
    return res.status(413).json({
      success: false,
      error: {
        message: 'Request too large',
        statusCode: 413
      }
    });
  }

  // Content-Type validation for POST/PUT/PATCH
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    const allowedTypes = [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data'
    ];
    
    if (contentType && !allowedTypes.some(type => contentType.includes(type))) {
      return res.status(415).json({
        success: false,
        error: {
          message: 'Unsupported media type',
          statusCode: 415
        }
      });
    }
  }

  // Remove potentially dangerous headers
  delete req.headers['x-forwarded-host'];
  delete req.headers['x-cluster-client-ip'];
  
  next();
};

/**
 * Advanced XSS Protection
 */
export const advancedXssProtection = (req: Request, res: Response, next: NextFunction): void => {
  const xss = require('xss');
  
  // Deep sanitize request body
  function sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return xss(obj, {
        whiteList: {}, // No HTML tags allowed
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script']
      });
    } else if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObject(item));
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
      return sanitized;
    }
    return obj;
  }

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * SQL Injection Protection
 */
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction): void => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(--|#|\/\*|\*\/)/,
    /(\b(OR|AND)\b.*=.*)/i,
    /('|(\\')|(;)|(\\x)|(\\0))/
  ];

  function checkForSqlInjection(obj: any, path = ''): boolean {
    if (typeof obj === 'string') {
      for (const pattern of sqlPatterns) {
        if (pattern.test(obj)) {
          logger.warn('Potential SQL injection attempt detected', {
            path,
            value: obj,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });
          return true;
        }
      }
    } else if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (checkForSqlInjection(obj[i], `${path}[${i}]`)) {
          return true;
        }
      }
    } else if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (checkForSqlInjection(obj[key], path ? `${path}.${key}` : key)) {
          return true;
        }
      }
    }
    return false;
  }

  if (checkForSqlInjection(req.body, 'body') || 
      checkForSqlInjection(req.query, 'query') || 
      checkForSqlInjection(req.params, 'params')) {
    
    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid request format',
        statusCode: 400
      }
    });
  }

  next();
};

/**
 * Request Fingerprinting for Security
 */
export const requestFingerprinting = (req: Request, res: Response, next: NextFunction): void => {
  const crypto = require('crypto');
  
  // Generate request fingerprint
  const fingerprintData = [
    req.get('User-Agent') || '',
    req.get('Accept-Language') || '',
    req.get('Accept-Encoding') || '',
    req.ip || '',
    req.connection.remotePort || ''
  ].join('|');

  const fingerprint = crypto
    .createHash('sha256')
    .update(fingerprintData)
    .digest('hex');

  // Add to request for later use
  (req as any).fingerprint = fingerprint;

  // Rate limiting by fingerprint
  (req as any).rateLimitKey = fingerprint;

  next();
};

/**
 * Advanced Rate Limiting with Tiered Protection
 */
export const createAdvancedRateLimit = (options: {
  windowMs?: number;
  maxRequests?: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    skipSuccessfulRequests = false,
    keyGenerator
  } = options;

  return rateLimit({
    windowMs,
    max: maxRequests,
    skipSuccessfulRequests,
    keyGenerator: keyGenerator || ((req: Request) => {
      // Use fingerprint if available, fallback to IP
      return (req as any).fingerprint || req.ip;
    }),
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        fingerprint: (req as any).fingerprint,
        userAgent: req.get('User-Agent'),
        path: req.path
      });

      res.status(429).json({
        success: false,
        error: {
          message: 'Too many requests, please try again later',
          statusCode: 429,
          retryAfter: Math.round(windowMs / 1000)
        }
      });
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

/**
 * Request Slowdown (Gradual delay before rate limiting)
 */
export const requestSlowDown = slowDown({
  windowMs: 5 * 60 * 1000, // 5 minutes
  delayAfter: 50, // Allow 50 requests per windowMs without delay
  delayMs: 100, // Add 100ms delay per request after delayAfter
  maxDelayMs: 2000, // Max delay of 2 seconds
  keyGenerator: (req: Request) => (req as any).fingerprint || req.ip
});

/**
 * HTTP Parameter Pollution Protection
 */
export const parameterPollutionProtection = hpp({
  whitelist: ['tags', 'categories'] // Allow arrays for these parameters
});

/**
 * Request Validation Chain
 */
export const validateRequest = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map((validation: any) => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorDetails = errors.array().map((error: ValidationError) => ({
        field: error.param,
        message: error.msg,
        value: error.value
      }));

      logger.warn('Request validation failed', {
        errors: errorDetails,
        ip: req.ip,
        path: req.path
      });

      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          statusCode: 400,
          details: errorDetails
        }
      });
    }

    next();
  };
};

/**
 * Security Headers Enhancement
 */
export const enhancedSecurityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Additional security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });

  next();
};

/**
 * Request ID and Correlation Tracking
 */
export const requestTracking = (req: Request, res: Response, next: NextFunction): void => {
  const crypto = require('crypto');
  
  // Generate unique request ID
  const requestId = req.get('X-Request-ID') || crypto.randomUUID();
  const correlationId = req.get('X-Correlation-ID') || crypto.randomUUID();

  // Add to request for logging
  (req as any).requestId = requestId;
  (req as any).correlationId = correlationId;

  // Add to response headers
  res.set({
    'X-Request-ID': requestId,
    'X-Correlation-ID': correlationId
  });

  next();
};

