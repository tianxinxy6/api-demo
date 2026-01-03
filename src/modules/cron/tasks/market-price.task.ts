import { MarketService } from '@/modules/market/services/market.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

/**
 * 市场价格定时任务
 * 每5秒更新一次交易对价格
 */
@Injectable()
export class MarketPriceTask {
  private readonly logger = new Logger(MarketPriceTask.name);

  constructor(private readonly marketService: MarketService) {}

  /**
   * 每5秒更新价格
   */
  @Cron('*/5 * * * * *')
  async updatePrices() {
    await this.marketService.updatePrices('USDT');
  }
}
