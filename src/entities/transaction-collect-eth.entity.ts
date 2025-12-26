import { Column, Entity } from 'typeorm';
import { BaseTransactionEntity } from '../common/entities/base-transaction.entity';

/**
 * 以太坊交易记录表
 * 记录所有以太坊链上的交易
 */
@Entity({ name: 'transaction_collect_eth', comment: 'ETH交易归集记录' })
export class TransactionCollectEthEntity extends BaseTransactionEntity {
    @Column({
        comment: 'Gas费用',
        name: 'gas_fee',
        type: 'decimal',
        precision: 18,
        scale: 0,
        nullable: true,
    })
    gasFee: string;
}