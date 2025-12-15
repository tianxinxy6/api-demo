import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { env, envNumber } from '@/global/env';
import { isDev, isProd } from '@/global/env';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'mysql',
    host: env('DATABASE_HOST', 'localhost'),
    port: envNumber('DATABASE_PORT', 3306),
    username: env('DATABASE_USERNAME', 'root'),
    password: env('DATABASE_PASSWORD', ''),
    database: env('DATABASE_NAME', 'store_chat'),

    // 连接池配置
    extra: {
      connectionLimit: envNumber('DATABASE_CONNECTION_LIMIT', 10),
      charset: 'utf8mb4',
    },

    // 实体配置
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],

    // 开发环境配置
    // 如果为true，自动载入的模型将同步（默认：false）
    // 警告：设置 synchronize: true 不能被用于生产环境，否则您可能会丢失生产环境数据
    synchronize: isDev && !isProd, // 仅在开发环境启用自动同步
    logging: isDev ? ['error', 'warn'] : ['error'], // 生产环境只记录错误

    // 生产环境配置
    ssl: isProd ? { rejectUnauthorized: false } : false,

    // 自动加载实体
    autoLoadEntities: true,

    // 时区配置
    timezone: env('DATABASE_TIMEZONE', '+08:00'),

    // 重试配置
    retryAttempts: envNumber('DATABASE_RETRY_ATTEMPTS', 3),
    retryDelay: envNumber('DATABASE_RETRY_DELAY', 3000),
  }),
);
