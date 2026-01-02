import { Entity } from 'typeorm';
import { BaseTransactionEntity } from '../base.entity';

/**
 * 以太坊交易记录表
 * 记录所有以太坊链上的交易
 */
@Entity({ name: 'transaction_in_eth', comment: 'ETH交易记录' })
export class TransactionEthEntity extends BaseTransactionEntity {}
