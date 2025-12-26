import {
    Column,
    Entity,
} from 'typeorm';
import { CommonEntity } from '@/common/entities/common.entity';
import { ChainType, Status, SysWalletType } from '@/constants';

/**
 * 系统钱包地址表
 */
@Entity({ name: 'sys_wallet_address', comment: '系统钱包地址' })
export class SysWalletAddressEntity extends CommonEntity {
    @Column({
        comment: '钱包类型: 1=手续费钱包 2=提现钱包',
        name: 'type',
        type: 'tinyint',
    })
    type: SysWalletType;

    @Column({ comment: '区块链ID(关联chain表)', name: 'chain_id', type: 'int' })
    chainId: number;

    @Column({
        comment: '区块链类型',
        name: 'chain_type',
        type: 'tinyint',
    })
    chainType: ChainType;

    @Column({
        comment: '钱包地址',
        type: 'varchar',
        length: 64,
    })
    address: string;

    @Column({
        comment: '钱包名称/备注',
        type: 'varchar',
        length: 100,
    })
    name: string;

    @Column({
        comment: '状态: 0=停用 1=激活',
        type: 'tinyint',
        default: Status.Enabled,
    })
    status: Status.Enabled;

    @Column({
        comment: '备注说明',
        type: 'varchar',
        length: 200,
        nullable: true,
    })
    remark: string;
}
