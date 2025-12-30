import { Entity } from 'typeorm';
import { BaseTransactionEntity } from '../base.entity';

/**
 * TRON交易记录表
 * 记录所有TRON链上的交易
 */
@Entity({ name: 'transaction_in_tron', comment: 'TRON交易记录' })
export class TransactionTronEntity extends BaseTransactionEntity {
  
}