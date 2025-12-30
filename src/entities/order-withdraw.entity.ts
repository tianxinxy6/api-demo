import {
  Column,
  Entity,
  Index,
} from 'typeorm';
import { WithdrawalStatus } from '@/constants';
import { OperatorEntity } from '@/common/entities/common.entity';

/**
 * 提现订单表
 */
@Entity({ name: 'order_withdraw', comment: '提现订单' })
@Index('idx_user_status', ['userId', 'status'])
@Index('idx_hash', ['hash'])
@Index('idx_order_no', ['orderNo'], { unique: true })
export class OrderWithdrawEntity extends OperatorEntity {
  @Column({ comment: '用户ID', name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ comment: '订单号', name: 'order_no', length: 50 })
  orderNo: string;

  @Column({
    comment: '区块链id',
    name: 'chain_id',
    type: 'tinyint',
  })
  chainId: number;

  @Column({ comment: '代币代码', length: 50 })
  token: string;

  @Column({ comment: '代币合约地址', length: 50, nullable: true })
  contract?: string;

  @Column({ comment: '精度位数', type: 'tinyint' })
  decimals: number;

  @Column({ comment: '提现金额', type: 'decimal', precision: 30, scale: 0 })
  amount: string;

  @Column({ comment: '手续费', type: 'decimal', precision: 30, scale: 0, default: 0 })
  fee: string;

  @Column({ comment: '实际到账金额', name: 'actual_amount', type: 'decimal', precision: 30, scale: 0 })
  actualAmount: string;

  @Column({ comment: '提现地址', name: 'to', length: 255 })
  to: string;

  @Column({
    comment: '订单状态',
    type: 'tinyint',
    default: WithdrawalStatus.PENDING,
  })
  status: WithdrawalStatus;

  @Column({ comment: '区块链交易哈希', name: 'hash', length: 255, nullable: true })
  hash?: string;

  @Column({
    comment: '失败原因',
    name: 'failure_reason',
    length: 500,
    nullable: true,
  })
  failureReason?: string;

  @Column({
    comment: '审核备注',
    length: 500,
    nullable: true,
  })
  remark?: string;

  @Column({ comment: '完成时间', name: 'finished_at', type: 'timestamp', nullable: true })
  finishedAt?: Date;
}
