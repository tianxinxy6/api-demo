import { Injectable } from '@nestjs/common';
import { BaseConfirmService } from './base.service';
import { TronUtil } from '@/utils/tron.util';
import { TronCollectService } from '../collect/tron.service';
import { BaseTransactionEntity } from '@/entities/txs/base.entity';
import { TransactionTronEntity } from '@/entities/txs/deposit/transaction-tron.entity';

/**
 * TRON 交易确认服务
 *
 * 继承自 BaseConfirmService，自动获得父类的共享依赖
 * 只需注入自己特有的依赖（tronCollectService）
 */
@Injectable()
export class TronConfirmService extends BaseConfirmService {
  protected readonly chainCode = 'TRON';
  protected readonly chainType = 1;
  protected readonly requiredConfirm = 19;

  private tronUtil: TronUtil;

  // 只注入子类特有的依赖
  constructor(private readonly tronCollectService: TronCollectService) {
    super();
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
    await this.tronCollectService.collect(tx);
  }
}
