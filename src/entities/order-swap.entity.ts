import { Column, Entity, Index } from 'typeorm';
import { CommonEntity } from '@/common/entities/common.entity';
import { Status } from '@/constants';

/**
 * 闪兑订单表
 * 记录用户代币兑换操作
 */
@Entity({ name: 'order_swap', comment: '闪兑订单' })
@Index('idx_user_status', ['userId', 'status'])
@Index('idx_order_no', ['orderNo'], { unique: true })
export class OrderSwapEntity extends CommonEntity {
  @Column({ comment: '用户ID', name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ comment: '订单号', name: 'order_no', length: 32, unique: true })
  orderNo: string;

  @Column({ comment: '源代币ID', name: 'from_token_id', type: 'int' })
  fromTokenId: number;

  @Column({ comment: '源代币代码', name: 'from_token', length: 50 })
  fromToken: string;

  @Column({ comment: '源代币数量', name: 'from_amount', type: 'decimal', precision: 30, scale: 0 })
  fromAmount: string;

  @Column({ comment: '目标代币ID', name: 'to_token_id', type: 'int' })
  toTokenId: number;

  @Column({ comment: '目标代币代码', name: 'to_token', length: 50 })
  toToken: string;

  @Column({ comment: '目标代币数量', name: 'to_amount', type: 'decimal', precision: 30, scale: 0 })
  toAmount: string;

  @Column({ comment: '兑换比例', type: 'decimal', precision: 20, scale: 8 })
  rate: string;

  @Column({ comment: '源代币价格', name: 'from_price', type: 'decimal', precision: 20, scale: 8 })
  fromPrice: string;

  @Column({ comment: '目标代币价格', name: 'to_price', type: 'decimal', precision: 20, scale: 8 })
  toPrice: string;

  @Column({ comment: '计价币种', length: 20, default: 'USDT' })
  quote: string;

  @Column({
    comment: '订单状态: 1=成功 2=失败',
    type: 'tinyint',
    default: Status.Enabled,
  })
  status: Status.Enabled;

  @Column({ comment: '备注', length: 500, nullable: true })
  remark?: string;
}
