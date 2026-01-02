import { Injectable } from '@nestjs/common';
import { BaseConfirmService } from './base.service';
import { EthUtil } from '@/utils/eth.util';
import { ChainEntity } from '@/entities/chain.entity';
import { EthCollectService } from '../collect/eth.service';
import { BaseTransactionEntity } from '@/entities/txs/base.entity';
import { TransactionEthEntity } from '@/entities/txs/deposit/transaction-eth.entity';

/**
 * ETH 交易确认服务
 *
 * 继承自 BaseConfirmService，自动获得父类的共享依赖
 * 只需注入自己特有的依赖（ethCollectService）
 */
@Injectable()
export class EthConfirmService extends BaseConfirmService {
  protected readonly chainCode = 'ETH';
  protected readonly chainType = 2;
  protected readonly requiredConfirm = 12;

  private ethUtil: EthUtil;

  // 只注入子类特有的依赖
  constructor(private readonly ethCollectService: EthCollectService) {
    super();
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
    await this.ethCollectService.collect(tx);
  }
}
