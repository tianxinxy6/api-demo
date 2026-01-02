import { Column, Entity, Index } from 'typeorm';
import { TokenStatus } from '@/constants';
import { CommonEntity } from '@/common/entities/common.entity';

type FeeConfig = {
  rate: number; // 手续费率，万分比表示
  min: number; // 最小手续费
  max: number; // 最大手续费
};

/**
 * 平台代币配置表
 */
@Entity({ name: 'token', comment: '代币配置' })
@Index('idx_token_code', ['code'], { unique: true })
export class TokenEntity extends CommonEntity {
  /**
   * 代币代码
   * 原生代币：TRX, ETH
   * ERC20: USDT, USDC 等
   */
  @Column({ comment: '代币代码', length: 30 })
  code: string;

  @Column({ comment: '代币名称', length: 50 })
  name: string;

  @Column({ comment: '代币logo', length: 100 })
  logo: string;

  @Column({ comment: '精度位数', type: 'tinyint' })
  decimals: number;

  // 手续费 json 字符串，定义 type
  @Column({
    comment: '提现手续费配置',
    name: 'withdraw_fee',
    type: 'json',
    nullable: true,
  })
  withdrawFee?: FeeConfig;

  @Column({
    comment: '状态',
    type: 'tinyint',
    default: TokenStatus.ACTIVE,
  })
  status: TokenStatus;
}
