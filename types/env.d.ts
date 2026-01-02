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
    API_DOMAIN: string;
    SWAGGER_ENABLE: string;

    // 数据库配置
    DATABASE_HOST: string;
    DATABASE_PORT: string;
    DATABASE_USERNAME: string;
    DATABASE_PASSWORD: string;
    DATABASE_NAME: string;
    DATABASE_CONNECTION_LIMIT: string;
    DATABASE_TIMEZONE: string;
    DATABASE_RETRY_ATTEMPTS: string;
    DATABASE_RETRY_DELAY: string;

    // Redis 配置
    REDIS_HOST: string;
    REDIS_PORT: string;
    REDIS_PASSWORD?: string;
    REDIS_DB: string;
    REDIS_KEY_PREFIX: string;
    REDIS_CONNECT_TIMEOUT: string;
    REDIS_COMMAND_TIMEOUT: string;
    REDIS_MAX_RETRIES: string;

    // JWT 配置
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    JWT_REFRESH_EXPIRES_IN: string;

    // 签名验证
    SIGNATURE_ENABLED: string;
    SIGNATURE_SECRET: string;

    // CORS 配置
    CORS_ORIGIN: string;
    CORS_CREDENTIALS: string;

    // 限流配置
    THROTTLE_TTL: string;
    THROTTLE_LIMIT: string;

    // 加密配置
    ENCRYPT_KEY: string;

    // Vault 配置（可选）
    VAULT_ADDR?: string;
    VAULT_TOKEN?: string;
    VAULT_SECRET_PATH?: string;
    VAULT_ROLE_ID?: string;
    VAULT_SECRET_ID?: string;

    // 日志配置
    LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  }
}
