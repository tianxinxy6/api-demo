import { Column, Entity, Index } from 'typeorm';
import { TokenStatus } from '@/constants';
import { CommonEntity } from '@/common/entities/common.entity';

/**
 * 代币配置表
 * 管理每条链上支持的代币列表
 *
 * 核心职责：
 * 1. 维护每条链上支持的代币列表
 * 2. 配置代币的精度、合约地址等参数
 * 3. 支持动态启用/禁用代币充提
 * 4. 记录代币行为配置（TRON 能量、最小额度等）
 *
 */
@Entity({ name: 'chain_token', comment: '代币配置' })
@Index('idx_token_chain_code', ['chainId', 'code'], { unique: true })
export class ChainTokenEntity extends CommonEntity {
  @Column({ comment: '所属链 ID', name: 'chain_id', type: 'bigint' })
  chainId: number;

  /**
   * 代币代码 - 链内唯一
   * 原生代币：TRX, ETH
   * ERC20: USDT, USDC 等
   */
  @Column({ comment: '代币代码', length: 50 })
  code: string;

  @Column({ comment: '代币名称', length: 100 })
  name: string;

  @Column({ comment: '代币logo', length: 100, default: '' })
  logo: string;

  @Column({
    comment: '状态',
    type: 'tinyint',
    default: TokenStatus.ACTIVE,
  })
  status: TokenStatus;

  /**
   * 合约地址（原生代币为空）
   * ERC20/TRC20: 0x... 或 T...
   */
  @Column({
    comment: '合约地址',
    name: 'contract',
    length: 255,
    nullable: true,
  })
  contract?: string;

  /**
   * 代币精度（小数位数）
   * TRX: 6 (1 TRX = 1_000_000 SUN)
   * ETH: 18 (1 ETH = 10^18 WEI)
   * USDT: 6
   * USDC: 6
   */
  @Column({ comment: '精度位数', type: 'tinyint' })
  decimals: number;
}
