/**
 * Logger utility for the HL7 Engine
 *
 * Provides a consistent logging interface using winston.
 */

import * as winston from 'winston';

/**
 * Create a logger instance with a given label.
 *
 * @param label - Label to identify the source module
 * @returns winston Logger instance
 */
export function createLogger(label: string): winston.Logger {
  return winston.createLogger({
    level: process.env.HL7_LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.label({ label }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, label: lbl, message, ...meta }) => {
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${lbl}] ${level}: ${message}${metaStr}`;
      })
    ),
    transports: [
      new winston.transports.Console({
        silent: process.env.NODE_ENV === 'test',
      }),
    ],
  });
}
