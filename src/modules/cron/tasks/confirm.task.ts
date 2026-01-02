import { Injectable, Logger } from '@nestjs/common';
import { EthConfirmService } from '@/modules/transaction/services/confirm/eth.service';
import { TronConfirmService } from '@/modules/transaction/services/confirm/tron.service';
import { Cron } from '@nestjs/schedule';

/**
 * 交易确认定时任务
 */
@Injectable()
export class ConfirmTask {
  private readonly logger = new Logger(ConfirmTask.name);

  constructor(
    private readonly ethConfirm: EthConfirmService,
    private readonly tronConfirm: TronConfirmService,
  ) {}

  /**
   * ETH 交易确认 - 每30秒执行
   */
  @Cron('*/30 * * * * *')
  async confirmEth(): Promise<void> {
    await this.ethConfirm.confirm();
  }

  /**
   * TRON 交易确认 - 每15秒执行
   */
  @Cron('*/15 * * * * *')
  async confirmTron(): Promise<void> {
    await this.tronConfirm.confirm();
  }

  /**
   * ETH 归集 - 每分钟执行
   */
  @Cron('0 * * * * *')
  async collectEth(): Promise<void> {
    await this.ethConfirm.collect();
  }

  /**
   * TRON 归集 - 每分钟执行
   */
  @Cron('0 * * * * *')
  async collectTron(): Promise<void> {
    await this.tronConfirm.collect();
  }
}
