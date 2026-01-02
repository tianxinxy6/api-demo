import { Injectable } from '@nestjs/common';
import { TronUtil } from '@/utils/tron.util';
import { ChainType } from '@/constants';
import { BaseScanService } from './base.service';
import { ChainTransaction, ContractInfo } from '../../transaction.constant';
import { TransactionTronEntity } from '@/entities/txs/deposit/transaction-tron.entity';

const TYPE_TRX_TRANSFER = 'TRX_TRANSFER';
const TYPE_TRC20_TRANSFER = 'TRC20_TRANSFER';
const TYPE_CONTRACT_CALL = 'CONTRACT_CALL';
const TYPE_OTHER = 'OTHER';

/**
 * TRON 链交易监控任务
 * TRON 平均出块时间：3秒，每3秒扫描一次确保及时发现交易
 *
 * 继承自 BaseScanService，自动获得父类的所有依赖注入
 * 不需要构造函数，使用属性注入模式
 */
@Injectable()
export class TronScanService extends BaseScanService {
  protected chainCode: string = 'TRON';
  protected chainType: number = ChainType.TRON;

  private tronUtil: TronUtil;

  protected init(): void {
    this.tronUtil = new TronUtil(this.chain.rpcUrl);
  }

  /**
   * 实现基类抽象方法：获取最新区块号
   */
  protected async getLatestBlockNumber(): Promise<number> {
    return await this.tronUtil.getLatestBlockNumber();
  }

  /**
   * 扫描单个 TRON 区块，解析所有交易
   */
  protected async getBlockTxs(blockNumber: number): Promise<ChainTransaction[]> {
    try {
      const block = await this.tronUtil.getBlock(blockNumber);
      if (!block?.transactions) {
        return [];
      }

      const txs: ChainTransaction[] = [];
      const blockTimestamp = block.block_header?.raw_data?.timestamp || Date.now();

      // 解析所有交易
      for (const tx of block.transactions) {
        if (!tx?.txID) continue;

        // TRON 交易可能包含多个合约调用
        const contracts = tx.raw_data?.contract || [];

        for (const contract of contracts) {
          const parsedTx = this.parseTx(tx, blockNumber, blockTimestamp, contract);
          if (parsedTx) {
            txs.push(parsedTx);
          }
        }
      }

      return txs;
    } catch (error) {
      this.logger.warn(`Failed to scan TRON block ${blockNumber}:`, error.message);
      return [];
    }
  }

  /**
   * 解析单个 TRON 交易
   */
  protected parseTx(
    tx: any,
    blockNumber: number,
    blockTimestamp: number,
    contract: any,
  ): ChainTransaction | null {
    try {
      let type = TYPE_OTHER;
      let from = '';
      let to: string | null = null;
      let value = '0';
      let contractInfo: ContractInfo | null;

      if (contract.type === 'TransferContract') {
        // TRX 转账交易
        const contractValue = contract.parameter?.value;
        if (contractValue?.amount) {
          type = TYPE_TRX_TRANSFER;
          from = contractValue.owner_address
            ? this.hexToTronAddress(contractValue.owner_address)
            : '';
          to = contractValue.to_address ? this.hexToTronAddress(contractValue.to_address) : null;
          value = contractValue.amount.toString();
        }
      } else if (contract.type === 'TriggerSmartContract') {
        // TRC20 或其他智能合约调用
        const contractValue = contract.parameter?.value;
        if (contractValue?.data) {
          const parseData = this.parseTrc20Data(contractValue.data);
          if (parseData) {
            const { method, recipient, amount } = parseData;

            type = TYPE_TRC20_TRANSFER;
            from = contractValue.owner_address
              ? this.hexToTronAddress(contractValue.owner_address)
              : '';
            to = recipient;
            value = amount;

            contractInfo = {
              address: contractValue.contract_address
                ? this.hexToTronAddress(contractValue.contract_address)
                : '',
              method,
              amount,
            };
          } else {
            type = TYPE_CONTRACT_CALL;
            from = contractValue.owner_address
              ? this.hexToTronAddress(contractValue.owner_address)
              : '';
            to = contractValue.contract_address
              ? this.hexToTronAddress(contractValue.contract_address)
              : null;
          }
        }
      }

      // 如果没有有效的交易信息，返回 null
      if (!from || !to) {
        return null;
      }

      return {
        hash: tx.txID,
        from,
        to,
        value,
        blockNumber,
        timestamp: Math.floor(blockTimestamp / 1000), // TRON 时间戳是毫秒，转换为秒
        type,
        contract: contractInfo,
        isTarget: false,
        role: 'none',
        raw: tx,
      };
    } catch (error) {
      this.logger.warn(`Failed to parse TRON transaction ${tx.txID}:`, error.message);
      return null;
    }
  }

  protected buildEntity(): TransactionTronEntity {
    return new TransactionTronEntity();
  }

  /**
   * 分析 TRC20 交易数据
   */
  private parseTrc20Data(
    data: string,
  ): { method: string; recipient: string; amount: string } | null {
    try {
      const TRC20_METHODS = {
        a9059cbb: 'transfer',
        '23b872dd': 'transferFrom',
        '095ea7b3': 'approve',
      };

      if (!data || data.length < 10) {
        return null;
      }

      const methodSignature = data.slice(0, 8).toLowerCase();
      const method = TRC20_METHODS[methodSignature];
      if (!method) {
        return null;
      }

      const params = data.slice(8);
      let recipient: string | undefined;
      let amount: string | undefined;

      if (method === 'transfer' && params.length >= 128) {
        // transfer(address,uint256)
        const toAddressHex = '41' + params.slice(24, 64); // TRON 地址前缀是 41
        recipient = this.hexToTronAddress(toAddressHex);
        amount = parseInt(params.slice(64, 128), 16).toString();
      } else if (method === 'transferFrom' && params.length >= 192) {
        // transferFrom(address,address,uint256)
        const toAddressHex = '41' + params.slice(88, 128);
        recipient = this.hexToTronAddress(toAddressHex);
        amount = parseInt(params.slice(128, 192), 16).toString();
      } else if (method === 'approve' && params.length >= 128) {
        // approve(address,uint256)
        const spenderAddressHex = '41' + params.slice(24, 64);
        recipient = this.hexToTronAddress(spenderAddressHex);
        amount = parseInt(params.slice(64, 128), 16).toString();
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

  /**
   * 将十六进制地址转换为 TRON 地址格式
   */
  private hexToTronAddress(hexAddress: string): string {
    try {
      if (!hexAddress) return '';

      // 如果已经是 TRON 格式地址，直接返回
      if (hexAddress.startsWith('T')) {
        return hexAddress;
      }

      // 使用 TronUtil 进行转换
      return TronUtil.hexToAddress(hexAddress);
    } catch (error) {
      this.logger.warn(`Failed to convert hex address ${hexAddress}:`, error.message);
      return '';
    }
  }
}
