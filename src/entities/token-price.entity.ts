import {
  Column,
  Entity,
  Index,
} from 'typeorm';
import { CommonEntity } from '@/common/entities/common.entity';

/**
 * 代币价格表
 * 存储不同交易对的实时价格
 */
@Entity({ name: 'token_price', comment: '代币价格' })
@Index('idx_symbol', ['symbol'], { unique: true })
@Index('idx_token_quote', ['token', 'quote'])
export class TokenPriceEntity extends CommonEntity {
  @Column({ comment: '交易对符号', length: 20 })
  symbol: string;

  @Column({ comment: '基础币种', length: 10 })
  token: string;

  @Column({ comment: '计价币种', length: 10 })
  quote: string;

  @Column({
    comment: '当前价格',
    type: 'decimal',
    precision: 20,
    scale: 8,
  })
  price: string;

  @Column({
    comment: '价格更新时间',
    name: 'price_at',
    type: 'timestamp',
  })
  priceAt: Date;
}
