import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

const providers = [TokenService];
const strategies = [JwtStrategy];

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const { secret, expires } =
          configService.get('jwt')!;

        return {
          secret: secret,
          signOptions: {
            expiresIn: `${expires}s`,
          },
        };
      },
      inject: [ConfigService],
    }),
    UserModule,
  ],
  controllers: [AuthController],
  providers: [
    ...providers,
    ...strategies,
  ],
  exports: [...providers],
})
export class AuthModule {}
