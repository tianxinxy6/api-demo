import { Injectable } from '@nestjs/common';
import { EthUtil } from '@/utils/eth.util';
import { ChainType } from '@/constants';
import { BaseScanService } from './base.service';
import { ChainTransaction, ContractInfo } from '../../transaction.constant';
import { ChainService } from '@/modules/chain/services/chain.service';
import { ChainAddressService } from '@/modules/user/services/chain-address.service';
import { ChainTokenService } from '@/modules/chain/services/token.service';
import { AppConfigService } from '@/shared/config/config.service';
import { DepositService } from '@/modules/order/services/deposit.service';
import { DatabaseService } from '@/shared/database/database.service';
import { TransactionEthEntity } from '@/entities/txs/deposit/transaction-eth.entity';

// 定义交易类型
const TYPE_ETH_TRANSFER = 'ETH_TRANSFER';
const TYPE_ERC20_TRANSFER = 'ERC20_TRANSFER';
const TYPE_CONTRACT_CALL = 'CONTRACT_CALL';
const TYPE_OTHER = 'OTHER';

/**
 * ETH 链交易监控任务
 * ETH 平均出块时间：13秒，每6秒扫描一次确保及时发现交易
 */
@Injectable()
export class EthScanService extends BaseScanService {
  protected chainCode: string = 'ETH';
  protected chainType: number = ChainType.ETH;

  private ethUtil: EthUtil;

  constructor(
    chainService: ChainService,
    chainAddressService: ChainAddressService,
    configService: AppConfigService,
    tokenService: ChainTokenService,
    depositService: DepositService,
    databaseService: DatabaseService,
  ) {
    super(
      chainService,
      chainAddressService,
      configService,
      tokenService,
      depositService,
      databaseService,
    );
  }

  protected init(): void {
    this.ethUtil = new EthUtil(this.chain.rpcUrl);
  }

  /**
   * 实现基类抽象方法：获取最新区块号
   */
  protected async getLatestBlockNumber(): Promise<number> {
    return await this.ethUtil.getLatestBlockNumber();
  }

  /**
   * 获取区块内的完整交易列表
   */
  protected async getBlockTxs(blockNumber: number): Promise<ChainTransaction[]> {
    try {
      // 使用修复的方法获取完整交易详情
      const allTxs = await this.ethUtil.getBlockWithFullTransactions(blockNumber);
      if (!allTxs?.transactions) {
        return [];
      }

      const txs: ChainTransaction[] = [];
      const blockTimestamp = parseInt(allTxs.timestamp, 16);

      // 批量解析所有交易
      for (const tx of allTxs.transactions) {
        if (!tx?.hash) continue;

        const parsedTx = this.parseTx(tx, blockNumber, blockTimestamp);
        txs.push(parsedTx);
      }

      return txs;
    } catch (error) {
      this.logger.warn(`Failed to scan ETH block ${blockNumber}:`, error.message);
      return [];
    }
  }

  /**
   * 解析单个交易（支持 ETH 和 ERC20）
   */
  protected parseTx(tx: any, blockNumber: number, blockTimestamp: number): ChainTransaction {
    let to = tx.to || '';
    const input = tx.input || '0x';
    // 将十六进制的 value 转换为十进制字符串
    const value = tx.value ? BigInt(tx.value).toString() : '0';

    // 初始化交易信息
    let type: string = TYPE_OTHER;
    let contract: ContractInfo | null;

    // 检查是否为 ERC20 交易
    if (input && input.length > 2) {
      const parseData = this.parseErc20Data(input);
      if (parseData) {
        // ERC20 转账交易 to 字段为合约地址
        const { method, recipient, amount } = parseData;
        to = recipient || '';
        contract = {
          address: tx.to || '',
          method,
          amount,
        };
        type = TYPE_ERC20_TRANSFER;
      } else {
        type = TYPE_CONTRACT_CALL;
      }
    } else if (value !== '0') {
      type = TYPE_ETH_TRANSFER;
    }

    return {
      hash: tx.hash,
      from: tx.from || '',
      to,
      value,
      blockNumber,
      timestamp: blockTimestamp,
      type,
      contract,
      isTarget: false,
      raw: tx,
    };
  }

  protected buildEntity(): TransactionEthEntity {
    return new TransactionEthEntity();
  }

  /**
   * 分析 ERC20 交易数据
   */
  private parseErc20Data(
    input: string,
  ): { method: string; recipient: string; amount: string } | null {
    try {
      if (input.length < 10) {
        return null;
      }

      const ERC20_METHODS = {
        a9059cbb: 'transfer',
        '23b872dd': 'transferFrom',
        '095ea7b3': 'approve',
      };

      const methodSignature = input.slice(2, 10).toLowerCase();
      const method = ERC20_METHODS[methodSignature];
      if (!method) {
        return null;
      }

      const params = input.slice(10);
      let recipient: string | undefined;
      let amount: string | undefined;

      if (method === 'transfer' && params.length >= 128) {
        recipient = '0x' + params.slice(24, 64);
        amount = BigInt('0x' + params.slice(64, 128)).toString();
      } else if (method === 'transferFrom' && params.length >= 192) {
        recipient = '0x' + params.slice(88, 128);
        amount = BigInt('0x' + params.slice(128, 192)).toString();
      } else if (method === 'approve' && params.length >= 128) {
        recipient = '0x' + params.slice(24, 64);
        amount = BigInt('0x' + params.slice(64, 128)).toString();
      }

      return {
        method,
        recipient,
        amount,
      };
    } catch (error) {
      return null;
    }
  }
}
