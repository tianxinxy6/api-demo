import { Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { ChainService } from '@/modules/chain/services/chain.service';
import { ChainEntity } from '@/entities/chain.entity';
import { BaseTransactionEntity } from '@/entities/txs/base.entity';
import { ChainAddressService } from '@/modules/user/services/chain-address.service';
import { DatabaseService } from '@/shared/database/database.service';
import { TransactionStatus } from '@/constants';
import { SysWalletAddressService } from '@/modules/sys/services/sys-wallet.service';

/**
 * 归集服务基类
 * 定义归集的通用流程和接口
 */
export abstract class BaseCollectService {
    protected readonly logger = new Logger(this.constructor.name);
    protected abstract readonly chainCode: string;
    protected abstract readonly chainType: number;

    // 归集目标地址（热钱包地址）
    protected collectAddress: string;
    protected chain: ChainEntity;

    constructor(
        protected readonly chainService: ChainService,
        protected readonly chainAddressService: ChainAddressService,
        protected readonly sysWalletAddressService: SysWalletAddressService,
        protected readonly dataSource: DataSource,
        protected readonly databaseService: DatabaseService,
    ) { }

    /**
     * 执行归集
     */
    async collect(tx: BaseTransactionEntity): Promise<void> {
        try {
            // 2. 获取链配置
            if (!this.chain) {
                this.chain = await this.chainService.getChainConfig(this.chainCode);
                if (!this.chain) {
                    return;
                }
            }

            // 3. 初始化链连接
            await this.init();

            this.collectAddress = await this.sysWalletAddressService.getCollectWalletAddress(this.chainCode);

            // 4. 检查来源地址余额是否足够
            const balance = await this.getBalance(tx.to, tx.contract);
            if (BigInt(balance) <= BigInt(0)) {
                // 余额不足，已归集过
                const queryRunner = this.dataSource.createQueryRunner();
                this.editRelTxStatus(queryRunner, tx);
                return;
            }

            // 获取 to 地址的私钥
            const privateKey = await this.chainAddressService.getPrivateKey(this.chainType, tx.to);
            if (!privateKey) {
                return;
            }

            // 5. 执行链上归集交易
            this.executeCollect(tx, privateKey);
        } catch (error) {
            this.logger.error(`Collect error for ${tx.from}:`, error.message);
        }
    }

    /**
     * 获取 gas 钱包私钥
     */
    protected getGasWalletPrivateKey(): Promise<string> {
        return this.sysWalletAddressService.getFeeWallet(this.chainType);
    }

    /**
     * 保存归集交易记录
     * 使用事务保存归集交易，并更新原始充值交易为已归集
     * @param txData 归集交易数据
     * @param originalTxEntity 原始充值交易的Entity类
     * @returns 保存成功的归集交易主键ID
     */
    async saveTx(txEntity: BaseTransactionEntity, relTx: BaseTransactionEntity): Promise<number> {
        try {
            return await this.databaseService.runTransaction(async (queryRunner) => {
                // 2. 保存归集交易记录
                const savedEntity = await queryRunner.manager.save(txEntity.constructor, txEntity);

                // 3. 更新原始充值交易为已归集
                this.editRelTxStatus(queryRunner, relTx);
                return savedEntity.id;
            });
        } catch (error) {
            this.logger.error(`Save collect transaction failed:`, error.message);
            throw error;
        }
    }

    /**
     * 保存手续费归集交易记录
     * @param relTx 
     */
    async saveGasTx(txEntity: BaseTransactionEntity, relTx: BaseTransactionEntity): Promise<void> {
        try {
            await this.databaseService.runTransaction(async (queryRunner) => {
                // 1. 构建归集交易实体
                txEntity.userId = relTx.userId;
                txEntity.relId = relTx.id;
                txEntity.token = this.chain.token;
                txEntity.decimals = this.chain.decimals;
                txEntity.blockNumber = 0;

                // 2. 保存归集交易记录
                await queryRunner.manager.save(txEntity.constructor, txEntity);
            });
        } catch (error) {
            this.logger.error(`Save gas collect transaction failed:`, error.message);
            throw error;
        }
    }

    /**
     * 更新原始充值交易为已归集
     * @param relTx 
     */
    async editRelTxStatus(queryRunner: QueryRunner, relTx: BaseTransactionEntity): Promise<void> {
        await queryRunner.manager.update(
            relTx.constructor,
            { id: relTx.id },
            { status: TransactionStatus.COLLECTED }
        );
    }

    async editTxStatus(txID: number, data: any): Promise<void> {
        try {
            await this.databaseService.runTransaction(async (queryRunner) => {
                const txEntity = this.buildEntity();
                // 1. 更新归集交易状态
                await queryRunner.manager.update(
                    txEntity.constructor,
                    { id: txID },
                    data
                );
            });
        } catch (error) {
            this.logger.error(`Edit collect transaction status failed:`, error.message);
            throw error;
        }
    }

    /**
     * 构建归集交易实体
     * @param txData 归集交易数据
     */
    protected buildCollectEntity(relTx: BaseTransactionEntity): BaseTransactionEntity {
        const entity = this.buildEntity();
        entity.userId = relTx.userId;
        entity.status = TransactionStatus.PENDING;
        entity.relId = relTx.id;
        entity.decimals = relTx.decimals;
        entity.token = relTx.token;
        entity.from = relTx.to;
        entity.to = this.collectAddress;
        entity.blockNumber = 0;
        return entity;
    }

    /**
     * 初始化 - 子类实现
     * 初始化链连接、钱包等
     */
    protected abstract init(): Promise<void>;

    /**
     * 获取地址余额 - 子类实现
     * @param address 地址
     * @param contractAddress 合约地址（代币）
     */
    protected abstract getBalance(address: string, contractAddress?: string): Promise<bigint>;

    /**
     * 执行归集交易 - 子类实现
     * 核心逻辑：
     * 1. 获取充值地址（fromAddress）的私钥
     * 2. 如果是原生代币（ETH/TRX），直接转账到热钱包
     * 3. 如果是代币（ERC20/TRC20），检查gas费是否足够：
     *    - 足够：直接转账代币到热钱包
     *    - 不足：从手续费钱包转账gas到充值地址，然后转账代币到热钱包
     * @param params 归集参数
     */
    protected abstract executeCollect(tx: BaseTransactionEntity, privateKey: string): Promise<void>;

    protected abstract buildEntity(): BaseTransactionEntity;
}
