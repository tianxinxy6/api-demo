import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrderDepositEntity } from '@/entities/order-deposit.entity';
import { OrderWithdrawEntity } from '@/entities/order-withdraw.entity';
import { ChainTokenEntity } from '@/entities/chain-token.entity';
import { UserModule } from '@/modules/user/user.module';

import { DepositService } from './services/deposit.service';
import { WithdrawService } from './services/withdraw.service';
import { DepositController } from './controllers/deposit.controller';
import { WithdrawController } from './controllers/withdraw.controller';
import { SysModule } from '../sys/sys.module';
import { ChainModule } from '../chain/chain.module';

const providers = [DepositService, WithdrawService];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderDepositEntity,
      OrderWithdrawEntity,
      ChainTokenEntity,
    ]),
    UserModule, // 导入UserModule以获取WalletService
    SysModule, // 导入SysModule以获取TokenService
    ChainModule, // 导入ChainModule以获取ChainTokenService
  ],
  controllers: [DepositController, WithdrawController],
  providers: [...providers],
  exports: [...providers],
})
export class OrderModule {}