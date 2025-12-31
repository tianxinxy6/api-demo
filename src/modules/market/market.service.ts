import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TokenService } from '@/modules/sys/services/token.service';
import { TokenPriceService } from '@/modules/sys/services/token-price.service';
import { BusinessException } from '@/common/exceptions/biz.exception';
import { ErrorCode } from '@/constants';

/**
 * 市场行情服务
 * 职责：
 * 1. 对接 Binance API 获取实时价格
 * 2. 定时更新价格到数据库
 */
@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);
  private readonly BINANCE_API_URL = 'https://api.binance.com/api/v3/ticker/price';
  private readonly DEFAULT_QUOTE = 'USDT';
  private readonly REQUEST_TIMEOUT = 5000;

  constructor(
    private readonly httpService: HttpService,
    private readonly tokenService: TokenService,
    private readonly priceService: TokenPriceService,
  ) {}

  /**
   * 从 Binance 获取价格数据
   * @private
   */
  private async fetchBinancePrices(symbol?: string): Promise<IPriceData[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<IPriceData | IPriceData[]>(
          this.BINANCE_API_URL,
          {
            params: symbol ? { symbol: symbol.toUpperCase() } : undefined,
            timeout: this.REQUEST_TIMEOUT,
          },
        ),
      );

      return Array.isArray(data) ? data : [data];
    } catch (error) {
      this.logger.error(`Fetch Binance prices failed: ${error.message}`);
      throw new BusinessException(ErrorCode.ErrMarketApiTimeout);
    }
  }

  /**
   * 构建交易对符号
   * @private
   */
  private buildSymbol(tokenCode: string, quote: string = this.DEFAULT_QUOTE): string {
    return `${tokenCode.toUpperCase()}${quote.toUpperCase()}`;
  }

  // ==================== 公共方法 ====================

  /**
   * 获取单个交易对实时价格
   */
  async getPrice(symbol: string): Promise<IPriceData> {
    if (!symbol?.trim()) {
      throw new BusinessException(ErrorCode.ErrMarketSymbolInvalid);
    }

    try {
      const prices = await this.fetchBinancePrices(symbol.trim());
      const IPriceData = prices[0];

      if (!IPriceData?.price) {
        throw new BusinessException(ErrorCode.ErrMarketPriceUnavailable);
      }

      return IPriceData;
    } catch (error) {
      this.logger.error(`Get real-time price for ${symbol} failed: ${error.message}`);
      if (error instanceof BusinessException) {
        throw error;
      }
      throw new BusinessException(ErrorCode.ErrMarketPriceUnavailable);
    }
  }

  /**
   * 批量获取实时价格
   */
  async getPrices(symbols: string[]): Promise<IPriceData[]> {
    if (!symbols?.length) {
      return [];
    }

    try {
      const allPrices = await this.fetchBinancePrices();
      const upperSymbols = symbols.map(s => s.toUpperCase());
      return allPrices.filter(item => upperSymbols.includes(item.symbol));
    } catch (error) {
      this.logger.error(`Batch get real-time prices failed: ${error.message}`);
      if (error instanceof BusinessException) {
        throw error;
      }
      throw new BusinessException(ErrorCode.ErrMarketPriceUnavailable);
    }
  }

  /**
   * 定时更新系统代币价格
   */
  async updatePrices(quote: string = this.DEFAULT_QUOTE): Promise<void> {
    try {
      const tokens = await this.tokenService.getAllTokens();
      
      if (!tokens?.length) {
        this.logger.warn('No tokens configured in system');
        return;
      }

      // 过滤出需要更新的代币（排除计价币种本身）
      const validTokens = tokens.filter(t => 
        t.code.toUpperCase() !== quote.toUpperCase()
      );

      if (!validTokens.length) {
        return;
      }

      // 批量获取所有价格
      const allPrices = await this.fetchBinancePrices();
      const priceMap = new Map(allPrices.map(p => [p.symbol, p.price]));

      // 构建更新数据
      const updates = validTokens
        .map(token => {
          const symbol = this.buildSymbol(token.code, quote);
          const price = priceMap.get(symbol);

          if (!price) {
            return null;
          }

          return {
            symbol,
            token: token.code.toUpperCase(),
            quote: quote.toUpperCase(),
            price,
          };
        })
        .filter(Boolean);

      if (updates.length) {
        await this.priceService.batchUpsert(updates);
      }
    } catch (error) {
      this.logger.error(`Update prices failed: ${error.message}`, error.stack);
    }
  }
}
