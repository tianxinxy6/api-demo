import { registerAs } from '@nestjs/config';
import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import { env } from '@/global/env';

export default registerAs('logger', (): WinstonModuleOptions => {
  const logLevel = env('LOG_LEVEL', 'info');
  const isProduction = env('NODE_ENV') === 'production';

  const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, context }) => {
      const ctx = context
        ? `[${typeof context === 'string' ? context : JSON.stringify(context)}] `
        : '';
      return `${String(timestamp)} ${String(level)}: ${ctx}${String(message)}`;
    }),
  );

  const transports: winston.transport[] = [
    new winston.transports.Console({ level: logLevel, format: consoleFormat }),
  ];

  if (isProduction) {
    const fileFormat = winston.format.combine(winston.format.timestamp(), winston.format.json());
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: fileFormat,
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: fileFormat,
      }),
    );
  }

  return { level: logLevel, transports, exitOnError: false };
});
