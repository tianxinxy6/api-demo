import { Logger } from '@nestjs/common';
import { ChainService } from '@/modules/chain/services/chain.service';
import { ChainEntity } from '@/entities/chain.entity';
import { BaseTransactionEntity } from '@/entities/txs/base.entity';
import { DepositService } from '@/modules/order/services/deposit.service';
import { DatabaseService } from '@/shared/database/database.service';
import { TransactionStatus, ErrorCode } from '@/constants';
import { BusinessException } from '@/common/exceptions/biz.exception';

/**
 * 交易确认服务基类
 * 职责：
 * 1. 确认待处理的区块链交易
 * 2. 检查交易状态和确认数
 * 3. 更新充值订单状态
 * 4. 触发归集流程
 */
export abstract class BaseConfirmService {
  protected readonly logger = new Logger(this.constructor.name);

  protected abstract readonly chainCode: string;
  protected abstract readonly chainType: number;
  protected abstract readonly requiredConfirm: number;

  protected isConfirming = false;

  constructor(
    protected readonly chainService: ChainService,
    protected readonly depositService: DepositService,
    protected readonly databaseService: DatabaseService,
  ) {}

  /**
   * 确认待处理交易
   */
  async confirm(): Promise<void> {
    if (this.isConfirming) {
      this.logger.debug(`${this.chainCode} confirm running, skip`);
      return;
    }

    this.isConfirming = true;
    try {
      await this.process();
    } catch (error) {
      this.logger.error(`${this.chainCode} confirm failed:`, error.message);
    } finally {
      this.isConfirming = false;
    }
  }

  /**
   * 归集交易
   * 将已确认的交易归集到系统钱包
   */
  async collect(): Promise<void> {
    const pendingTxs = await this.getTxList(TransactionStatus.CONFIRMED, 20);
    if (pendingTxs.length === 0) {
      this.logger.debug(`No confirmed ${this.chainCode} transactions to collect`);
      return;
    }

    // to 地址去重
    const toAddresses = new Set<string>();

    for (const tx of pendingTxs) {
      try {
        // 如果该地址已经处理过，跳过
        if (toAddresses.has(tx.to)) {
          continue;
        }

        await this.triggerCollect(tx);

        // 标记该地址已处理
        toAddresses.add(tx.to);
      } catch (error) {
        this.logger.error(`Collect ${this.chainCode} tx ${tx.hash} failed:`, error.message);
      }
    }
  }

  /**
   * 处理确认逻辑
   */
  protected async process(): Promise<void> {
    // 获取待确认交易
    const pending = await this.getTxList();
    if (pending.length === 0) {
      this.logger.debug(`No pending ${this.chainCode} transactions`);
      return;
    }

    const chain = await this.chainService.getChainConfig(this.chainCode);
    if (!chain) {
      this.logger.warn(`${this.chainCode} chain not configured`);
      return;
    }

    this.init(chain);

    this.logger.log(`Processing ${pending.length} pending ${this.chainCode} transactions`);

    const latestBlock = await this.getLatestBlockNumber();
    for (const tx of pending) {
      try {
        // 这里需要先判断是否满足确认数，再进行链上验证
        if (latestBlock - tx.blockNumber < this.requiredConfirm) {
          continue;
        }
        const isSuccess = await this.checkStatus(tx.hash);

        await this.confirmTx(tx.hash, latestBlock, isSuccess);

        // 如果交易确认成功，触发归集
        if (isSuccess) {
          await this.triggerCollect(tx);
        }
      } catch (error) {
        this.logger.error(`Process ${this.chainCode} tx ${tx.hash} failed:`, error.message);
      }
    }
  }

  /**
   * 获取待确认的交易列表
   * @param status 交易状态
   * @param limit 限制数量
   * @param isGroup 是否按 to 地址分组（分组后会按地址、时间排序）
   */
  async getTxList(
    status: TransactionStatus = TransactionStatus.PENDING,
    limit: number = 50,
  ): Promise<BaseTransactionEntity[]> {
    const dataSource = this.databaseService.getDataSource();

    const txEntity = this.buildEntity();
    const queryBuilder = dataSource.manager
      .createQueryBuilder(txEntity.constructor, 'tx')
      .where('tx.status = :status', { status })
      .orderBy('tx.createdAt', 'ASC')
      .limit(limit);

    return (await queryBuilder.getMany()) as BaseTransactionEntity[];
  }

  /**
   * 确认交易
   * @param txHash 交易哈希
   * @param confirmBlock 确认区块号
   * @param success 是否成功
   */
  async confirmTx(txHash: string, confirmBlock?: number, success?: boolean): Promise<void> {
    const entity = this.buildEntity();
    await this.databaseService.runTransaction(async (queryRunner) => {
      try {
        // 1. 先获取交易记录
        const transaction = await queryRunner.manager.findOne(entity.constructor, {
          where: { hash: txHash },
        } as any);

        if (!transaction) {
          this.logger.warn(`Transaction not found: ${txHash}`);
          throw new BusinessException(ErrorCode.ErrTransactionNotFound);
        }

        // 2. 确定交易状态
        const status = success === false ? TransactionStatus.FAILED : TransactionStatus.CONFIRMED;

        // 3. 更新交易状态
        transaction.status = status;

        // 4. 保存交易记录
        await queryRunner.manager.save(entity.constructor, transaction);

        // 5. 如果是成功的充值交易，处理充值订单
        await this.depositService.confirm(
          queryRunner,
          transaction as BaseTransactionEntity,
          success,
          confirmBlock,
          success ? undefined : 'Transaction failed',
        );
      } catch (error) {
        this.logger.error(`Failed to confirm transaction ${txHash}:`, error);
        throw error;
      }
    });
  }

  /**
   * 初始化
   * @param chain 链配置
   */
  protected abstract init(chain: ChainEntity): void;

  /**
   * 检查交易确认状态
   * @param txHash 交易哈希
   */
  protected abstract checkStatus(txHash: string): Promise<boolean>;

  /**
   * 获取最新区块号
   */
  protected abstract getLatestBlockNumber(): Promise<number>;

  /**
   * 构建交易实体
   */
  protected abstract buildEntity(): BaseTransactionEntity;

  /**
   * 触发归集操作
   * @param tx 交易实体
   */
  protected abstract triggerCollect(tx: BaseTransactionEntity): Promise<void>;
}
