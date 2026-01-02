import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ChainService } from './services/chain.service';
import { ChainTokenService } from './services/token.service';
import { ChainEntity } from '@/entities/chain.entity';
import { ChainTokenEntity } from '@/entities/chain-token.entity';
import { SharedModule } from '@/shared/shared.module';
import { ChainController } from './chain.controller';

const providers = [ChainService, ChainTokenService];

@Module({
  imports: [
    TypeOrmModule.forFeature([ChainEntity, ChainTokenEntity]),
    ConfigModule,
    HttpModule,
    SharedModule,
  ],
  controllers: [ChainController],
  providers,
  exports: providers,
})
export class ChainModule {}
