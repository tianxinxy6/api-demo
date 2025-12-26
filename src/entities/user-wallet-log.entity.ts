import {
  Column,
  Entity,
  Index,
} from 'typeorm';
import { WalletLogType } from '../constants';
import { CommonCEntity } from '@/common/entities/common.entity';

/**
 * 用户钱包变动日志表
 * 记录用户钱包余额的所有变动历史
 */
@Entity({ name: 'user_wallet_log', comment: '用户钱包变动日志' })
@Index('idx_user_token', ['userId', 'tokenId'])
@Index('idx_user_time', ['userId', 'createdAt'])
export class UserWalletLogEntity extends CommonCEntity {
  @Column({ comment: '用户ID', name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ comment: '代币ID(关联token表)', name: 'token_id', type: 'int' })
  tokenId: number;

  @Column({
    comment: '变动类型',
    type: 'tinyint',
  })
  type: WalletLogType;

  @Column({
    comment: '变动金额(正数为增加，负数为减少，已乘以decimals的整数)',
    type: 'decimal',
    precision: 30,
    scale: 0,
  })
  amount: string;

  @Column({
    comment: '变动前可用余额',
    name: 'before_balance',
    type: 'decimal',
    precision: 30,
    scale: 0,
  })
  beforeBalance: string;

  @Column({
    comment: '变动后可用余额',
    name: 'after_balance',
    type: 'decimal',
    precision: 30,
    scale: 0,
  })
  afterBalance: string;

  @Column({
    comment: '关联订单ID(可为空)',
    name: 'order_id',
    type: 'bigint',
    default: 0,
  })
  orderId?: number;

  @Column({
    comment: '备注信息',
    type: 'varchar',
    length: 255,
    default: '',
  })
  remark: string;
}