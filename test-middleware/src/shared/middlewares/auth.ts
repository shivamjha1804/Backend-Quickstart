import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { logger } from '../../core/utils/logger';


import { User } from '../../core/database/models/User';


interface AuthenticatedRequest extends Request {
  user?: any;
}

interface JwtPayload {
  id: string;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {

  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Access token is required',
          statusCode: 401
        }
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the token
    if (!config.jwt) {
      res.status(500).json({
        success: false,
        error: {
          message: 'JWT configuration is missing',
          statusCode: 500
        }
      });
      return;
    }
    
    const decoded = jwt.verify(token, config.jwt!.secret) as JwtPayload;

    // Find the user
    const user = await User.findByPk(decoded.id);
    

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          message: 'User not found',
          statusCode: 401
        }
      });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Account is deactivated',
          statusCode: 401
        }
      });
      return;
    }

    // Attach user to request object
    req.user = user;
    next();

  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        error: {
          message: 'Invalid token',
          statusCode: 401
        }
      });
    }

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        error: {
          message: 'Token expired',
          statusCode: 401
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        message: 'Authentication failed',
        statusCode: 500
      }
    });
  }
};

/**
 * Middleware to authorize users based on roles
 */
export const authorize = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {

    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
          statusCode: 401
        }
      });
    }

    const userRole = req.user.role || 'user';

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Insufficient permissions',
          statusCode: 403
        }
      });
    }

    next();
  };
};

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {

  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without user
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    const user = await User.findByPk(decoded.id);
    

    if (user && user.isActive) {
      req.user = user;
    }

    next();

  } catch (error) {
    // Continue without user on any error
    next();
  }
};

