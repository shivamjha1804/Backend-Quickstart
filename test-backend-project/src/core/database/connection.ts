import { Sequelize } from 'sequelize';
import { config } from '../../config';
import { logger } from '../utils/logger';

let sequelize: Sequelize;

export async function connectDB(): Promise<void> {
  try {



    // Test the connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Sync models in development
    if (config.server.env === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('Database models synchronized');
    }

  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
}

export async function closeDB(): Promise<void> {
  try {
    if (sequelize) {
      await sequelize.close();
      logger.info('Database connection closed');
    }
  } catch (error) {
    logger.error('Error closing database connection:', error);
    throw error;
  }
}

export { sequelize };

