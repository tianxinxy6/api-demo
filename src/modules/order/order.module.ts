import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrderDepositEntity } from '@/entities/order-deposit.entity';
import { OrderWithdrawEntity } from '@/entities/order-withdraw.entity';
import { OrderTransferEntity } from '@/entities/order-transfer.entity';
import { OrderSwapEntity } from '@/entities/order-swap.entity';
import { ChainTokenEntity } from '@/entities/chain-token.entity';
import { UserEntity } from '@/entities/user.entity';
import { UserModule } from '@/modules/user/user.module';

import { DepositService } from './services/deposit.service';
import { WithdrawService } from './services/withdraw.service';
import { TransferService } from './services/transfer.service';
import { SwapService } from './services/swap.service';
import { DepositController } from './controllers/deposit.controller';
import { WithdrawController } from './controllers/withdraw.controller';
import { TransferController } from './controllers/transfer.controller';
import { SwapController } from './controllers/swap.controller';
import { SysModule } from '../sys/sys.module';
import { ChainModule } from '../chain/chain.module';
import { MarketModule } from '../market/market.module';

const providers = [DepositService, WithdrawService, TransferService, SwapService];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderDepositEntity,
      OrderWithdrawEntity,
      OrderTransferEntity,
      OrderSwapEntity,
      ChainTokenEntity,
      UserEntity,
    ]),
    UserModule, // 导入UserModule以获取WalletService
    SysModule, // 导入SysModule以获取TokenService
    ChainModule, // 导入ChainModule以获取ChainTokenService
    MarketModule, // 导入MarketModule以获取实时价格
  ],
  controllers: [DepositController, WithdrawController, TransferController, SwapController],
  providers: [...providers],
  exports: [...providers],
})
export class OrderModule {}
