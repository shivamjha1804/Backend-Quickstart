import { Request, Response, NextFunction } from 'express';
import { logger } from '../../core/utils/logger';
import { config } from '../../config';

interface CustomError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(`Error ${err.statusCode || 500}: ${err.message}`, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Default error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server Error';


  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map((error: any) => error.message);
    message = errors.join(', ');
    statusCode = 400;
  }

  // Sequelize unique constraint error
  if (err.name === 'SequelizeUniqueConstraintError') {
    message = 'Resource already exists';
    statusCode = 400;
  }

  // Sequelize foreign key constraint error
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    message = 'Invalid reference to related resource';
    statusCode = 400;
  }

  // Sequelize connection error
  if (err.name === 'SequelizeConnectionError') {
    message = 'Database connection error';
    statusCode = 500;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid token';
    statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    message = 'Token expired';
    statusCode = 401;
  }

  // Express validator errors
  if (err.type === 'entity.parse.failed') {
    message = 'Invalid JSON payload';
    statusCode = 400;
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(config.server.env === 'development' && { stack: err.stack })
    }
  });
};

