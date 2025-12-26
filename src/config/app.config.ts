import { registerAs } from '@nestjs/config';
import { env, envBoolean, envNumber } from '@/global/env';

export default registerAs('app', () => ({
  nodeEnv: env('NODE_ENV', 'development'),
  port: envNumber('PORT', 3000),
  name: env('APP_NAME', 'chain-wallet'),
  version: env('APP_VERSION', '1.0.0'),
  encryptKey: env('ENCRYPT_KEY', 'default_encryption_key_please_change'),
  swagger: {
    enable: envBoolean('SWAGGER_ENABLE', false),
  },
  api: {
    prefix: env('API_PREFIX', 'api'),
    version: env('API_VERSION', ''),
    domain: env('API_DOMAIN', 'http://localhost:3000'),
  },
  cors: {
    origin: env('CORS_ORIGIN', '*'),
    credentials: envBoolean('CORS_CREDENTIALS', true),
  },
  throttle: {
    ttl: envNumber('THROTTLE_TTL', 60),
    limit: envNumber('THROTTLE_LIMIT', 10),
  },
}));
