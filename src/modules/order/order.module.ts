import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrderDepositEntity } from '@/entities/order-deposit.entity';
import { ChainTokenEntity } from '@/entities/chain-token.entity';
import { UserModule } from '@/modules/user/user.module';

import { DepositService } from './services/deposit.service';
import { DepositController } from './deposit.controller';
import { SysModule } from '../sys/sys.module';

const providers = [DepositService];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderDepositEntity,
      ChainTokenEntity,
    ]),
    UserModule, // 导入UserModule以获取WalletService
    SysModule,
  ],
  controllers: [DepositController],
  providers: [...providers],
  exports: [...providers],
})
export class OrderModule {}