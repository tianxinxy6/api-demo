import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { UserLoginLogService } from './services/user-login-log.service';
import { TransactionModule } from '@/modules/transaction/transaction.module';
import { UserLoginLogEntity } from '@/entities/user-login-log.entity';

const providers = [AuthService, TokenService, TokenBlacklistService, UserLoginLogService];
const strategies = [JwtStrategy];

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([UserLoginLogEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const { secret, expiresIn } = configService.get('jwt')!;

        return {
          global: true,
          secret: secret,
          signOptions: {
            expiresIn,
          },
        };
      },
      inject: [ConfigService],
    }),
    UserModule, // 同时获取 UserService 和 RateLimitService
    TransactionModule, // 导入以获取 AuditLogService
  ],
  controllers: [AuthController],
  providers: [...providers, ...strategies],
  exports: [...providers],
})
export class AuthModule {}
