import { Module } from '@nestjs/common';
import { MarketService } from './services/market.service';
import { MarketController } from './controllers/market.controller';
import { SysModule } from '../sys/sys.module';

/**
 * 市场行情模块
 * 提供系统支持的代币实时价格查询功能
 *
 * 注意: HttpModule 已通过 SharedModule 全局注入，无需重复导入
 */
@Module({
  imports: [
    SysModule, // 导入 SysModule 以使用 TokenService 和 TokenPriceService
  ],
  controllers: [MarketController],
  providers: [MarketService],
  exports: [MarketService],
})
export class MarketModule {}
