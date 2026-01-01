import { registerAs } from '@nestjs/config';
import { RedisOptions } from 'ioredis';
import { env, envNumber } from '@/global/env';

export default registerAs('redis', (): RedisOptions => {
  return {
    host: env('REDIS_HOST', 'localhost'),
    port: envNumber('REDIS_PORT', 6379),
    password: env('REDIS_PASSWORD', undefined),
    db: envNumber('REDIS_DB', 0),
    connectTimeout: envNumber('REDIS_CONNECT_TIMEOUT', 10000),
    commandTimeout: envNumber('REDIS_COMMAND_TIMEOUT', 5000),
    maxRetriesPerRequest: envNumber('REDIS_MAX_RETRIES', 3),
    lazyConnect: true,
    enableOfflineQueue: true,
    family: 4,
    keepAlive: 30000,
    reconnectOnError: (err) => err.message.includes('READONLY'),
  };
});
