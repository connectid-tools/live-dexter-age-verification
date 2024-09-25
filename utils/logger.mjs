import express from 'express';
const router = express.Router();

import { createLogger, format, transports } from 'winston';

export const getLogger = (logLevel: 'debug' | 'info' = 'info') => {
  const logFormat = format.printf(({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`);
  return createLogger({
    level: logLevel,
    format: format.combine(format.colorize(), format.timestamp(), logFormat),
    transports: [new transports.Console()],
  });
};

// Default export for the router
export default router;
