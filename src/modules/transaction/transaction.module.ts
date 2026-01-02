import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrderModule } from '@/modules/order/order.module';
import { ChainModule } from '@/modules/chain/chain.module';
import { UserModule } from '@/modules/user/user.module';
import { EthScanService } from './services/scan/eth.service';
import { TronScanService } from './services/scan/tron.service';
import { TronConfirmService } from './services/confirm/tron.service';
import { EthConfirmService } from './services/confirm/eth.service';
import { EthCollectService } from './services/collect/eth.service';
import { TronCollectService } from './services/collect/tron.service';
import { SharedModule } from '@/shared/shared.module';
import { SysModule } from '../sys/sys.module';
import { TransactionEthEntity } from '@/entities/txs/deposit/transaction-eth.entity';
import { TransactionTronEntity } from '@/entities/txs/deposit/transaction-tron.entity';
import { TransactionCollectEthEntity } from '@/entities/txs/collect/transaction-eth.entity';
import { TransactionCollectTronEntity } from '@/entities/txs/collect/transaction-tron.entity';
import { TransactionOutEthEntity } from '@/entities/txs/withdraw/transaction-eth.entity';
import { TransactionOutTronEntity } from '@/entities/txs/withdraw/transaction-tron.entity';
import { EthWithdrawService } from './services/withdraw/eth.service';
import { TronWithdrawService } from './services/withdraw/tron.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TransactionEthEntity,
      TransactionTronEntity,
      TransactionCollectEthEntity,
      TransactionCollectTronEntity,
      TransactionOutEthEntity,
      TransactionOutTronEntity,
    ]),
    OrderModule,
    ChainModule,
    UserModule,
    SharedModule,
    SysModule,
  ],
  providers: [
    // 扫描服务
    EthScanService,
    TronScanService,
    // 确认服务
    EthConfirmService,
    TronConfirmService,
    // 归集服务
    EthCollectService,
    TronCollectService,
    // 提现服务
    EthWithdrawService,
    TronWithdrawService,
  ],
  exports: [
    // 扫描服务
    EthScanService,
    TronScanService,
    // 确认服务
    EthConfirmService,
    TronConfirmService,
    // 归集服务
    EthCollectService,
    TronCollectService,
    // 提现服务
    EthWithdrawService,
    TronWithdrawService,
  ],
})
export class TransactionModule {}
