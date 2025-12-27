import { Injectable } from '@nestjs/common';
import { ChainType, TransactionStatus } from '@/constants';
import { TronUtil } from '@/utils/tron.util';
import { BaseCollectService } from './base.service';
import { BaseTransactionEntity } from '@/entities/txs/base.entity';
import { ChainService } from '@/modules/chain/services/chain.service';
import { ChainAddressService } from '@/modules/user/services/chain-address.service';
import { SysWalletAddressService } from '@/modules/sys/services/sys-wallet.service';
import { DataSource } from 'typeorm';
import { DatabaseService } from '@/shared/database/database.service';
import { TransactionCollectTronEntity } from '@/entities/txs/collect/transaction-tron.entity';

/**
 * TRON 归集服务
 * 处理 TRON 链的资金归集（包括 TRX 和 TRC20 代币）
 */
@Injectable()
export class TronCollectService extends BaseCollectService {
  protected readonly chainCode = 'TRON';
  protected readonly chainType = ChainType.TRON;

  private tronUtil: TronUtil;
  private rpcUrl: string;

  // TRON 资源消耗常量（固定值）
  private readonly TRX_BANDWIDTH = 270; // TRX 转账固定消耗
  private readonly TRC20_BANDWIDTH = 350; // TRC20 转账固定消耗

  constructor(
    chainService: ChainService,
    chainAddressService: ChainAddressService,
    sysWalletAddressService: SysWalletAddressService,
    dataSource: DataSource,
    databaseService: DatabaseService,
  ) {
    super(
      chainService,
      chainAddressService,
      sysWalletAddressService,
      dataSource,
      databaseService,
    );
  }

  protected buildEntity(): TransactionCollectTronEntity {
    return new TransactionCollectTronEntity();
  }

  /**
   * 初始化 TRON 连接
   */
  protected async init(): Promise<void> {
    this.rpcUrl = this.chain.rpcUrl;
    this.tronUtil = new TronUtil(this.rpcUrl);
  }

  /**
   * 获取余额
   */
  protected async getBalance(address: string, contract?: string): Promise<string> {
    try {
      const tronWeb = this.tronUtil.getTronWeb();
      if (contract) {
        const contractInstance = await tronWeb.contract().at(contract);
        return (await contractInstance.balanceOf(address).call({ from: address })).toString();
      }
      return (await tronWeb.trx.getBalance(address)).toString();
    } catch (error) {
      this.logger.error(`Get balance failed for ${address}:`, error.message);
      throw error;
    }
  }

  /**
   * 执行归集交易
   */
  protected async executeCollect(tx: BaseTransactionEntity, privateKey: string): Promise<void> {
    try {
      this.tronUtil.setPrivateKey(privateKey);

      if (tx.contract) {
        return await this.collectTRC20(tx, this.editTxStatus.bind(this));
      }
      return await this.collectTRX(tx, this.editTxStatus.bind(this));
    } catch (error) {
      this.logger.error(`Execute collect failed for ${tx.from}:`, error.message);
    }
  }

  /**
   * 计算 TRX 转账所需的手续费
   * @param address 转账地址
   * @param balance 地址余额（可选，不传则自动查询）
   * @returns 实际需要燃烧的 TRX（单位：SUN）
   */
  private async calculateTrxFee(
    address: string,
    bandwidth: number = this.TRX_BANDWIDTH,
  ): Promise<bigint> {
    const tronWeb = this.tronUtil.getTronWeb();

    // 获取账户资源信息
    const accountResources = await tronWeb.trx.getAccountResources(address);
    const freeNetLimit = accountResources.freeNetLimit || 0;
    const freeNetUsed = accountResources.freeNetUsed || 0;
    const availableBandwidth = freeNetLimit - freeNetUsed;

    // 动态获取带宽价格
    const { bandwidthPrice } = await this.getResourcePrices();

    // 计算需要燃烧的 TRX（如果带宽不足）
    const bandwidthShortage = availableBandwidth < bandwidth
      ? bandwidth
      : 0;

    return BigInt(bandwidthShortage) * bandwidthPrice;
  }

  /**
   * 归集 TRX
   */
  private async collectTRX(relTx: BaseTransactionEntity, callback: (txID: number, data: any) => void): Promise<void> {
    try {
      const tronWeb = this.tronUtil.getTronWeb();

      // 获取账户余额
      const totalAmount = BigInt(await tronWeb.trx.getBalance(relTx.to));

      // 计算需要燃烧的手续费
      const actualFee = await this.calculateTrxFee(relTx.to);

      // 计算可转账金额
      const transferAmount = totalAmount - actualFee;

      this.logger.log(
        `TRX Collect - Balance: ${totalAmount} SUN, ` +
        `Fee: ${actualFee} SUN, ` +
        `Transfer: ${transferAmount} SUN`
      );

      if (transferAmount <= 0n) {
        this.logger.warn(`Transfer amount is zero or negative: ${transferAmount}`);
        return;
      }

      // 构建并发送交易
      const tx = await tronWeb.transactionBuilder.sendTrx(
        this.collectAddress,
        Number(transferAmount),
        relTx.to,
      );

      const signedTx = await tronWeb.trx.sign(tx);
      const result = await tronWeb.trx.sendRawTransaction(signedTx);
      if (!result.result) {
        console.log('result', result);
        this.logger.error(`TRX collect failed: ${result.code}: ${result.message}`);
        return;
      }

      // 保存归集交易记录
      const txEntity = this.buildCollectEntity(relTx) as TransactionCollectTronEntity;
      txEntity.hash = result.txid;
      txEntity.amount = transferAmount.toString();
      txEntity.blockNumber = 0;
      txEntity.gasFee = Number(actualFee); // 实际燃烧的 TRX 费用
      const txId = await this.saveTx(txEntity, relTx);

      this.logger.log(`TRX collect transaction sent: ${result.txid}, amount: ${transferAmount}, fee: ${actualFee}`);

      // 监听交易确认
      this.watchTx(result.txid, (status) => {
        callback(txId, { status });
      });
    } catch (error) {
      this.logger.error(`Collect TRX failed:`, error.message);
    }
  }

  /**
   * 归集 TRC20
   */
  private async collectTRC20(relTx: BaseTransactionEntity, callback: (txID: number, data: any) => void): Promise<void> {
    try {
      const tronWeb = this.tronUtil.getTronWeb();

      // 计算交易所需的手续费
      const gasFee = await this.calculateTrxFee(relTx.to, this.TRC20_BANDWIDTH);

      if (gasFee > 0n) {
        const trxBalance = BigInt(await tronWeb.trx.getBalance(relTx.to));
        if (trxBalance < gasFee) {
          // 先补充 TRX，确认后再执行 TRC20 转账
          await this.fundTrx(relTx.to, gasFee - trxBalance, async (from: string, txHash: string, status: number) => {
            const txEntity = new TransactionCollectTronEntity();
            txEntity.hash = txHash;
            txEntity.from = from;
            txEntity.to = relTx.to;
            txEntity.amount = gasFee.toString();
            txEntity.gasFee = Number(gasFee);
            txEntity.status = status;
            txEntity.blockNumber = 0;
            if (status === TransactionStatus.CONFIRMED) {
              await this.transferTRC20Token(relTx, gasFee, callback);
            }
            this.saveGasTx(txEntity, relTx);
          });

          return;
        }
      }

      // TRX 足够，直接转 TRC20
      await this.transferTRC20Token(relTx, gasFee, callback);
    } catch (error) {
      this.logger.error(`Collect TRC20 failed:`, error.message);
    }
  }

  /**
   * 执行 TRC20 代币转账
   */
  private async transferTRC20Token(
    relTx: BaseTransactionEntity,
    gasFee: bigint,
    callback: (txID: number, data: any) => void
  ): Promise<void> {
    try {
      const tronWeb = this.tronUtil.getTronWeb();
      const contract = await tronWeb.contract().at(relTx.contract);
      const balance = await contract.balanceOf(relTx.to).call({ from: relTx.to });

      const txHash = await contract.transfer(
        this.collectAddress,
        balance
      ).send({
        feeLimit: Number(gasFee),// gasFee 作为最大可能费用，实际费用会更低
        callValue: 0,
        from: relTx.to,
      });

      // 保存归集交易记录
      const txEntity = this.buildCollectEntity(relTx) as TransactionCollectTronEntity;
      txEntity.hash = txHash;
      txEntity.amount = balance;
      txEntity.blockNumber = 0;
      txEntity.gasFee = Number(gasFee); 
      const txId = await this.saveTx(txEntity, relTx);
      // 监听交易确认
      this.watchTx(txHash, (status) => {
        callback(txId, { status });
      });
    } catch (error) {
      this.logger.error(`Transfer TRC20 token failed:`, error.message);
      throw error;
    }
  }

  /**
   * 补充 TRX 费用
   */
  private async fundTrx(
    toAddress: string,
    gasFee: bigint,
    callback: (from: string, txHash: string, status: number) => void
  ): Promise<void> {
    try {
      const feePrivateKey = await this.getGasWalletPrivateKey();
      if (!feePrivateKey) {
        this.logger.error('Failed to get fee wallet private key');
        return;
      }

      const feeTronUtil = new TronUtil(this.rpcUrl);
      feeTronUtil.setPrivateKey(feePrivateKey);
      const tronWeb = feeTronUtil.getTronWeb();
      const feeWalletAddress = tronWeb.defaultAddress.base58;
      if (!feeWalletAddress) {
        this.logger.error('Failed to get fee wallet address');
        return;
      }
      const balance = await tronWeb.trx.getBalance(feeWalletAddress);
      const feeWalletBalance = BigInt(balance);
      if (feeWalletBalance < gasFee) {
        this.logger.error(
          `Fee wallet insufficient: need ${Number(gasFee) / 1_000_000} TRX, ` +
          `has ${Number(feeWalletBalance) / 1_000_000} TRX`
        );
        return;
      }

      const tx = await tronWeb.transactionBuilder.sendTrx(
        toAddress,
        Number(gasFee),
        feeWalletAddress
      );

      const signedTx = await tronWeb.trx.sign(tx);
      const result = await tronWeb.trx.sendRawTransaction(signedTx);

      if (!result.result) {
        this.logger.error(`Fund TRX failed: ${result.code || 'Unknown'}`);
        callback(feeWalletAddress, result.txid, TransactionStatus.FAILED);
        return;
      }

      this.logger.log(`TRX funded: ${Number(gasFee) / 1_000_000} TRX to ${toAddress}, tx: ${result.txid}`);

      // 监听交易确认并执行回调
      this.watchTx(result.txid, (status) => {
        callback(feeWalletAddress, result.txid, status);
      });

    } catch (error) {
      this.logger.error(`Fund TRX failed:`, error.message);
    }
  }

  /**
   * 获取链上资源价格
   */
  private async getResourcePrices(): Promise<{ energyPrice: bigint; bandwidthPrice: bigint }> {
    try {
      const tronWeb = this.tronUtil.getTronWeb();
      const chainParameters = await tronWeb.trx.getChainParameters();

      // 从链参数中获取 energy 和 bandwidth 的价格
      // getEnergyFee: 每个 energy 的价格（单位：SUN）
      // getTransactionFee: 每个 bandwidth 的价格（单位：SUN）
      const energyFeeParam = chainParameters.find((p: any) => p.key === 'getEnergyFee');
      const bandwidthFeeParam = chainParameters.find((p: any) => p.key === 'getTransactionFee');

      const energyPrice = energyFeeParam ? BigInt(energyFeeParam.value) : 100n; // 默认 100 SUN (2025 官方标准)
      const bandwidthPrice = bandwidthFeeParam ? BigInt(bandwidthFeeParam.value) : 1000n; // 默认 1000 SUN

      this.logger.debug(`Resource prices - Energy: ${energyPrice} SUN, Bandwidth: ${bandwidthPrice} SUN`);

      return { energyPrice, bandwidthPrice };
    } catch (error) {
      this.logger.warn(`Failed to get resource prices, using defaults:`, error.message);
      return { energyPrice: 100n, bandwidthPrice: 1000n };
    }
  }

  /**
   * 监听交易确认状态
   * 使用 getTransaction 作为主要判断依据（更可靠）
   */
  private async watchTx(
    txHash: string,
    callback: (status: TransactionStatus) => void,
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
    } catch (error) {
      this.logger.error(`watchTx failed for ${txHash}:`, error.message);
      callback(TransactionStatus.FAILED);
    }
  }

}
