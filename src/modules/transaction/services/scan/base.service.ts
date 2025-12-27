import { Logger } from '@nestjs/common';
import { ChainService } from '@/modules/chain/services/chain.service';
import { ChainAddressService } from '@/modules/user/services/chain-address.service';
import { TokenService } from '@/modules/chain/services/token.service';
import { ConfigService } from '@/shared/config/config.service';
import { ChainEntity } from '@/entities/chain.entity';
import { sleep } from 'tronweb/utils';
import { ChainTransaction } from '../../transaction.constant';
import { BaseTransactionEntity } from '@/entities/txs/base.entity';
import { TransactionStatus } from '@/constants';
import { DepositService } from '@/modules/order/services/deposit.service';
import { DatabaseService } from '@/shared/database/database.service';

/**
 * 区块链扫描任务基类
 * 提供通用的扫描逻辑和状态管理
 */
export abstract class BaseScanService {
  protected readonly logger = new Logger(this.constructor.name);
  protected abstract readonly chainType: number;
  protected abstract readonly chainCode: string;

  protected isScanning = false;
  protected currentScannedBlock = 0; // 当前扫描到的区块号
  protected chain: ChainEntity;

  constructor(
    protected readonly chainService: ChainService,
    protected readonly chainAddressService: ChainAddressService,
    protected readonly configService: ConfigService,
    protected readonly tokenService: TokenService,
    protected readonly depositService: DepositService,
    protected readonly databaseService: DatabaseService,
  ) { }

  /**
   * 主要扫描方法 - 由子类通过定时器调用
   */
  async scanBlock(): Promise<void> {
    if (this.isScanning) {
      this.logger.debug(`scan already running, skipping`);
      return;
    }

    this.isScanning = true;
    try {
      await this.scan();
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * 执行扫描的核心逻辑
   */
  protected async scan(): Promise<void> {
    try {
      if (!this.chain) {
        this.chain = await this.chainService.getChainConfig(this.chainCode);
        if (!this.chain) {
          return;
        }
      }

      this.init();

      // 2. 获取最新区块号
      const latestBlock = await this.getLatestBlockNumber();

      // 3. 获取上次扫描的区块号
      let lastScannedBlock = await this.configService.getLastScannedBlock(this.chainCode);

      // 4. 如果是首次扫描，从最新区块前的一个区块开始，这样至少会扫描最新区块
      if (lastScannedBlock === 0) {
        lastScannedBlock = Math.max(0, latestBlock - 1);
      }

      // 5. 初始化当前扫描区块号缓存
      this.currentScannedBlock = lastScannedBlock;

      // 6. 计算需要扫描的区块范围
      const endBlock = latestBlock;
      let startBlock = lastScannedBlock + 1;
      if (startBlock > endBlock) {
        startBlock = endBlock;
      }

      this.logger.log(`${this.chainCode}: Scanning blocks ${startBlock} to ${endBlock}`);

      // 7. 执行具体的扫描逻辑
      const foundTxCount = await this.scanBlockRange(startBlock, endBlock);

      // 8. 记录扫描结果
      if (foundTxCount > 0) {
        this.logger.log(
          `${this.chainCode}: Scan completed, found ${foundTxCount} transactions ` +
          `in blocks ${startBlock}-${endBlock}`
        );
      }

      // 9. 扫描完成后统一写入最终的区块号到数据库
      if (this.currentScannedBlock > lastScannedBlock) {
        await this.configService.setLastScannedBlock(this.chainCode, this.currentScannedBlock);
      }

    } catch (error) {
      this.logger.error(`${this.chainCode} scan failed:`, error.message);
    }
  }

  /**
   * 扫描指定区块范围
   */
  protected async scanBlockRange(startBlock: number, endBlock: number): Promise<number> {
    let foundTxCount = 0;

    for (let blockNum = startBlock; blockNum <= endBlock; blockNum++) {
      const txCount = await this.scanSingleBlock(blockNum);

      foundTxCount += txCount;

      // 更新当前扫描进度（仅内存缓存）
      if (blockNum > this.currentScannedBlock) {
        this.currentScannedBlock = blockNum;
      }
      // 避免过快扫描，稍作休息
      await sleep(100);
    }

    return foundTxCount;
  }

  /**
   * 扫描单个区块 - 子类实现
   * @param chain 链配置
   * @param blockNumber 区块号
   * @returns 找到的交易数量
   */
  protected async scanSingleBlock(blockNumber: number): Promise<number> {
    try {
      // Step 1: 高效获取区块完整交易数据
      const allTxs = await this.getBlockTxs(blockNumber);
      if (allTxs.length === 0) {
        return 0;
      }

      // Step 2: 提取所有接收地址
      const receiverAddresses = this.receiversOf(allTxs);

      // Step 3: 批量查询监控地址
      const monitoredAddresses = await this.chainAddressService.getAddressesByChain(
        this.chainType,
        Array.from(receiverAddresses)
      );
      const monitoredSet = new Set(monitoredAddresses.map(addr => addr.toLowerCase()));

      // Step 4: 批量处理目标交易
      const targetTransactions = this.filterMonitoredTxs(allTxs, monitoredSet);

      // Step 5: 处理目标交易
      for (const tx of targetTransactions) {
        await this.handleTx(tx);
      }

      return targetTransactions.length;
    } catch (error) {
      this.logger.warn(`Failed to scan ETH block ${blockNumber}:`, error.message);
      return 0;
    }
  }

  /**
   * 获取代币符号
   */
  protected async getTokenSymbol(contractAddress: string): Promise<IChainToken | null> {
    if (!contractAddress) return null;

    try {
      // 使用 TokenService 从数据库获取代币符号
      return await this.tokenService.getCodeByAddress(this.chainType, contractAddress);
    } catch (error) {
      this.logger.warn(`Failed to get token symbol for ${contractAddress}:`, error.message);
      return null;
    }
  }

  /**
   * 过滤目标交易
   */
  protected filterMonitoredTxs(
    transactions: ChainTransaction[],
    monitoredAddressSet: Set<string>
  ): ChainTransaction[] {
    return transactions.filter(tx => {
      const receiverAddress = this.receiverOf(tx);

      // 检查接收地址是否在监控列表中
      if (receiverAddress && monitoredAddressSet.has(receiverAddress.toLowerCase())) {
        // 主币交易需检查最小金额
        if (this.isNative(tx) && !this.checkMinAmount(tx.value)) {
          return false;
        }

        tx.isTarget = true;
        tx.role = 'receiver';
        return true;
      }

      return false;
    });
  }

  /**
   * 判断是否主币交易
   */
  protected isNative(tx: ChainTransaction): boolean {
    return !tx.contract?.address;
  }

  /**
   * 检查金额是否满足最小要求
   */
  protected checkMinAmount(amount: string): boolean {
    const minAmount = this.chain.minAmount;
    if (!minAmount || minAmount === '0') return true;

    return BigInt(amount) >= BigInt(minAmount);
  }

  /**
   * 提取交易中的所有接收地址
   */
  protected receiversOf(txs: ChainTransaction[]): Set<string> {
    const receivers = new Set<string>();

    txs.forEach(tx => {
      const receiver = this.receiverOf(tx);
      if (receiver) {
        receivers.add(receiver);
      }
    });

    return receivers;
  }

  /**
   * 获取单笔交易的接收地址（如有）
   */
  protected receiverOf(tx: ChainTransaction): string | null {
    return tx?.to || null;
  }

  /**
     * 处理发现的充值交易
     */
  protected async handleTx(tx: ChainTransaction): Promise<void> {
    try {
      const targetAddress = this.receiverOf(tx);
      if (!targetAddress) {
        return;
      }

      const userId = await this.chainAddressService.getUserIdByAddress(targetAddress);
      if (!userId) {
        return;
      }

      await this.databaseService.runTransaction(async (queryRunner) => {
        const txEntity = await this.buildTransactionEntity(tx, userId, targetAddress);

        // 先检查 hash 是否已经存在
        const exists = await queryRunner.manager.findOne(txEntity.constructor, {
          where: { hash: tx.hash }
        });
        if (exists) {
          this.logger.debug(`Transaction hash already exists: ${tx.hash}`);
          return;
        }

        const depositPayload = Object.assign(txEntity);
        await queryRunner.manager.save(txEntity);
        await this.depositService.create(queryRunner, this.chain.id, depositPayload);
      });
    } catch (error) {
      this.logger.error(`Failed to process transaction ${tx.hash}:`, error.message);
    }
  }

  protected async buildTransactionEntity(
    tx: ChainTransaction,
    userId: number,
    targetAddress: string,
  ): Promise<BaseTransactionEntity> {
    const entity = this.buildEntity();
    entity.userId = userId;
    entity.hash = tx.hash;
    entity.from = tx.from;
    entity.to = targetAddress;
    // 对于 ERC20/TRC20 交易，使用 contract.amount；否则使用 tx.value
    entity.amount = tx.contract?.amount || tx.value;
    entity.blockNumber = tx.blockNumber;
    entity.timestamp = tx.timestamp;
    entity.status = TransactionStatus.PENDING;
    entity.rawData = tx.raw ? JSON.stringify(tx.raw) : null;
    entity.contract = tx.contract?.address || null;

    if (tx.contract?.address) {
      const tokenInfo = await this.getTokenSymbol(tx.contract?.address);
      entity.token = tokenInfo.code || this.chainCode;
      entity.decimals = tokenInfo.decimals || this.chain.decimals;
    } else {
      entity.token = this.chain.token;
      entity.decimals = this.chain.decimals;
    }

    return entity;
  }

  // =================== 抽象方法 - 子类必须实现 ===================

  /**
   * 初始化 - 子类实现
   */
  protected abstract init(): void;

  /**
   * 获取最新区块号 - 子类实现
   */
  protected abstract getLatestBlockNumber(): Promise<number>;

  /**
   * 获取区块内的完整交易列表 - 子类实现
   */
  protected abstract getBlockTxs(blockNumber: number): Promise<ChainTransaction[]>;

  /**
   * 解析链交易 - 子类实现
   * @param tx 链上交易原始数据
   */
  protected abstract parseTx(tx: any, blockNumber: number, blockTimestamp: number, options?: any): ChainTransaction;

  protected abstract buildEntity(): BaseTransactionEntity;
}