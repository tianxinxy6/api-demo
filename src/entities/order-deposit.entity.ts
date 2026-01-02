import { Column, Entity, Index } from 'typeorm';
import { DepositStatus } from '@/constants';
import { CommonEntity } from '@/common/entities/common.entity';

/**
 * 充值订单表
 */
@Entity({ name: 'order_deposit', comment: '充值订单' })
@Index('idx_user_status', ['userId', 'status'])
@Index('idx_hash', ['hash'], { unique: true })
export class OrderDepositEntity extends CommonEntity {
  @Column({ comment: '用户ID', name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({
    comment: '区块链id',
    name: 'chain_id',
    type: 'tinyint',
  })
  chainId: number;

  @Column({ comment: '代币代码', length: 50 })
  token: string;

  @Column({ comment: '精度位数', type: 'tinyint' })
  decimals: number;

  @Column({ comment: '充值金额', type: 'decimal', precision: 30, scale: 0 })
  amount: string;

  @Column({ comment: '区块链交易哈希', name: 'hash', length: 255 })
  hash: string;

  @Column({
    comment: '订单状态',
    type: 'tinyint',
    default: DepositStatus.PENDING,
  })
  status: DepositStatus;

  @Column({ comment: '转账来源地址', name: 'from', length: 255 })
  from: string;

  @Column({ comment: '转账目标地址', name: 'to', length: 255 })
  to: string;

  @Column({
    comment: '区块号',
    name: 'block_number',
    type: 'bigint',
    default: 0,
  })
  blockNumber: number;

  @Column({
    comment: '确认区块号',
    name: 'confirm_block',
    type: 'bigint',
    default: 0,
  })
  confirmBlock: number;

  @Column({
    comment: '失败原因',
    name: 'failure_reason',
    length: 500,
    nullable: true,
  })
  failureReason?: string;
}
