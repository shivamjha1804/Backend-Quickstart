import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { logger } from '../utils/logger';

export class TokenManager {
  async generateAccessToken(user: any): Promise<string> {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role || 'user'
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn
    });
  }

  async verifyAccessToken(token: string): Promise<any> {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      logger.error('Token verification error', error);
      return null;
    }
  }
}

export const tokenManager = new TokenManager();

