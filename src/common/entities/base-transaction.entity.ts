import {
  Column,
  Index,
} from 'typeorm';
import { TransactionStatus } from '@/constants';
import { CommonEntity } from '@/common/entities/common.entity';

/**
 * 基础交易记录实体（抽象类）
 * 包含所有链共同的字段定义
 */
@Index('idx_user', ['userId'])
@Index('idx_hash', ['hash'], { unique: true })
@Index('idx_to', ['to'])
export abstract class BaseTransactionEntity extends CommonEntity {
  @Column({ comment: '用户ID', name: 'user_id', type: 'bigint', nullable: true })
  userId?: number;

  @Column({
    comment: '交易金额',
    type: 'decimal',
    precision: 30,
    scale: 0,
    default: 0,
  })
  amount: string;

  @Column({ comment: '币种', name: 'token', length: 20 })
  token: string;

  @Column({ comment: '精度位数', type: 'tinyint' })
  decimals: number;

  @Column({ comment: '合约地址', name: 'contract', length: 42, nullable: true })
  contract?: string;

  @Column({ comment: '来源地址', name: 'from', length: 255 })
  from: string;

  @Column({ comment: '目标地址', name: 'to', length: 255 })
  to: string;

  @Column({ comment: '交易哈希', name: 'hash', length: 255 })
  hash: string;

  @Column({
    comment: '交易状态',
    type: 'tinyint',
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ comment: '区块高度', name: 'block_number', type: 'bigint' })
  blockNumber: number;

  @Column({ comment: '交易时间戳', type: 'bigint', nullable: true })
  timestamp: number;

  @Column({ comment: '关联ID', name: 'rel_id', type: 'bigint', nullable: true })
  relId?: number;

  @Column({
    comment: '原始交易数据',
    name: 'raw_data',
    type: 'text',
    nullable: true,
  })
  rawData?: string;
}