import { Request, Response, NextFunction } from 'express';
import { logger } from '../../../core/utils/logger';


import { User } from '../../../core/database/models/User';
import { Op } from 'sequelize';


interface AuthenticatedRequest extends Request {
  user?: any;
}

export class UserController {

  /**
   * Get current user profile
   */
  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = this.sanitizeUser(req.user);

      res.status(200).json({
        success: true,
        data: user
      });

    } catch (error) {
      logger.error('Get profile error:', error);
      next(error);
    }
  }

  /**
   * Update current user profile
   */
  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { firstName, lastName, email } = req.body;
      const userId = req.user.id;

      // Check if email is being changed and if it's already taken
      if (email && email !== req.user.email) {
        const existingUser = await User.findOne({ 
          where: { 
            email,
            id: { [Op.ne]: userId }
          }
        });
        

        if (existingUser) {
          res.status(400).json({
            success: false,
            error: {
              message: 'Email is already in use',
              statusCode: 400
            }
          });
          return;
        }
      }

      // Update user
      const updateData = {};
      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      if (email) {
        updateData.email = email;
        updateData.isEmailVerified = false; // Reset email verification if email changes
      }

      const updatedUser = await User.findByPk(userId);
      await updatedUser.update(updateData);
      

      logger.info(`Profile updated for user: ${req.user.email}`);

      res.status(200).json({
        success: true,
        data: this.sanitizeUser(updatedUser)
      });

    } catch (error) {
      logger.error('Update profile error:', error);
      next(error);
    }
  }

  /**
   * Get all users (Admin only)
   */
  async getAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string || '';

      const offset = (page - 1) * limit;

      // Build search conditions
      const whereConditions = {};
      if (search) {
        whereConditions[Op.or] = [
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const { count, rows: users } = await User.findAndCountAll({
        where: whereConditions,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
        attributes: { exclude: ['password', 'emailVerificationToken', 'passwordResetToken', 'passwordResetExpiresAt'] }
      });

      

      const totalPages = Math.ceil(count / limit);

      res.status(200).json({
        success: true,
        data: {
          users: users.map(user => this.sanitizeUser(user)),
          pagination: {
            currentPage: page,
            totalPages,
            totalUsers: count,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        }
      });

    } catch (error) {
      logger.error('Get all users error:', error);
      next(error);
    }
  }

  /**
   * Get user by ID (Admin only)
   */
  async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id, {
        attributes: { exclude: ['password', 'emailVerificationToken', 'passwordResetToken', 'passwordResetExpiresAt'] }
      });
      

      if (!user) {
        res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            statusCode: 404
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: this.sanitizeUser(user)
      });

    } catch (error) {
      logger.error('Get user by ID error:', error);
      next(error);
    }
  }

  /**
   * Update user by ID (Admin only)
   */
  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { firstName, lastName, email, isActive, role } = req.body;

      const user = await User.findByPk(id);
      

      if (!user) {
        res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            statusCode: 404
          }
        });
        return;
      }

      // Check if email is being changed and if it's already taken
      if (email && email !== user.email) {
        const existingUser = await User.findOne({ 
          where: { 
            email,
            id: { [Op.ne]: id }
          }
        });
        

        if (existingUser) {
          res.status(400).json({
            success: false,
            error: {
              message: 'Email is already in use',
              statusCode: 400
            }
          });
          return;
        }
      }

      // Update user
      const updateData = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (email !== undefined) updateData.email = email;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (role !== undefined) updateData.role = role;

      await user.update(updateData);
      

      logger.info(`User updated by admin: ${user.email}`);

      res.status(200).json({
        success: true,
        data: this.sanitizeUser(user)
      });

    } catch (error) {
      logger.error('Update user error:', error);
      next(error);
    }
  }

  /**
   * Delete user by ID (Admin only)
   */
  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id);
      

      if (!user) {
        res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            statusCode: 404
          }
        });
        return;
      }

      await user.destroy();
      

      logger.info(`User deleted by admin: ${user.email}`);

      res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });

    } catch (error) {
      logger.error('Delete user error:', error);
      next(error);
    }
  }

  /**
   * Remove sensitive fields from user object
   */
  private sanitizeUser(user: any): any {
    if (!user) return null;
    
    const userObj = user.toJSON ? user.toJSON() : user;
    delete userObj.password;
    delete userObj.emailVerificationToken;
    delete userObj.passwordResetToken;
    delete userObj.passwordResetExpiresAt;
    return userObj;
  }
}

