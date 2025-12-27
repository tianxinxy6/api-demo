import { Column, Entity } from 'typeorm';
import { BaseTransactionEntity } from '../base.entity';

/**
 * 以太坊交易记录表
 * 记录所有以太坊链上的交易
 */
@Entity({ name: 'transaction_collect_tron', comment: 'TRON交易归集记录' })
export class TransactionCollectTronEntity extends BaseTransactionEntity {
    @Column({
        comment: 'Gas费用',
        name: 'gas_fee',
        type: 'int',
        nullable: true,
    })
    gasFee: number;
}