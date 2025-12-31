import { Module } from '@nestjs/common';
import { ScanTask } from './tasks/scan.task';
import { ConfirmTask } from './tasks/confirm.task';
import { WithdrawTask } from './tasks/withdraw.task';
import { MarketPriceTask } from './tasks/market-price.task';
import { TransactionModule } from '../transaction/transaction.module';
import { MarketModule } from '../market/market.module';

/**
 * 任务模块 - 管理定时任务
 */
@Module({
  imports: [
    TransactionModule,
    MarketModule,
  ],
  providers: [
    // 定时任务
    ScanTask,
    ConfirmTask,
    WithdrawTask,
    MarketPriceTask,
  ],
})
export class TaskModule {}