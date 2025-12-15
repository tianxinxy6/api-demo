import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from '@/entities/user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AppCacheModule } from '@/shared/cache/cache.module';

const providers = [UserService];

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    AppCacheModule,
  ],
  controllers: [UserController],
  providers: [...providers],
  exports: [...providers],
})
export class UserModule {}
