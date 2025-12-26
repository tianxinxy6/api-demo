import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScanTask } from './tasks/scan.task';
import { ConfirmTask } from './tasks/confirm.task';
import { TransactionModule } from '../transaction/transaction.module';

/**
 * 任务模块 - 管理定时任务
 * 注意：ScheduleModule.forRoot() 已在 SharedModule 中全局注册，无需重复导入
 */
@Module({
  imports: [
    ConfigModule,
    TransactionModule,
  ],
  providers: [
    // 定时任务
    ScanTask,
    ConfirmTask,
  ],
})
export class TaskModule {}