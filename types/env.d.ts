/**
 * 环境变量类型定义
 * 提供完整的环境变量类型支持
 */

declare namespace NodeJS {
  interface ProcessEnv {
    // 应用配置
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: string;
    APP_NAME: string;
    APP_VERSION: string;
    API_PREFIX: string;
    API_VERSION: string;

    // 数据库配置
    DATABASE_HOST: string;
    DATABASE_PORT: string;
    DATABASE_USERNAME: string;
    DATABASE_PASSWORD: string;
    DATABASE_NAME: string;
    DATABASE_CONNECTION_LIMIT: string;
    DATABASE_CONNECT_TIMEOUT: string;
    DATABASE_IDLE_TIMEOUT: string;
    DATABASE_TIMEZONE: string;
    DATABASE_RETRY_ATTEMPTS: string;
    DATABASE_RETRY_DELAY: string;

    // Redis 配置
    REDIS_HOST: string;
    REDIS_PORT: string;
    REDIS_PASSWORD?: string;
    REDIS_DB: string;
    REDIS_CONNECT_TIMEOUT: string;
    REDIS_COMMAND_TIMEOUT: string;
    REDIS_MAX_RETRIES: string;
    REDIS_RETRY_DELAY: string;
    REDIS_LOADING_TIMEOUT: string;
    REDIS_KEEP_ALIVE: string;
    REDIS_KEY_PREFIX: string;

    // JWT 配置
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    JWT_ISSUER: string;

    // HMAC 配置
    HMAC_SECRET: string;
    HMAC_TOLERANCE: string;

    // CORS 配置
    CORS_ORIGIN: string;
    CORS_CREDENTIALS: string;

    // 限流配置
    THROTTLE_TTL: string;
    THROTTLE_LIMIT: string;

    // Socket.IO 配置
    SOCKET_PORT: string;
    SOCKET_CORS_ORIGIN: string;
    SOCKET_PING_TIMEOUT: string;
    SOCKET_PING_INTERVAL: string;
    SOCKET_ADAPTER: string;

    // 日志配置
    LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
    LOG_FORMAT: 'json' | 'simple';
  }
}
