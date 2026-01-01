import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChainService } from '@/modules/chain/services/chain.service';
import { ChainEntity } from '@/entities/chain.entity';
import { BaseTransactionEntity } from '@/entities/txs/base.entity';
import { DatabaseService } from '@/shared/database/database.service';
import { SysWalletAddressService } from '@/modules/sys/services/sys-wallet.service';
import { OrderWithdrawEntity } from '@/entities/order-withdraw.entity';
import { WithdrawService } from '@/modules/order/services/withdraw.service';
import { TransactionStatus, WithdrawalStatus } from '@/constants';

/**
 * 提现转账服务基类
 * 定义提现转账的通用流程和接口
 */
export abstract class BaseWithdrawService {
    protected readonly logger = new Logger(this.constructor.name);
    protected abstract readonly chainCode: string;
    protected abstract readonly chainType: number;

    protected chain: ChainEntity;
    // 转账发起者地址
    protected addressFrom: string;

    constructor(
        protected readonly chainService: ChainService,
        protected readonly sysWalletAddressService: SysWalletAddressService,
        protected readonly dataSource: DataSource,
        protected readonly databaseService: DatabaseService,
        protected readonly withdrawService: WithdrawService,
    ) { }

    /**
     * 初始化链连接（由子类实现）
     */
    protected abstract init(privateKey: string): Promise<void>;

    /**
     * 构建交易实体（由子类实现）
     */
    protected abstract buildEntity(): BaseTransactionEntity;

    /**
     * 执行转账（由子类实现）
     */
    protected abstract executetransfer(order: OrderWithdrawEntity): Promise<void>;

    /**
     * 获取余额（由子类实现）
     */
    protected abstract getBalance(address: string, contract?: string): Promise<bigint>;

    /**
     * 处理待转账的提现订单
     */
    async process(): Promise<void> {
        try {
            // 1. 获取链配置
            if (!this.chain) {
                this.chain = await this.chainService.getChainConfig(this.chainCode);
                if (!this.chain) {
                    this.logger.warn(`Chain ${this.chainCode} config not found`);
                    return;
                }
            }

            // 3. 获取提现钱包私钥
            const privateKey = await this.sysWalletAddressService.getWithdrawWallet(
                this.chainType,
            );
            if (!privateKey) {
                this.logger.error(`Withdraw wallet private key not found for chain ${this.chainCode}`);
                return;
            }

            // 2. 初始化链连接
            await this.init(privateKey);

            // 4. 查询待处理的提现订单（从 WithdrawService 获取）
            const orders = await this.withdrawService.getPendingWithdraws(
                this.chain.id
            );
            if (orders.length === 0) {
                return;
            }

            this.logger.log(
                `Found ${orders.length} approved withdraw orders for ${this.chainCode}`,
            );

            // 6. 处理每笔提现订单
            for (const order of orders) {
                try {
                    const balance = await this.getBalance(
                        this.addressFrom,
                        order.contract,
                    );

                    if (balance < BigInt(order.actualAmount)) {
                        this.logger.error(`Order ${order.id}: Insufficient balance ${balance} for withdraw amount ${order.actualAmount}`);
                        continue;
                    }

                    // 执行转账
                    await this.executetransfer(order);
                } catch (error) {
                    this.logger.error(
                        `Process withdraw order ${order.id} failed:`,
                        error.message,
                    );
                }
            }
        } catch (error) {
            this.logger.error(`Process withdraws error:`, error.message);
        }
    }

    /**
     * 保存提现交易记录
     */
    protected async saveTx(
        txEntity: BaseTransactionEntity,
        order: OrderWithdrawEntity,
    ): Promise<number> {
        try {
            return await this.databaseService.runTransaction(
                async (queryRunner) => {
                    // 保存交易记录
                    const savedEntity = await queryRunner.manager.save(
                        txEntity.constructor,
                        txEntity,
                    );

                    await this.withdrawService.editStatus(order.id, WithdrawalStatus.PROCESSING);
                    return savedEntity.id;
                },
            );
        } catch (error) {
            this.logger.error(`Save withdraw transaction failed:`, error.message);
            throw error;
        }
    }

    /**
     * 更新交易状态
     */
    async editTxStatus(txID: number, orderId: number, data: any): Promise<void> {
        try {
            await this.databaseService.runTransaction(async (queryRunner) => {
                const txEntity = this.buildEntity();
                const status = data.status;
                if (status == TransactionStatus.CONFIRMED) {
                    // 如果交易确认，更新对应的提现订单状态为已完成
                    await this.withdrawService.settle(queryRunner, orderId, data.hash);
                } else {
                    // 如果交易失败，更新对应的提现订单状态为失败
                    await this.withdrawService.fail(queryRunner, orderId, 'Transaction failed on chain');
                }
                await queryRunner.manager.update(
                    txEntity.constructor,
                    { id: txID },
                    data,
                );
            });
        } catch (error) {
            this.logger.error(
                `Update withdraw transaction status failed:`,
                error.message,
            );
            throw error;
        }
    }

    /**
     * 构建提现交易实体
     */
    protected buildWithdrawEntity(order: OrderWithdrawEntity): BaseTransactionEntity {
        const entity = this.buildEntity();
        entity.userId = order.userId;
        entity.relId = order.id;
        entity.from = this.addressFrom;
        entity.to = order.to;  // 使用订单中的 to 字段（目标地址）
        entity.amount = order.actualAmount;
        entity.token = order.token;
        entity.decimals = order.decimals;
        entity.blockNumber = 0;
        return entity;
    }
}
