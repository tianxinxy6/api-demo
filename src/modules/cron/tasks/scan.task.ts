import { EthScanService } from '@/modules/transaction/services/scan/eth.service';
import { TronScanService } from '@/modules/transaction/services/scan/tron.service';
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class ScanTask {
  constructor(
    private readonly ethScanService: EthScanService,
    private readonly tronScanService: TronScanService,
  ) {}

  /**
   * ETH 交易监控 - 每6秒执行一次
   */
  @Cron('*/13 * * * * *')
  async scanEth(): Promise<void> {
    await this.ethScanService.scanBlock();
  }

  /**
   * TRON 交易监控 - 每3秒执行一次
   */
  @Cron('*/3 * * * * *')
  async scanTron(): Promise<void> {
    await this.tronScanService.scanBlock();
  }
}
