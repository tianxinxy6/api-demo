import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { ChainType, TransactionStatus } from '@/constants';
import { BaseTransactionEntity } from '@/entities/txs/base.entity';
import { BaseCollectService } from './base.service';
import { ChainService } from '@/modules/chain/services/chain.service';
import { ChainAddressService } from '@/modules/user/services/chain-address.service';
import { SysWalletAddressService } from '@/modules/sys/services/sys-wallet.service';
import { DataSource } from 'typeorm';
import { DatabaseService } from '@/shared/database/database.service';
import { TransactionCollectEthEntity } from '@/entities/txs/collect/transaction-eth.entity';
import { EthGasInfo, EthUtil } from '@/utils';

/**
 * ETH 归集服务
 * 处理 ETH 链的资金归集（包括 ETH 和 ERC20 代币）
 */
@Injectable()
export class EthCollectService extends BaseCollectService {
  protected readonly chainCode = 'ETH';
  protected readonly chainType = ChainType.ETH;

  private ethUtil: EthUtil;

  constructor(
    chainService: ChainService,
    chainAddressService: ChainAddressService,
    sysWalletAddressService: SysWalletAddressService,
    dataSource: DataSource,
    databaseService: DatabaseService,
  ) {
    super(chainService, chainAddressService, sysWalletAddressService, dataSource, databaseService);
  }

  /**
   * 初始化 ETH 连接
   */
  protected async init(): Promise<void> {
    this.ethUtil = new EthUtil(this.chain.rpcUrl);
  }

  protected buildEntity(): BaseTransactionEntity {
    return new TransactionCollectEthEntity();
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
   * 执行归集交易
   * 核心逻辑：
   * 1. 获取充值地址（fromAddress）的私钥
   * 2. 如果是原生代币（ETH），直接转账到热钱包
   * 3. 如果是代币（ERC20），检查gas费是否足够：
   *    - 足够：直接转账代币到热钱包
   *    - 不够：从手续费钱包转账gas到充值地址，然后转账代币到热钱包
   */
  protected async executeCollect(tx: BaseTransactionEntity, privateKey: string): Promise<void> {
    try {
      // 3. 创建带私钥的 wallet
      const wallet = this.ethUtil.getWallet(privateKey);

      // 4. 如果是 ERC20 代币，需要检查 gas 费
      if (tx.contract) {
        return await this.collectERC20Token(wallet, tx, this.editTxStatus.bind(this));
      } else {
        // ETH 原生币转账（扣除 gas 费后全部转走）
        return await this.collectETH(wallet, tx, this.editTxStatus.bind(this));
      }
    } catch (error) {
      this.logger.error(`Execute collect failed for ${tx.from}:`, error.message);
    }
  }

  /**
   * 归集 ETH
   */
  private async collectETH(
    wallet: ethers.Wallet,
    relTx: BaseTransactionEntity,
    callback: (txID: number, data: any) => void,
  ): Promise<void> {
    try {
      // 获取当前余额
      const totalAmount = await this.getBalance(wallet.address);

      // 获取 gas 价格
      const gasInfo = await this.ethUtil.estimateGas(
        wallet.address,
        this.collectAddress,
        totalAmount,
      );

      // 计算实际转账金额（总额 - gas 费）
      const amount = totalAmount - gasInfo.gasFee;
      if (amount <= 0n) {
        return;
      }

      // 发送交易
      wallet
        .sendTransaction({
          to: this.collectAddress,
          value: amount,
          gasLimit: gasInfo.gasLimit,
          gasPrice: gasInfo.gasPrice,
        })
        .then((tx: ethers.TransactionResponse) => {
          // 创建归集交易记录
          const txEntity = this.buildCollectEntity(relTx);
          txEntity.hash = tx.hash;
          txEntity.amount = amount.toString();
          txEntity.gasFee = gasInfo.gasFee.toString();
          this.saveTx(txEntity, relTx).then((txId: number) => {
            this.waitTx(tx, txId, callback);
          });
        })
        .catch((error) => {
          this.logger.error(`Collect ETH transaction failed:`, error.message);
        });
    } catch (error) {
      this.logger.error(`Collect ETH failed:`, error.message);
    }
  }

  /**
   * 归集 ERC20
   */
  private async collectERC20Token(
    wallet: ethers.Wallet,
    relTx: BaseTransactionEntity,
    callback: (txID: number, data: any) => void,
  ): Promise<void> {
    try {
      const gasInfo = await this.ethUtil.estimateERC20Gas(
        wallet.address,
        relTx.contract,
        this.collectAddress,
        BigInt(relTx.amount),
      );

      const ethBalance = await this.ethUtil.getETHBalance(wallet.address);

      this.logger.debug(
        `Estimated gas: ${gasInfo.gasLimit}, gas price: ${gasInfo.gasPrice}, gas fee: ${gasInfo.gasFee}, ETH balance: ${ethBalance}`,
      );

      // 如果 ETH 不足，先转 gas
      if (ethBalance < gasInfo.gasFee) {
        return await this.fundGas(
          wallet.address,
          gasInfo.gasFee - ethBalance,
          (from: string, txHash: string, status: number) => {
            const txEntity = new TransactionCollectEthEntity();
            txEntity.hash = txHash;
            txEntity.from = from;
            txEntity.to = wallet.address;
            txEntity.amount = gasInfo.gasFee.toString();
            txEntity.gasFee = gasInfo.gasFee.toString();
            txEntity.status = TransactionStatus.PENDING;
            if (status === 1) {
              txEntity.status = TransactionStatus.CONFIRMED;
              this.transferERC20(wallet, relTx, gasInfo, callback);
            }
            this.saveGasTx(txEntity, relTx);
          },
        );
      }

      // ETH 足够，直接转 ERC20
      return await this.transferERC20(wallet, relTx, gasInfo, callback);
    } catch (error) {
      this.logger.error(`Collect ERC20 failed:`, error.message);
      return;
    }
  }

  /**
   * 执行 ERC20 转账
   */
  private async transferERC20(
    wallet: ethers.Wallet,
    relTx: BaseTransactionEntity,
    gasInfo: EthGasInfo,
    callback: (txID: number, data: any) => void,
  ): Promise<void> {
    try {
      const contract = this.ethUtil.getContract(relTx.contract, wallet);
      // 获取当前余额（已经是最小单位，无需转换）
      const amount = await contract.balanceOf(wallet.address);
      if (amount === 0n) {
        this.logger.warn(`No ERC20 balance to collect for address: ${wallet.address}`);
        return;
      }

      contract
        .transfer(this.collectAddress, amount, {
          gasLimit: gasInfo.gasLimit,
          gasPrice: gasInfo.gasPrice,
        })
        .then((tx: ethers.ContractTransactionResponse) => {
          // 创建归集交易记录
          const txEntity = this.buildCollectEntity(relTx) as TransactionCollectEthEntity;
          txEntity.hash = tx.hash;
          txEntity.amount = amount.toString();
          txEntity.gasFee = gasInfo.gasFee.toString();
          this.saveTx(txEntity, relTx).then((txId: number) => {
            this.waitTx(tx, txId, callback);
          });
        })
        .catch((error) => {
          this.logger.error(`Transfer ERC20 transaction failed:`, error.message);
        });
    } catch (error) {
      this.logger.error(`Transfer ERC20 failed:`, error.message);
      return;
    }
  }

  /**
   * 补充 gas 费
   */
  private async fundGas(
    toAddress: string,
    gasFee: bigint,
    callback: (from: string, txHash: string, status: number) => void,
  ): Promise<void> {
    try {
      const feePrivateKey = await this.getGasWalletPrivateKey();
      if (!feePrivateKey) {
        this.logger.error('Failed to get fee wallet private key');
        return;
      }

      const ethUtil = new EthUtil(this.chain.rpcUrl, feePrivateKey);
      const wallet = ethUtil.getWallet();
      const balance = await ethUtil.getETHBalance(wallet.address);
      if (balance < gasFee) {
        this.logger.error(`Gas fee not enough: ${ethers.formatEther(gasFee)} ETH`);
        return;
      }
      const from = wallet.address;

      wallet
        .sendTransaction({
          to: toAddress,
          value: gasFee,
        })
        .then((tx: ethers.TransactionResponse) => {
          // 等待交易确认
          tx.wait()
            .then((receipt) => {
              if (receipt && receipt.status === 1) {
                callback(from, tx.hash, TransactionStatus.CONFIRMED);
              } else {
                callback(from, tx.hash, TransactionStatus.FAILED);
              }
            })
            .catch((err) => {
              this.logger.error(`Collect ETH transaction failed:`, err.message);
              callback(from, tx.hash, TransactionStatus.FAILED);
            });
        })
        .catch((error) => {
          this.logger.error(`Fund gas transaction failed:`, error.message);
        });
    } catch (error) {
      this.logger.error(`Fund gas failed:`, error.message);
      return;
    }
  }

  /**
   * 监听交易确认
   */
  private waitTx(
    tx: ethers.TransactionResponse,
    txId: number,
    callback: (txID: number, data: any) => void,
  ): void {
    // 等待交易确认
    tx.wait()
      .then((receipt: ethers.TransactionReceipt) => {
        const gasLimitUsed = receipt.gasUsed;
        const gasPrice = receipt.gasPrice;
        const actualGasFee = gasLimitUsed * gasPrice;
        callback(txId, {
          status:
            receipt && receipt.status === 1
              ? TransactionStatus.CONFIRMED
              : TransactionStatus.FAILED,
          gasFee: actualGasFee.toString(),
          blockNumber: receipt.blockNumber,
        });
      })
      .catch((err) => {
        this.logger.error(`Collect ETH transaction failed:`, err.message);
        callback(txId, { status: TransactionStatus.FAILED });
      });
  }
}
