import { Injectable } from '@nestjs/common';
import { BaseConfirmService } from './base.service';
import { EthUtil } from '@/utils/eth.util';
import { ChainEntity } from '@/entities/chain.entity';
import { ChainService } from '@/modules/chain/services/chain.service';
import { DepositService } from '@/modules/order/services/deposit.service';
import { DatabaseService } from '@/shared/database/database.service';
import { EthCollectService } from '../collect/eth.service';
import { BaseTransactionEntity } from '@/entities/txs/base.entity';
import { TransactionEthEntity } from '@/entities/txs/deposit/transaction-eth.entity';

/**
 * ETH 交易确认服务
 */
@Injectable()
export class EthConfirmService extends BaseConfirmService {
  protected readonly chainCode = 'ETH';
  protected readonly chainType = 2;
  protected readonly requiredConfirm = 12;

  private ethUtil: EthUtil;

  constructor(
    chainService: ChainService,
    depositService: DepositService,
    databaseService: DatabaseService,
    private readonly ethCollectService: EthCollectService,
  ) {
    super(chainService, depositService, databaseService);
  }

  protected init(chain: ChainEntity): void {
    this.ethUtil = new EthUtil(chain.rpcUrl);
  }

  /**
   * 检查ETH交易确认状态
   */
  protected async checkStatus(txHash: string): Promise<boolean> {
    return await this.ethUtil.isTransactionSuccess(txHash);
  }

  /**
   * 实现基类抽象方法：获取最新区块号
   */
  protected async getLatestBlockNumber(): Promise<number> {
    return await this.ethUtil.getLatestBlockNumber();
  }

  protected buildEntity(): TransactionEthEntity {
    return new TransactionEthEntity();
  }

  /**
   * 触发归集
   */
  protected async triggerCollect(tx: BaseTransactionEntity): Promise<void> {
    try {
      this.logger.log(`Triggering collect for ETH transaction ${tx.hash}`);
      await this.ethCollectService.collect(tx);
    } catch (error) {
      this.logger.error(`Failed to trigger collect for transaction ${tx.hash}:`, error.message);
    }
  }
}
