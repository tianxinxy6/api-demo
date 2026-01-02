import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

export interface CacheOptions {
  ttl?: number; // 过期时间（秒）
  prefix?: string; // 键前缀
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redis: Redis;
  private readonly defaultTTL = 3600; // 默认1小时过期

  constructor(private readonly configService: ConfigService) {
    const redisConfig = this.configService.get<RedisOptions>('redis');
    this.redis = new Redis(redisConfig);

    // 监听连接事件
    this.redis.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error', error.stack);
    });

    this.redis.on('close', () => {
      this.logger.warn('Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      this.logger.log('Redis reconnecting...');
    });
  }

  async onModuleInit() {
    // 异步初始化，不阻塞应用启动
    setImmediate(() => {
      this.initializeRedis().catch((error) => {
        this.logger.error('Redis initialization failed', error);
      });
    });
  }

  private async initializeRedis() {
    try {
      this.logger.log('Initializing Redis service...');

      // 记录 Redis 配置信息用于调试
      this.logger.debug('Redis configuration:', {
        host: this.configService.get('redis.host'),
        port: this.configService.get('redis.port'),
        db: this.configService.get('redis.db'),
        status: this.redis.status,
      });

      // 简单的 ping 测试，不等待连接状态
      await this.redis.ping();
      this.logger.log('Redis service initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to initialize Redis service: ${errorMessage}`, errorStack);

      // 不抛出错误，允许应用继续启动
      this.logger.warn('Redis service will continue to attempt connections in the background');
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
    this.logger.log('Redis connection closed');
  }

  /**
   * 获取 Redis 实例
   */
  getClient(): Redis {
    return this.redis;
  }

  /**
   * 设置缓存
   */
  async set(key: string, value: any, options?: CacheOptions): Promise<'OK' | null> {
    const serializedValue = JSON.stringify(value);
    const ttl = options?.ttl ?? this.defaultTTL;

    if (options?.prefix) {
      key = `${options.prefix}:${key}`;
    }

    return await this.redis.setex(key, ttl, serializedValue);
  }

  /**
   * 获取缓存
   */
  async get<T = any>(key: string, prefix?: string): Promise<T | null> {
    if (prefix) {
      key = `${prefix}:${key}`;
    }

    const value = await this.redis.get(key);
    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  }

  /**
   * 删除缓存
   */
  async del(key: string | string[], prefix?: string): Promise<number> {
    const keys = Array.isArray(key) ? key : [key];
    const prefixedKeys = prefix ? keys.map((k) => `${prefix}:${k}`) : keys;

    return await this.redis.del(...prefixedKeys);
  }

  /**
   * 检查键是否存在
   */
  async exists(key: string, prefix?: string): Promise<boolean> {
    if (prefix) {
      key = `${prefix}:${key}`;
    }

    const result = await this.redis.exists(key);
    return result === 1;
  }

  /**
   * 设置过期时间
   */
  async expire(key: string, seconds: number, prefix?: string): Promise<boolean> {
    if (prefix) {
      key = `${prefix}:${key}`;
    }

    const result = await this.redis.expire(key, seconds);
    return result === 1;
  }

  /**
   * 获取剩余过期时间
   */
  async ttl(key: string, prefix?: string): Promise<number> {
    if (prefix) {
      key = `${prefix}:${key}`;
    }

    return await this.redis.ttl(key);
  }

  /**
   * 模糊匹配删除
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      return await this.redis.del(...keys);
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to delete pattern: ${pattern}`, errorStack);
      throw error;
    }
  }

  /**
   * 原子性递增
   */
  async incr(key: string, prefix?: string): Promise<number> {
    try {
      if (prefix) {
        key = `${prefix}:${key}`;
      }

      return await this.redis.incr(key);
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to increment key: ${key}`, errorStack);
      throw error;
    }
  }

  /**
   * 原子性递减
   */
  async decr(key: string, prefix?: string): Promise<number> {
    try {
      if (prefix) {
        key = `${prefix}:${key}`;
      }

      return await this.redis.decr(key);
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to decrement key: ${key}`, errorStack);
      throw error;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'ok' | 'error';
    info: any;
    error?: any;
  }> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const responseTime = Date.now() - start;

      return {
        status: 'ok',
        info: {
          responseTime: `${responseTime}ms`,
          connected: this.redis.status === 'ready',
          host: this.configService.get('redis.host'),
          port: this.configService.get('redis.port'),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: 'error',
        info: {
          connected: false,
          host: this.configService.get('redis.host'),
          port: this.configService.get('redis.port'),
        },
        error: errorMessage,
      };
    }
  }
}
