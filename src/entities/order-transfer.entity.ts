import {
  Column,
  Entity,
  Index,
} from 'typeorm';
import { TransferStatus } from '@/constants';
import { CommonEntity } from '@/common/entities/common.entity';

/**
 * 转账订单表
 */
@Entity({ name: 'order_transfer', comment: '转账订单' })
@Index('idx_from_user_status', ['userId', 'status'])
@Index('idx_to_user_status', ['toUserId', 'status'])
@Index('idx_order_no', ['orderNo'], { unique: true })
export class OrderTransferEntity extends CommonEntity {
  @Column({ comment: '转出用户ID', name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ comment: '转入用户ID', name: 'to_user_id', type: 'bigint' })
  toUserId: number;

  @Column({ comment: '订单号', name: 'order_no', length: 50 })
  orderNo: string;

  @Column({ comment: '代币ID', name: 'token_id', type: 'bigint' })
  tokenId: number;

  @Column({ comment: '代币代码', length: 50 })
  token: string;

  @Column({ comment: '精度位数', type: 'tinyint' })
  decimals: number;

  @Column({ comment: '转账金额', type: 'decimal', precision: 30, scale: 0 })
  amount: string;

  @Column({
    comment: '订单状态',
    type: 'tinyint',
    default: TransferStatus.PENDING,
  })
  status: TransferStatus;

  @Column({
    comment: '备注',
    length: 500,
    nullable: true,
  })
  remark?: string;
}
