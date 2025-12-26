import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ChainService } from './services/chain.service';
import { TokenService } from './services/token.service';
import { ChainEntity } from '@/entities/chain.entity';
import { ChainTokenEntity } from '@/entities/chain-token.entity';
import { SharedModule } from '@/shared/shared.module';
import { ChainController } from './chain.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChainEntity, 
      ChainTokenEntity,
    ]), 
    ConfigModule,
    HttpModule,
    SharedModule,
  ],
  controllers: [ChainController],
  providers: [
    ChainService,
    TokenService,
  ],
  exports: [
    // 导出核心服务供其他模块使用
    ChainService,
    TokenService,
  ],
})
export class ChainModule {}
