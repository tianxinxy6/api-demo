import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

/**
 * 缓存配置选项
 */
export interface CacheOptions {
  ttl?: number; // 过期时间（毫秒）
  prefix?: string; // 键前缀
}

/**
 * 缓存服务 - 基于 @nestjs/cache-manager 的封装
 * 支持 Redis 和其他存储后端，提供统一的缓存操作接口
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultPrefix = 'cache:';

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * 生成完整的缓存键名（包含前缀）
   */
  private generateKey(key: string, prefix?: string): string {
    const finalPrefix = prefix || this.defaultPrefix;
    return `${finalPrefix}${key}`;
  }

  /**
   * 从缓存获取值
   * @param key - 缓存键
   * @param options - 缓存选项
   * @returns 缓存的值或 null
   */
  async get<T = any>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const cacheKey = this.generateKey(key, options?.prefix);
      const value = await this.cacheManager.get<T>(cacheKey);
      return value || null;
    } catch (error) {
      this.logger.error(`Failed to get cache key: ${key}`, error);
      return null;
    }
  }

  /**
   * 设置缓存值
   * @param key - 缓存键
   * @param value - 缓存值
   * @param options - 缓存选项（ttl: 毫秒）
   */
  async set<T = any>(
    key: string,
    value: T,
    options?: CacheOptions,
  ): Promise<void> {
    try {
      const cacheKey = this.generateKey(key, options?.prefix);
      await this.cacheManager.set(cacheKey, value, options?.ttl);
    } catch (error) {
      this.logger.error(`Failed to set cache key: ${key}`, error);
    }
  }

  /**
   * 删除缓存
   * @param key - 缓存键
   * @param options - 缓存选项
   */
  async del(key: string, options?: CacheOptions): Promise<void> {
    try {
      const cacheKey = this.generateKey(key, options?.prefix);
      await this.cacheManager.del(cacheKey);
    } catch (error) {
      this.logger.error(`Failed to delete cache key: ${key}`, error);
    }
  }

  /**
   * 批量删除缓存
   * @param keys - 缓存键数组
   * @param options - 缓存选项
   */
  async delMany(keys: string[], options?: CacheOptions): Promise<void> {
    try {
      const promises = keys.map((key) => this.del(key, options));
      await Promise.all(promises);
    } catch (error) {
      this.logger.error('Failed to delete multiple cache keys', error);
    }
  }

  /**
   * 清空所有缓存
   * @warning 谨慎使用，会清空所有缓存数据
   */
  async clear(): Promise<void> {
    try {
      // 获取所有存储并清空
      if (
        'stores' in this.cacheManager &&
        Array.isArray(this.cacheManager.stores)
      ) {
        await Promise.all(
          this.cacheManager.stores.map((store) =>
            store.clear?.().catch(() => null),
          ),
        );
      }
    } catch (error) {
      this.logger.error('Failed to clear cache', error);
    }
  }

  /**
   * 获取或设置缓存（缓存穿透保护）
   * 如果缓存不存在，则执行 factory 函数获取值并缓存
   * @param key - 缓存键
   * @param factory - 生成缓存值的工厂函数
   * @param options - 缓存选项
   * @returns 缓存的值或 factory 生成的新值
   */
  async getOrSet<T = any>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    try {
      // 先尝试从缓存获取
      const cached = await this.get<T>(key, options);
      if (cached !== null) {
        return cached;
      }

      // 缓存不存在，执行 factory 函数
      const value = await factory();

      // 将结果缓存
      await this.set(key, value, options);

      return value;
    } catch (error) {
      this.logger.error(`Failed in getOrSet for key: ${key}`, error);
      // 失败时直接执行 factory 函数，返回新值而不缓存
      return factory();
    }
  }

  /**
   * 检查缓存是否存在
   * @param key - 缓存键
   * @param options - 缓存选项
   * @returns 缓存是否存在
   */
  async has(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const value = await this.get(key, options);
      return value !== null;
    } catch (error) {
      this.logger.error(
        `Failed to check cache existence for key: ${key}`,
        error,
      );
      return false;
    }
  }

  /**
   * 获取缓存管理器实例（用于高级操作）
   */
  getManager(): Cache {
    return this.cacheManager;
  }
}
