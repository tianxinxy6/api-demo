import { ClassSerializerInterceptor, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ThrottlerGuard } from '@nestjs/throttler'

import config from '@/config'
import { AllExceptionsFilter } from './common/filters/any-exception.filter'
import { IdempotenceInterceptor } from './common/interceptors/idempotence.interceptor'
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor'
import { TransformInterceptor } from './common/interceptors/transform.interceptor'
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard'
import { SharedModule } from './shared/shared.module'
import { AuthModule } from './modules/auth/auth.module'
import { HealthModule } from './modules/health/health.module'


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      cache: true,
      // 指定多个 env 文件时，第一个优先级最高
      envFilePath: ['.env.local', `.env.${process.env.NODE_ENV}`, '.env'],
      load: [...Object.values(config)],
    }),

    SharedModule,
    AuthModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },

    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useFactory: () => new TimeoutInterceptor(15 * 1000) },
    { provide: APP_INTERCEPTOR, useClass: IdempotenceInterceptor },

    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    {
      provide: 'APP_CONFIG',
      useFactory: (configService: ConfigService) => configService.get('app'),
      inject: [ConfigService],
    },
  ],
})
export class AppModule { }
