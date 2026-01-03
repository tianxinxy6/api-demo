import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { MarketService } from '../services/market.service';
import { TokenPriceService } from '@/modules/sys/services/token-price.service';
import { TokenPriceResponse } from '../vo';
import { Public } from '@/common/decorators/public.decorator';
import { BusinessException } from '@/common/exceptions/biz.exception';
import { ErrorCode } from '@/constants';

/**
 * 市场行情控制器
 */
@ApiTags('Market - 市场行情')
@Controller({ path: 'market', version: '1' })
export class MarketController {
  constructor(
    private readonly marketService: MarketService,
    private readonly priceService: TokenPriceService,
  ) {}

  /**
   * 获取系统支持的所有代币价格列表
   */
  @Public()
  @Get('prices')
  @ApiOperation({ summary: '获取所有代币价格列表' })
  @ApiResponse({
    status: 200,
    type: [TokenPriceResponse],
    description: '代币价格列表',
  })
  async getAllPrices(): Promise<TokenPriceResponse[]> {
    const prices = await this.priceService.getAllPrices();
    return prices.map(
      (price) =>
        new TokenPriceResponse({
          symbol: price.symbol,
          token: price.token,
          quote: price.quote,
          price: price.price,
          priceAt: price.priceAt,
        }),
    );
  }

  /**
   * 获取指定交易对的实时价格
   */
  @Public()
  @Get('prices/:symbol')
  @ApiOperation({ summary: '获取指定交易对的实时价格' })
  @ApiParam({ name: 'symbol', description: '交易对符号', example: 'BTCUSDT' })
  @ApiResponse({ status: 200, description: '交易对价格' })
  @ApiResponse({ status: 404, description: '价格数据不存在' })
  async getPrice(@Param('symbol') symbol: string): Promise<IPriceData> {
    if (!symbol?.trim()) {
      throw new BusinessException(ErrorCode.ErrMarketSymbolInvalid);
    }

    const price = await this.marketService.getPrice(symbol.trim());

    if (!price) {
      throw new BusinessException(ErrorCode.ErrMarketPriceNotFound);
    }

    return price;
  }
}
