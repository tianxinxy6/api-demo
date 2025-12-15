import {
  SetMetadata,
  createParamDecorator,
  ExecutionContext,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';

/**
 * 缓存键装饰器 - 指定自定义缓存键名
 * @param key - 自定义缓存键
 */
export const CacheKey = (key: string) => SetMetadata('cache_key', key);

/**
 * 缓存 TTL 装饰器 - 指定缓存过期时间
 * @param ttl - 过期时间（毫秒）
 */
export const CacheTTL = (ttl: number) => SetMetadata('cache_ttl', ttl);

/**
 * 缓存装饰器 - 开启方法级别的自动缓存（GET 请求）
 * @param ttl - 可选的过期时间（毫秒），如果不指定则使用全局默认值
 *
 * 使用示例：
 * @Get('users')
 * @Cached(60000) // 缓存 60 秒
 * async getUsers() {
 *   return this.userService.findAll();
 * }
 */
export const Cached = (ttl?: number) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    UseInterceptors(CacheInterceptor)(target, propertyKey, descriptor);
    if (ttl) {
      SetMetadata('cache_ttl', ttl)(target, propertyKey, descriptor);
    }
    return descriptor;
  };
};

/**
 * 缓存参数装饰器 - 注入缓存服务实例
 *
 * 使用示例：
 * async someMethod(@InjectCache() cacheService: CacheService) {
 *   const value = await cacheService.get('mykey');
 * }
 */
export const InjectCache = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    // 这个装饰器主要用于类型提示，实际注入通过构造器完成
    return null;
  },
);

/**
 * 缓存前缀装饰器 - 为整个控制器设置缓存键前缀
 * @param prefix - 缓存键前缀
 *
 * 使用示例：
 * @Controller('users')
 * @CachePrefix('user:')
 * export class UserController {
 *   // 所有方法的缓存键都会加上 'user:' 前缀
 * }
 */
export const CachePrefix = (prefix: string) =>
  SetMetadata('cache_prefix', prefix);
