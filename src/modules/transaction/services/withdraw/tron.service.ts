import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChainType, TransactionStatus, ErrorCode } from '@/constants';
import { TronUtil } from '@/utils/tron.util';
import { BaseTransactionEntity } from '@/entities/txs/base.entity';
import { BaseWithdrawService } from './base.service';
import { ChainService } from '@/modules/chain/services/chain.service';
import { SysWalletAddressService } from '@/modules/sys/services/sys-wallet.service';
import { DatabaseService } from '@/shared/database/database.service';
import { TransactionOutTronEntity } from '@/entities/txs/withdraw/transaction-tron.entity';
import { OrderWithdrawEntity } from '@/entities/order-withdraw.entity';
import { WithdrawService } from '@/modules/order/services/withdraw.service';
import { BusinessException } from '@/common/exceptions/biz.exception';

/**
 * TRON 提现转账服务
 * 处理 TRON 链的提现转账（包括 TRX 和 TRC20 代币）
 */
@Injectable()
export class TronWithdrawService extends BaseWithdrawService {
  protected readonly chainCode = 'TRON';
  protected readonly chainType = ChainType.TRON;

  private tronUtil: TronUtil;

  constructor(
    chainService: ChainService,
    sysWalletAddressService: SysWalletAddressService,
    dataSource: DataSource,
    databaseService: DatabaseService,
    withdrawService: WithdrawService,
  ) {
    super(
      chainService,
      sysWalletAddressService,
      dataSource,
      databaseService,
      withdrawService,
    );
  }

  protected buildEntity(): BaseTransactionEntity {
    return new TransactionOutTronEntity();
  }

  /**
   * 初始化 TRON 连接
   * @param privateKey 私钥
   * @returns 钱包地址
   */
  protected async init(privateKey: string): Promise<string> {
    this.tronUtil = new TronUtil(this.chain.rpcUrl, privateKey);
    const address = this.tronUtil.getFromAddress();
    if (!address) {
      this.logger.error('Failed to derive address from private key');
      throw new BusinessException(ErrorCode.ErrTransactionAddressDeriveFailed);
    }
    return address;
  }

  /**
   * 获取余额
   */
  protected async getBalance(address: string, contract?: string): Promise<bigint> {
    try {
      if (contract) {
        return BigInt(await this.tronUtil.getTRC20Balance(address, contract));
      }
      return BigInt(await this.tronUtil.getTRXBalance(address));
    } catch (error) {
      this.logger.error(`Get balance failed for ${address}:`, error.message);
      throw error;
    }
  }

  /**
   * 执行提现转账
   */
  protected async executetransfer(order: OrderWithdrawEntity): Promise<void> {
    try {
      // 如果是 TRC20 代币
      if (order.contract) {
        return await this.withdrawTRC20(order, this.editTxStatus.bind(this));
      } else {
        // TRX 原生币转账
        return await this.withdrawTRX(order, this.editTxStatus.bind(this));
      }
    } catch (error) {
      this.logger.error(
        `Execute withdraw failed for order ${order.id}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * 提现 TRX
   */
  private async withdrawTRX(
    order: OrderWithdrawEntity,
    callback: (txId: number, orderId: number, data: any) => void
  ): Promise<void> {
    try {
      const amount = BigInt(order.actualAmount);

      const gasFee = this.tronUtil.calculateTrxTransFee(order.to).toString();

      this.tronUtil.sendTrx(order.to, Number(amount))
        .then(async (hash) => {
          // 创建提现交易记录
          const txEntity = this.buildWithdrawEntity(order) as TransactionOutTronEntity;
          txEntity.hash = hash;
          txEntity.amount = amount.toString();
          txEntity.gasFee = gasFee;
          const txId = await this.saveTx(txEntity, order);

          // 监听交易确认
          this.watchTx(hash, (status, blockNumber) => {
            callback(txId, order.id, { status, blockNumber });
          });
        })
        .catch((error) => {
          this.logger.error(`Withdraw TRX failed:`, error.message);
          throw error;
        });
    } catch (error) {
      this.logger.error(`Withdraw TRX failed:`, error.message);
      throw error;
    }
  }

  /**
   * 提现 TRC20
   */
  private async withdrawTRC20(
    order: OrderWithdrawEntity,
    callback: (txId: number, orderId: number, data: any) => void
  ): Promise<void> {
    try {
      const amount = BigInt(order.actualAmount);

      const fromAddress = this.tronUtil.getFromAddress();
      if (!fromAddress) {
        this.logger.error('Failed to get from address for TRC20 withdraw');
        return;
      }

      const gasFee = this.tronUtil.calculateTrc20TransFee(order.to).toString();
      // 检查 ETH 余额是否足够支付 gas费
      const trxBalance = await this.getBalance(fromAddress);
      if (trxBalance < BigInt(gasFee)) {
        this.logger.error(`Insufficient TRX balance ${trxBalance} to cover gas fee ${gasFee} for TRC20 withdraw`);
        return;
      }

      this.tronUtil.sendTrc20(
        order.to,
        Number(amount),
        order.contract!,
      ).then(async (hash) => {
        // 创建提现交易记录
        const txEntity = this.buildWithdrawEntity(order);
        txEntity.hash = hash;
        txEntity.amount = amount.toString();
        txEntity.gasFee = gasFee;
        const txId = await this.saveTx(txEntity, order);

        // 监听交易确认
        this.watchTx(hash, (status, blockNumber) => {
          callback(txId, order.id, { status, blockNumber });
        });
      })
        .catch((error) => {
          this.logger.error(`Withdraw TRC20 failed:`, error.message);
          throw error;
        });
    } catch (error) {
      this.logger.error(`Withdraw TRC20 failed:`, error.message);
      throw error;
    }
  }

  /**
   * 监听交易确认状态
   * 使用 getTransaction 作为主要判断依据（更可靠）
   */
  private async watchTx(
      txHash: string,
      callback: (status: TransactionStatus, blockNumber?: number) => void,
      timeoutMs: number = 9 * 1000,
      intervalMs: number = 3_000,
    ): Promise<void> {
    const start = Date.now();

    try {
      while (Date.now() - start < timeoutMs) {
        // 使用 getTransaction 检查状态（不依赖 getTransactionInfo）
        const tx = await this.tronUtil.getTransaction(txHash);
        if (!tx || !tx.txID) {
          await new Promise((r) => setTimeout(r, intervalMs));
          continue;
        }

        const status = tx.ret?.[0]?.contractRet;

        if (status === 'SUCCESS') {
          callback(TransactionStatus.CONFIRMED);
          return;
        } else if (status === 'REVERT') {
          callback(TransactionStatus.FAILED);
          return;

        } else {
          // 交易存在但还未确认
          this.logger.debug(`Transaction ${txHash} pending confirmation...`);
        }

        await new Promise((r) => setTimeout(r, intervalMs));
      }

      this.logger.error(`Transaction confirmation timeout: ${txHash}`);
      callback(TransactionStatus.FAILED);
    } catch (error) {
      this.logger.error(`watchTx failed for ${txHash}:`, error.message);
      callback(TransactionStatus.FAILED);
    }
  }
}
