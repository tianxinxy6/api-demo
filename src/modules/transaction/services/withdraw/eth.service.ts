import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { ChainType, TransactionStatus } from '@/constants';
import { BaseTransactionEntity } from '@/entities/txs/base.entity';
import { BaseWithdrawService } from './base.service';
import { TransactionOutEthEntity } from '@/entities/txs/withdraw/transaction-eth.entity';
import { OrderWithdrawEntity } from '@/entities/order-withdraw.entity';
import { EthUtil } from '@/utils';

/**
 * ETH 提现转账服务
 * 处理 ETH 链的提现转账（包括 ETH 和 ERC20 代币）
 *
 * 继承自 BaseWithdrawService，自动获得父类的所有依赖注入
 * 不需要构造函数
 */
@Injectable()
export class EthWithdrawService extends BaseWithdrawService {
  protected readonly chainCode = 'ETH';
  protected readonly chainType = ChainType.ETH;

  private ethUtil: EthUtil;

  /**
   * 初始化 ETH 连接
   */
  protected async init(privateKey: string): Promise<void> {
    this.ethUtil = new EthUtil(this.chain.rpcUrl, privateKey);
    this.addressFrom = this.ethUtil.getWallet().address;
  }

  protected buildEntity(): BaseTransactionEntity {
    return new TransactionOutEthEntity();
  }

  /**
   * 获取余额
   */
  protected async getBalance(address: string, contract?: string): Promise<bigint> {
    try {
      if (contract) {
        return await this.ethUtil.getERC20Balance(address, contract);
      }
      return await this.ethUtil.getETHBalance(address);
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
      const wallet = this.ethUtil.getWallet();

      // 3. 如果是 ERC20 代币
      if (order.contract) {
        return await this.withdrawERC20Token(wallet, order, this.editTxStatus.bind(this));
      } else {
        // ETH 原生币转账
        return await this.withdrawETH(wallet, order, this.editTxStatus.bind(this));
      }
    } catch (error) {
      this.logger.error(`Execute withdraw failed for order ${order.id}:`, error.message);
    }
  }

  /**
   * 交易转账 ETH
   */
  private async withdrawETH(
    wallet: ethers.Wallet,
    order: OrderWithdrawEntity,
    callback: (txId: number, orderId: number, data: any) => void,
  ): Promise<void> {
    try {
      const amount = BigInt(order.actualAmount);

      // 获取 gas 价格
      const gasInfo = await this.ethUtil.estimateGas(wallet.address, order.to, amount);

      // 发送交易
      wallet
        .sendTransaction({
          to: order.to,
          value: amount,
          gasLimit: gasInfo.gasLimit,
          gasPrice: gasInfo.gasPrice,
        })
        .then((tx: ethers.TransactionResponse) => {
          // 创建归集交易记录
          const txEntity = this.buildWithdrawEntity(order);
          txEntity.hash = tx.hash;
          txEntity.amount = amount.toString();
          txEntity.gasFee = gasInfo.gasFee.toString();
          this.saveTx(txEntity, order).then((txId: number) => {
            this.waitTx(tx, txId, order.id, callback);
          });
        })
        .catch((error) => {
          this.logger.error(`Withdraw ETH transaction failed:`, error.message);
        });
    } catch (error) {
      this.logger.error(`Withdraw ETH failed:`, error.message);
      throw error;
    }
  }

  /**
   * 提现 ERC20
   */
  private async withdrawERC20Token(
    wallet: ethers.Wallet,
    order: OrderWithdrawEntity,
    callback: (txId: number, orderId: number, data: any) => void,
  ): Promise<void> {
    try {
      const contract = this.ethUtil.getContract(order.contract, wallet);
      const amount = BigInt(order.actualAmount);

      const gasInfo = await this.ethUtil.estimateERC20Gas(
        wallet.address,
        order.contract,
        order.to,
        amount,
      );

      // 检查 ETH 余额是否足够支付 gas
      const ethBalance = await this.ethUtil.getETHBalance(wallet.address);
      if (ethBalance < gasInfo.gasFee) {
        this.logger.error(`Gas fee not enough: ${ethers.formatEther(gasInfo.gasFee)} ETH`);
        return;
      }

      // 执行 ERC20 转账
      contract
        .transfer(order.to, amount, {
          gasLimit: gasInfo.gasLimit,
          gasPrice: gasInfo.gasPrice,
        })
        .then((tx: ethers.ContractTransactionResponse) => {
          // 创建归集交易记录
          const txEntity = this.buildWithdrawEntity(order);
          txEntity.hash = tx.hash;
          txEntity.amount = amount.toString();
          txEntity.gasFee = gasInfo.gasFee.toString();
          this.saveTx(txEntity, order).then((txId: number) => {
            this.waitTx(tx, txId, order.id, callback);
          });
        })
        .catch((error) => {
          this.logger.error(`Transfer ERC20 transaction failed:`, error.message);
        });
    } catch (error) {
      this.logger.error(`Withdraw ERC20 failed:`, error.message);
      throw error;
    }
  }

  /**
   * 监听交易确认
   */
  private waitTx(
    tx: ethers.TransactionResponse,
    txId: number,
    orderId: number,
    callback: (txID: number, orderId: number, data: any) => void,
  ): void {
    // 等待交易确认
    tx.wait()
      .then((receipt: ethers.TransactionReceipt) => {
        const gasLimitUsed = receipt.gasUsed;
        const gasPrice = receipt.gasPrice;
        const actualGasFee = gasLimitUsed * gasPrice;
        callback(txId, orderId, {
          status:
            receipt && receipt.status === 1
              ? TransactionStatus.CONFIRMED
              : TransactionStatus.FAILED,
          gasFee: actualGasFee.toString(),
          blockNumber: receipt.blockNumber,
        });
      })
      .catch((err) => {
        this.logger.error(`Withdraw ETH transaction failed:`, err.message);
        callback(txId, orderId, { status: TransactionStatus.FAILED });
      });
  }
}
