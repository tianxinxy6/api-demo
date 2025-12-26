import { registerAs } from '@nestjs/config';
import { RedisOptions } from 'ioredis';
import { env, envNumber } from '@/global/env';

export default registerAs('redis', (): RedisOptions => {
  const appName = env('APP_NAME', 'wallet-api');

  return {
    host: env('REDIS_HOST', 'localhost'),
    port: envNumber('REDIS_PORT', 6379),
    password: env('REDIS_PASSWORD', undefined),
    db: envNumber('REDIS_DB', 0),

    // 连接配置
    connectTimeout: envNumber('REDIS_CONNECT_TIMEOUT', 10000),
    commandTimeout: envNumber('REDIS_COMMAND_TIMEOUT', 5000),
    lazyConnect: true,

    // 重试配置
    maxRetriesPerRequest: envNumber('REDIS_MAX_RETRIES', 3),

    // 连接池配置
    family: 4, // IPv4
    keepAlive: 30000, // 30 seconds

    // 关键：添加命名空间前缀，避免不同环境的 Key 碰撞
    keyPrefix: env('REDIS_KEY_PREFIX', `${appName}:`),

    enableOfflineQueue: true,

    // 重连配置
    reconnectOnError: (err) => {
      const targetError = 'READONLY';
      return err.message.includes(targetError);
    },
  };
});
