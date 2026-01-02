import { Column, Entity, Index } from 'typeorm';
import { ChainStatus } from '@/constants';
import { CommonEntity } from '@/common/entities/common.entity';

/**
 * 区块链配置表
 */
@Entity({ name: 'chain', comment: '区块链配置' })
@Index('idx_code', ['code'], { unique: true })
export class ChainEntity extends CommonEntity {
  /**
   * 链标识 - 全局唯一（不可修改）
   * TRON, ETH, POLYGON, BSC 等
   */
  @Column({ comment: '链代码', length: 20 })
  code: string;

  @Column({ comment: '主币', length: 20 })
  token: string;

  @Column({ comment: '链名称', length: 50 })
  name: string;

  @Column({ comment: '链logo', length: 100 })
  logo: string;

  @Column({ comment: '链类型', type: 'tinyint' })
  type: number;

  @Column({
    comment: '状态',
    type: 'tinyint',
    default: ChainStatus.ACTIVE,
  })
  status: ChainStatus;

  /**
   * RPC 端点
   * TRON: https://shasta.trongrid.io
   * ETH: https://sepolia.infura.io/v3/...
   */
  @Column({ comment: 'RPC 端点', name: 'rpc_url', length: 500 })
  rpcUrl: string;

  /**
   * 确认数要求
   * TRON: 19 确认
   * ETH: 12 确认
   */
  @Column({
    comment: '确认数要求',
    name: 'confirm_num',
    type: 'smallint',
  })
  confirmNum: number;

  /**
   * 平均出块时间（秒）
   * TRON: 3 秒
   * ETH: 13 秒
   * 用于计算预期确认时间
   */
  @Column({
    comment: '平均出块时间（秒）',
    name: 'block_time',
    type: 'smallint',
  })
  blockTime: number;

  /**
   * 代币精度
   * TRON 原生代币（TRX）: 6
   * ETH 原生代币: 18
   */
  @Column({ comment: '代币精度', type: 'smallint' })
  decimals: number;

  /**
   * 主币最小金额
   * 扫描时主币交易必须 >= 此金额才处理
   * 单位：最小单位（ETH=wei, TRX=sun）
   * 默认 0 不限制
   */
  @Column({
    comment: '主币最小金额',
    name: 'min_amount',
    type: 'decimal',
    precision: 30,
    scale: 0,
    default: '0',
  })
  minAmount: string;
}
