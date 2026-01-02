import { ApiProperty } from '@nestjs/swagger';
import { formatToDateTime } from '@/utils/date.util';

/**
 * 代币价格响应模型
 */
export class TokenPriceResponse {
  @ApiProperty({ description: '交易对符号', example: 'BTCUSDT' })
  symbol: string;

  @ApiProperty({ description: '基础币种', example: 'BTC' })
  token: string;

  @ApiProperty({ description: '计价币种', example: 'USDT' })
  quote: string;

  @ApiProperty({ description: '当前价格', example: '43250.50000000' })
  price: string;

  @ApiProperty({ description: '价格更新时间', example: '2025-12-20 15:30:00' })
  priceAt: string;

  constructor(partial: Partial<Omit<TokenPriceResponse, 'priceAt'>> & { priceAt?: Date }) {
    Object.assign(this, partial);
    this.priceAt = partial.priceAt ? formatToDateTime(partial.priceAt) : '';
  }
}
