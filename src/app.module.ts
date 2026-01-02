import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

import config from '@/config';
import { AllExceptionsFilter } from './common/filters/any-exception.filter';
import { IdempotenceInterceptor } from './common/interceptors/idempotence.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { SignatureGuard } from './common/guards/signature.guard';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './health/health.module';
import { ChainModule } from './modules/chain/chain.module';
import { UserModule } from './modules/user/user.module';
import { OrderModule } from './modules/order/order.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { TaskModule } from './modules/cron/cron.module';
import { SysModule } from './modules/sys/sys.module';
import { MarketModule } from './modules/market/market.module';
import { TestModule } from './modules/test/test.module';
import { ValidationPipe } from './common/pipes/validation.pipe';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      cache: true,
      // 指定多个 env 文件时，第一个优先级最高
      envFilePath: ['.env.local', '.env', `.env.${process.env.NODE_ENV}`],
      load: [...Object.values(config)],
    }),

    SharedModule,
    AuthModule,
    HealthModule,
    UserModule,
    ChainModule,
    OrderModule,
    TransactionModule,
    TaskModule,
    SysModule,
    MarketModule,
    // TestModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },

    { provide: APP_PIPE, useClass: ValidationPipe },

    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    {
      provide: APP_INTERCEPTOR,
      useFactory: () => new TimeoutInterceptor(15 * 1000),
    },
    { provide: APP_INTERCEPTOR, useClass: IdempotenceInterceptor },

    // 注意：JwtAuthGuard 依赖于 TokenService（来自 AuthModule）
    // 作为全局 Guard 使用时，NestJS 会自动从已导入的模块中解析依赖
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // 签名验证守卫（需要先通过 JWT 认证）
    // 注意：Guard 的执行顺序与注册顺序相同
    { provide: APP_GUARD, useClass: SignatureGuard },

    {
      provide: 'APP_CONFIG',
      useFactory: (configService: ConfigService) => configService.get('app'),
      inject: [ConfigService],
    },
  ],
})
export class AppModule {}
