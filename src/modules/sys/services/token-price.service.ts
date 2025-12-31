import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenPriceEntity } from '@/entities/token-price.entity';

/**
 * 代币价格服务
 * 职责：
 * 1. 存储和管理代币价格数据
 * 2. 支持批量价格更新（供 MarketService 调用）
 * 3. 提供价格查询接口
 */
@Injectable()
export class TokenPriceService {
  private readonly logger = new Logger(TokenPriceService.name);

  constructor(
    @InjectRepository(TokenPriceEntity)
    private readonly priceRepository: Repository<TokenPriceEntity>,
  ) {}

  /**
   * 批量更新交易对价格
   */
  async batchUpsert(prices: Array<{ symbol: string; token: string; quote: string; price: string }>): Promise<void> {
    if (!prices || prices.length === 0) return;

    const now = new Date();

    for (const item of prices) {
      await this.priceRepository
        .createQueryBuilder()
        .insert()
        .into(TokenPriceEntity)
        .values({
          symbol: item.symbol,
          token: item.token,
          quote: item.quote,
          price: item.price,
          priceAt: now,
        })
        .orUpdate(['price', 'price_at'], ['symbol'])
        .execute();
    }
  }

  /**
   * 获取指定交易对价格
   */
  async getPrice(symbol: string): Promise<TokenPriceEntity | null> {
    return this.priceRepository.findOne({
      where: { symbol: symbol.toUpperCase() },
    });
  }

  /**
   * 获取所有价格
   */
  async getAllPrices(): Promise<TokenPriceEntity[]> {
    return this.priceRepository.find({
      order: { priceAt: 'DESC' },
    });
  }

  /**
   * 根据基础币种获取所有交易对
   */
  async getPricesByBase(token: string): Promise<TokenPriceEntity[]> {
    return this.priceRepository.find({
      where: { token: token.toUpperCase() },
      order: { priceAt: 'DESC' },
    });
  }

  /**
   * 根据计价币种获取所有交易对
   */
  async getPricesByQuote(quote: string): Promise<TokenPriceEntity[]> {
    return this.priceRepository.find({
      where: { quote: quote.toUpperCase() },
      order: { priceAt: 'DESC' },
    });
  }
}
