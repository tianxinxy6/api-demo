import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import KeyvRedis from '@keyv/redis';
import { Keyv } from 'keyv';
import { CacheService } from './cache.service';
import { RedisService } from './redis.service';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisConfig = configService.get('redis');
        const host = redisConfig?.host ?? 'localhost';
        const port = redisConfig?.port ?? 6379;
        const password = redisConfig?.password;
        const db = redisConfig?.db ?? 0;

        // 构建 Redis 连接 URL
        let redisUrl = `redis://${host}:${port}`;
        if (password) {
          redisUrl = `redis://:${password}@${host}:${port}`;
        }
        if (db) {
          redisUrl += `/${db}`;
        }

        return {
          stores: [
            new Keyv({
              store: new KeyvRedis(redisUrl),
              namespace: undefined, // Keyv 使用 namespace 作为 key 前缀
              ttl: 3600 * 1000, // 默认1小时（毫秒）
            }),
          ],
        };
      },
    }),
  ],
  providers: [CacheService, RedisService],
  exports: [CacheModule, CacheService, RedisService],
})
export class AppCacheModule {}
