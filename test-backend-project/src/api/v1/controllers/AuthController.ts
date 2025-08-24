import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../../../config';
import { logger } from '../../../core/utils/logger';


import { User } from '../../../core/database/models/User';
import { Op } from 'sequelize';


interface AuthenticatedRequest extends Request {
  user?: any;
}

export class AuthController {

  /**
   * Register a new user
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email } });
      

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: {
            message: 'User with this email already exists',
            statusCode: 409
          }
        });
      }

      // Create new user
      const userData = {
        email,
        password,
        firstName,
        lastName,
        
      };

      const user = await User.create(userData);
      

      // Generate tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      logger.info(`New user registered: ${email}`);

      res.status(201).json({
        success: true,
        data: {
          user: this.sanitizeUser(user),
          accessToken,
          refreshToken
        }
      });

    } catch (error) {
      logger.error('Registration error:', error);
      next(error);
    }
  }

  /**
   * Login user
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      // Find user with password field
      const user = await User.findOne({ 
        where: { email },
        attributes: { include: ['password'] }
      });
      

      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Invalid email or password',
            statusCode: 401
          }
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Invalid email or password',
            statusCode: 401
          }
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Account is deactivated',
            statusCode: 401
          }
        });
      }

      // Update last login
      await user.update({ lastLoginAt: new Date() });
      

      // Generate tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      logger.info(`User logged in: ${email}`);

      res.status(200).json({
        success: true,
        data: {
          user: this.sanitizeUser(user),
          accessToken,
          refreshToken
        }
      });

    } catch (error) {
      logger.error('Login error:', error);
      next(error);
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Refresh token is required',
            statusCode: 401
          }
        });
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as any;

      // Find user
      const user = await User.findByPk(decoded.id);
      

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Invalid refresh token',
            statusCode: 401
          }
        });
      }

      // Generate new access token
      const accessToken = this.generateAccessToken(user);

      res.status(200).json({
        success: true,
        data: {
          accessToken
        }
      });

    } catch (error) {
      logger.error('Token refresh error:', error);
      
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Invalid refresh token',
            statusCode: 401
          }
        });
      }

      next(error);
    }
  }

  /**
   * Logout user
   */
  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // In a real-world scenario, you might want to implement a token blacklist
      // For now, we'll just send a success response
      logger.info(`User logged out: ${req.user.email}`);

      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      logger.error('Logout error:', error);
      next(error);
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body;

      const user = await User.findOne({ 
        where: { emailVerificationToken: token }
      });
      

      if (!user) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid or expired verification token',
            statusCode: 400
          }
        });
      }

      // Update user
      await user.update({
        isEmailVerified: true,
        emailVerificationToken: null
      });
      

      logger.info(`Email verified for user: ${user.email}`);

      res.status(200).json({
        success: true,
        message: 'Email verified successfully'
      });

    } catch (error) {
      logger.error('Email verification error:', error);
      next(error);
    }
  }

  /**
   * Request password reset
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;

      const user = await User.findOne({ where: { email } });
      

      if (!user) {
        // Don't reveal that user doesn't exist
        return res.status(200).json({
          success: true,
          message: 'If an account with that email exists, we have sent a password reset link.'
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await user.update({
        passwordResetToken: resetToken,
        passwordResetExpiresAt: resetTokenExpiry
      });
      

      // In a real application, you would send an email here
      logger.info(`Password reset requested for: ${email}`);

      res.status(200).json({
        success: true,
        message: 'If an account with that email exists, we have sent a password reset link.'
      });

    } catch (error) {
      logger.error('Forgot password error:', error);
      next(error);
    }
  }

  /**
   * Reset password
   */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, password } = req.body;

      const user = await User.findOne({
        where: {
          passwordResetToken: token,
          passwordResetExpiresAt: {
            [Op.gt]: new Date()
          }
        }
      });
      

      if (!user) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid or expired reset token',
            statusCode: 400
          }
        });
      }

      // Update password and clear reset token
      await user.update({
        password,
        passwordResetToken: null,
        passwordResetExpiresAt: null
      });
      

      logger.info(`Password reset completed for user: ${user.email}`);

      res.status(200).json({
        success: true,
        message: 'Password reset successfully'
      });

    } catch (error) {
      logger.error('Password reset error:', error);
      next(error);
    }
  }

  /**
   * Generate access token
   */
  private generateAccessToken(user: any): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role || 'user'
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(user: any): string {
    return jwt.sign(
      { id: user.id },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );
  }

  /**
   * Remove sensitive fields from user object
   */
  private sanitizeUser(user: any): any {
    const userObj = user.toJSON ? user.toJSON() : user;
    delete userObj.password;
    delete userObj.emailVerificationToken;
    delete userObj.passwordResetToken;
    delete userObj.passwordResetExpiresAt;
    return userObj;
  }
}

