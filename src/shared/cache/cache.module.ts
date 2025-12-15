import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import { RedisService } from './redis.service';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisConfig = configService.get('redis');
        return {
          store: 'redis',
          host: redisConfig?.host ?? 'localhost',
          port: redisConfig?.port ?? 6379,
          password: redisConfig?.password,
          db: redisConfig?.db ?? 0,
          keyPrefix: 'app:cache:',
          ttl: 3600, // 默认1小时
        };
      },
    }),
  ],
  providers: [CacheService, RedisService],
  exports: [CacheModule, CacheService, RedisService],
})
export class AppCacheModule {}
