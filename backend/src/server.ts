import app from './app';
import { logger } from './utils/logger';
import { prisma } from './utils/db';

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// Handle graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  
  // Close database client
  try {
    await prisma.$disconnect();
    logger.info('Database client disconnected.');
  } catch (err) {
    logger.error('Error disconnecting database client', err);
  }

  // Close Express server
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });

  // Force exit after 10s if shutdown hangs
  setTimeout(() => {
    logger.warn('Forcefully exiting after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection at:', promise);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', error);
  // Optional: shut down server if needed depending on exception severity
});
