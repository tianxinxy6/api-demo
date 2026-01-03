import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import { ConfigService } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { FastifyRequest } from 'fastify';

import { AppCacheModule } from './cache/cache.module';
import { DatabaseModule } from './database/database.module';
import { AppConfigService } from './services/config.service';
import { AddressMgrService } from './services/wallet.service';
import { VaultService } from './services/vault.service';

@Global()
@Module({
  imports: [
    // 日志模块
    WinstonModule.forRootAsync({
      useFactory: (configService: ConfigService) => configService.get('logger'),
      inject: [ConfigService],
    }),
    // 启用 CLS 上下文
    ClsModule.forRoot({
      global: true,
      // https://github.com/Papooch/nestjs-cls/issues/92
      interceptor: {
        mount: true,
        setup: (cls, context) => {
          const req = context
            .switchToHttp()
            .getRequest<FastifyRequest<{ Params: { id?: string } }>>();
          if (req.params?.id && req.body) {
            // 供自定义参数验证器(UniqueConstraint)使用
            cls.set('operateId', Number.parseInt(req.params.id));
          }
        },
      },
    }),
    // http
    HttpModule.register({ timeout: 5000 }),
    // schedule
    ScheduleModule.forRoot(),
    // rate limit
    ThrottlerModule.forRoot([
      {
        limit: 20,
        ttl: 60000,
      },
    ]),
    // cache
    AppCacheModule,
    // database
    DatabaseModule,
  ],
  providers: [AppConfigService, AddressMgrService, VaultService],
  exports: [
    HttpModule,
    AppCacheModule,
    DatabaseModule,
    VaultService,
    AppConfigService,
    AddressMgrService,
  ],
})
export class SharedModule {}
