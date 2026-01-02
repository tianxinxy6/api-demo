import { Entity } from 'typeorm';
import { BaseTransactionEntity } from '../base.entity';

/**
 * 以太坊交易记录表
 * 记录所有以太坊链上的交易
 */
@Entity({ name: 'transaction_out_tron', comment: 'TRON提现交易记录' })
export class TransactionOutTronEntity extends BaseTransactionEntity {}
