import { registerAs } from '@nestjs/config';
import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import { env } from '@/global/env';
import { isProd } from '@/global/env';

export default registerAs('logger', (): WinstonModuleOptions => {
  const logLevel = env('LOG_LEVEL', 'info');

  // 简单的控制台格式
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
    // 控制台输出
    new winston.transports.Console({
      level: logLevel,
      format: consoleFormat,
    }),
  ];

  // 生产环境添加文件输出
  if (isProd) {
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    );
  }

  return {
    level: logLevel,
    transports,
    exitOnError: false,
  };
});
