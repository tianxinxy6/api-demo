import { CommonEntity } from '@/common/entities/common.entity';
import {
  Column,
  Entity,
  Index,
} from 'typeorm';

/**
 * 用户中心化钱包表
 * 记录用户在平台内的各代币余额
 *
 * 设计原则：
 * 1. 一个用户一个代币一条记录
 * 2. 余额使用 bigint 存储原始值（已乘以 decimals）
 * 3. 关联 token 表获取代币详细信息
 * 4. 支持可用/冻结余额分离管理
 */
@Entity({ name: 'user_wallet', comment: '用户中心化钱包' })
@Index('idx_user_token', ['userId', 'tokenId'], { unique: true })
export class UserWalletEntity extends CommonEntity {
  @Column({ comment: '用户ID', name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ comment: '代币ID(关联token表)', name: 'token_id', type: 'int' })
  tokenId: number;

  @Column({ comment: '精度位数', type: 'tinyint' })
  decimals: number;

  @Column({
    comment: '可用余额',
    type: 'decimal',
    precision: 30,
    scale: 0,
    default: 0,
  })
  balance: string;

  @Column({
    comment: '冻结余额(提现中等)',
    name: 'frozen_balance',
    type: 'decimal',
    precision: 30,
    scale: 0,
    default: 0,
  })
  frozenBalance: string;

  @Column({
    comment: '钱包状态: 0=正常 1=冻结 2=禁用',
    type: 'tinyint',
    default: 0,
  })
  status: number;
}
