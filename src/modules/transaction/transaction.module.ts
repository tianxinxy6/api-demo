import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TransactionEthEntity } from '@/entities/transaction-eth.entity';
import { TransactionTronEntity } from '@/entities/transaction-tron.entity';
import { TransactionCollectEthEntity } from '@/entities/transaction-collect-eth.entity';
import { TransactionCollectTronEntity } from '@/entities/transaction-collect-tron.entity';
import { ChainEntity } from '@/entities/chain.entity';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TransactionEthEntity,
      TransactionTronEntity,
      TransactionCollectEthEntity,
      TransactionCollectTronEntity,
      ChainEntity
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
  ],
})
export class TransactionModule {}
