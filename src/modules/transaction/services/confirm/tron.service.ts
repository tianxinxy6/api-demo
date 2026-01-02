import { Injectable } from '@nestjs/common';
import { BaseConfirmService } from './base.service';
import { TronUtil } from '@/utils/tron.util';
import { ChainService } from '@/modules/chain/services/chain.service';
import { DepositService } from '@/modules/order/services/deposit.service';
import { DatabaseService } from '@/shared/database/database.service';
import { TronCollectService } from '../collect/tron.service';
import { BaseTransactionEntity } from '@/entities/txs/base.entity';
import { TransactionTronEntity } from '@/entities/txs/deposit/transaction-tron.entity';

/**
 * TRON 交易确认服务
 */
@Injectable()
export class TronConfirmService extends BaseConfirmService {
  protected readonly chainCode = 'TRON';
  protected readonly chainType = 1;
  protected readonly requiredConfirm = 19;

  private tronUtil: TronUtil;

  constructor(
    chainService: ChainService,
    depositService: DepositService,
    databaseService: DatabaseService,
    private readonly tronCollectService: TronCollectService,
  ) {
    super(chainService, depositService, databaseService);
  }

  protected init(chain): void {
    this.tronUtil = new TronUtil(chain.rpcUrl);
  }

  /**
   * 检查TRON交易确认状态
   */
  protected async checkStatus(txHash: string): Promise<boolean> {
    return await this.tronUtil.isTransactionSuccess(txHash);
  }

  /**
   * 实现基类抽象方法：获取最新区块号
   */
  protected async getLatestBlockNumber(): Promise<number> {
    return await this.tronUtil.getLatestBlockNumber();
  }

  protected buildEntity(): TransactionTronEntity {
    return new TransactionTronEntity();
  }

  /**
   * 触发归集
   */
  protected async triggerCollect(tx: BaseTransactionEntity): Promise<void> {
    try {
      this.logger.log(`Triggering collect for TRON transaction ${tx.hash}`);
      await this.tronCollectService.collect(tx);
    } catch (error) {
      this.logger.error(`Failed to trigger collect for transaction ${tx.hash}:`, error.message);
    }
  }
}
