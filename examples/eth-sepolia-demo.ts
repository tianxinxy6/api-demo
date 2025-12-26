import { EthUtil } from '../src/utils/eth.util';

/**
 * ETH Sepolia 测试网 Demo - 修复版
 * 
 * 主要修复：
 * 1. 解决 ethers v6 getBlock() 无法获取完整交易详情的问题
 * 2. 使用更高效的批量获取方法
 * 3. 优化错误处理和性能
 */

// ETH Sepolia 测试网配置
const SEPOLIA_TESTNET_URL = 'https://sepolia.infura.io/v3/b88dc0d822ba4d06b2e0d2b0fae8f816';
// const TARGET_BLOCK_NUMBER = 9866401;
const TARGET_BLOCK_NUMBER = 9866403;
const TARGET_ADDRESS = '0xB07d3DD505404F7d1A8B5016a2CFF7E185Cb77Ec';

interface BlockTransactionInfo {
  hash: string;
  from: string;
  to: string;
  value: string;
  valueInEth: string;
  gasPrice: string;
  gasUsed?: string;
  gas: string;
  nonce: number;
  blockNumber: number;
  transactionIndex: number;
  timestamp?: number;
  isTargetTransaction: boolean;
  role: 'sender' | 'receiver' | 'none';
  data?: string;
  isContractCall: boolean;
  transactionType: 'ETH_TRANSFER' | 'ERC20_TRANSFER' | 'CONTRACT_CALL' | 'OTHER';
  erc20Details?: {
    contractAddress: string;
    method: string;
    recipient?: string;
    amount?: string;
  };
}

class EthSepoliaDemoFixed {
  private ethUtil: EthUtil;

  constructor() {
    this.ethUtil = new EthUtil(SEPOLIA_TESTNET_URL);
  }

  /**
   * 运行修复版 demo
   */
  async run(): Promise<void> {
    try {
      console.log('🚀 ETH Sepolia 测试网 Demo (修复版) 开始运行...\n');

      // 1. 验证目标地址格式
      await this.validateAddress();

      // 2. 获取目标区块信息
      await this.getBlockInfo();

      // 3. 分析区块中的交易（使用修复方案）
      await this.analyzeBlockTransactionsFixed();

      // 4. 获取目标地址的账户信息
      await this.getAccountInfo();

      console.log('\n✅ Demo 运行完成！');

    } catch (error) {
      console.error('❌ Demo 运行失败:', error.message);
      throw error;
    }
  }

  /**
   * 验证目标地址格式
   */
  private async validateAddress(): Promise<void> {
    console.log('📋 步骤 1: 验证目标地址格式');
    console.log(`目标地址: ${TARGET_ADDRESS}`);

    const isValid = EthUtil.validateAddress(TARGET_ADDRESS);
    if (!isValid) {
      throw new Error('无效的以太坊地址格式');
    }

    console.log(`地址验证: ✅ 有效`);
    console.log('');
  }

  /**
   * 获取目标区块信息
   */
  private async getBlockInfo(): Promise<any> {
    console.log('📋 步骤 2: 获取目标区块信息');
    console.log(`目标区块号: ${TARGET_BLOCK_NUMBER}`);

    try {
      // 使用不包含交易详情的方式获取基本区块信息
      const block = await this.ethUtil.getBlock(TARGET_BLOCK_NUMBER);
      
      if (!block) {
        throw new Error('区块不存在');
      }

      console.log('区块信息:');
      console.log(`  区块哈希: ${block.hash}`);
      console.log(`  区块号: ${block.number}`);
      console.log(`  时间戳: ${block.timestamp} (${new Date(block.timestamp * 1000).toLocaleString()})`);
      console.log(`  父区块哈希: ${block.parentHash}`);
      console.log(`  交易数量: ${block.transactions?.length || 0}`);
      console.log(`  Gas 使用量: ${block.gasUsed}`);
      console.log(`  Gas 限制: ${block.gasLimit}`);
      console.log('');

      return block;
    } catch (error) {
      throw new Error(`获取区块信息失败: ${error.message}`);
    }
  }

  /**
   * 方案1: 使用 provider.send() 直接调用 JSON-RPC
   */
  private async getBlockWithFullTransactions(blockNumber: number): Promise<any> {
    // 获取 provider 实例
    const provider = (this.ethUtil as any).provider;
    
    // 直接使用 JSON-RPC 调用
    const blockHex = `0x${blockNumber.toString(16)}`;
    return await provider.send('eth_getBlockByNumber', [blockHex, true]);
  }

  /**
   * 方案2: 批量获取交易详情（推荐用于大量交易的场景）
   */
  private async batchGetTransactionDetails(txHashes: string[]): Promise<any[]> {
    const provider = (this.ethUtil as any).provider;
    const batchSize = 10; // 每批次处理的交易数量
    const results = [];

    for (let i = 0; i < txHashes.length; i += batchSize) {
      const batch = txHashes.slice(i, i + batchSize);
      console.log(`📥 批量获取交易详情 ${i + 1}-${Math.min(i + batchSize, txHashes.length)}/${txHashes.length}`);
      
      const batchPromises = batch.map(hash => 
        provider.send('eth_getTransactionByHash', [hash])
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 分析区块中的交易（修复版）
   */
  private async analyzeBlockTransactionsFixed(): Promise<void> {
    console.log('📋 步骤 3: 分析区块中的交易（修复版）');

    try {
      console.log('🔧 使用修复方案: 直接 JSON-RPC 调用');
      
      // 方案1: 使用直接 JSON-RPC 调用获取完整交易详情
      const blockWithTxs = await this.getBlockWithFullTransactions(TARGET_BLOCK_NUMBER);
      const transactions = blockWithTxs.transactions || [];

      if (transactions.length === 0) {
        console.log('该区块中没有交易');
        return;
      }

      console.log(`✅ 成功获取 ${transactions.length} 笔完整交易详情`);
      console.log(`第一个交易类型验证: ${typeof transactions[0]}`);

      const targetTransactions: BlockTransactionInfo[] = [];
      let totalAnalyzed = 0;

      for (const tx of transactions) {
        // 现在 tx 是完整的交易对象，不是哈希
        const txInfo = this.analyzeTransaction(tx);
        
        if (txInfo.isTargetTransaction) {
            console.log('🎯 找到目标地址相关交易:', tx);
          targetTransactions.push(txInfo);
          console.log(`\n🎯 找到目标交易 ${txInfo.hash}:`);
          console.log(`  类型: ${this.getTransactionTypeDisplay(txInfo.transactionType)}`);
          console.log(`  发送方: ${tx.from}`);
          console.log(`  接收方: ${tx.to || '合约创建'}`);
          
          if (txInfo.transactionType === 'ERC20_TRANSFER' && txInfo.erc20Details) {
            console.log(`  ERC20 合约: ${txInfo.erc20Details.contractAddress}`);
            console.log(`  方法: ${txInfo.erc20Details.method}`);
            if (txInfo.erc20Details.recipient) {
              console.log(`  代币接收方: ${txInfo.erc20Details.recipient}`);
            }
            if (txInfo.erc20Details.amount) {
              console.log(`  代币数量: ${this.formatTokenAmount(txInfo.erc20Details.amount)} (假设18位小数)`);
            }
          } else {
            console.log(`  ETH 金额: ${tx.value?.toString() || '0'} Wei (${EthUtil.fromWei(tx.value?.toString() || '0')} ETH)`);
          }
          
          console.log(`  Gas 价格: ${tx.gasPrice}`);
          console.log(`  Gas 限制: ${tx.gasLimit || tx.gas || 'N/A'}`);
          console.log(`  数据: ${tx.input?.substring(0, 20)}${tx.input?.length > 20 ? '...' : ''}`);
          console.log(`  角色: ${txInfo.role === 'sender' ? '发送方' : '接收方'}`);
        }

        totalAnalyzed++;

        // 显示进度
        if (totalAnalyzed % 50 === 0 || totalAnalyzed === transactions.length) {
          console.log(`  📈 分析进度: ${totalAnalyzed}/${transactions.length}`);
        }
      }

      console.log(`\n📊 分析结果:`);
      console.log(`  总交易数: ${transactions.length}`);
      console.log(`  成功分析: ${totalAnalyzed}`);
      console.log(`  目标地址相关交易: ${targetTransactions.length}`);

      if (targetTransactions.length > 0) {
        console.log('\n🎯 目标地址相关交易详情:');
        targetTransactions.forEach((tx, index) => {
          console.log(`\n  交易 ${index + 1}:`);
          console.log(`    交易哈希: ${tx.hash}`);
          console.log(`    交易类型: ${this.getTransactionTypeDisplay(tx.transactionType)}`);
          console.log(`    发送方: ${tx.from}`);
          console.log(`    接收方: ${tx.to}`);
          
          if (tx.transactionType === 'ERC20_TRANSFER' && tx.erc20Details) {
            console.log(`    ERC20 合约: ${tx.erc20Details.contractAddress}`);
            console.log(`    代币方法: ${tx.erc20Details.method}`);
            if (tx.erc20Details.recipient) {
              console.log(`    代币接收方: ${tx.erc20Details.recipient}`);
            }
            if (tx.erc20Details.amount) {
              console.log(`    代币数量: ${this.formatTokenAmount(tx.erc20Details.amount)} (假设18位小数)`);
            }
          } else {
            console.log(`    ETH 金额: ${tx.value} Wei (${tx.valueInEth} ETH)`);
          }
          
          console.log(`    Gas 价格: ${tx.gasPrice}`);
          console.log(`    Gas 限制: ${tx.gas}`);
          console.log(`    Nonce: ${tx.nonce}`);
          console.log(`    交易索引: ${tx.transactionIndex}`);
          console.log(`    地址角色: ${tx.role === 'sender' ? '发送方' : '接收方'}`);
          console.log(`    合约调用: ${tx.isContractCall ? '是' : '否'}`);
          
          if (tx.data && tx.data !== '0x') {
            console.log(`    数据: ${tx.data.substring(0, 50)}${tx.data.length > 50 ? '...' : ''}`);
          }
        });
      } else {
        console.log('\n  ℹ️ 在该区块中未找到目标地址相关的交易');
      }
      console.log('');

    } catch (error) {
      throw new Error(`分析区块交易失败: ${error.message}`);
    }
  }

  /**
   * 分析单个交易（增强版 - 支持 ERC20 交易识别）
   */
  private analyzeTransaction(tx: any): BlockTransactionInfo {
    const from = tx.from?.toLowerCase() || '';
    const to = (tx.to?.toLowerCase() || '').toLowerCase();
    const targetAddress = TARGET_ADDRESS.toLowerCase();
    const input = tx.input || '0x';

    // 初始化交易信息
    let isTargetTransaction = false;
    let role: 'sender' | 'receiver' | 'none' = 'none';
    let transactionType: 'ETH_TRANSFER' | 'ERC20_TRANSFER' | 'CONTRACT_CALL' | 'OTHER' = 'OTHER';
    let erc20Details: any = undefined;

    // 1. 检查常规 ETH 转账
    if (from === targetAddress || to === targetAddress) {
      isTargetTransaction = true;
      role = from === targetAddress ? 'sender' : 'receiver';
      if (input === '0x' || input.length <= 2) {
        transactionType = 'ETH_TRANSFER';
      }
    }

    // 2. 检查 ERC20 交易
    if (input && input.length > 2) {
      const erc20Analysis = this.analyzeERC20Transaction(input, targetAddress, to);
      if (erc20Analysis.isERC20Transaction) {
        transactionType = 'ERC20_TRANSFER';
        erc20Details = {
          contractAddress: to,
          method: erc20Analysis.method,
          recipient: erc20Analysis.recipient,
          amount: erc20Analysis.amount,
        };

        // 检查目标地址是否涉及此 ERC20 交易
        if (from === targetAddress) {
          isTargetTransaction = true;
          role = 'sender';
        } else if (erc20Analysis.recipient?.toLowerCase() === targetAddress) {
          isTargetTransaction = true;
          role = 'receiver';
        }
      } else {
        transactionType = 'CONTRACT_CALL';
      }
    }

    // 检查是否为合约调用
    const isContractCall = Boolean(input && input !== '0x' && input.length > 2);

    // 处理交易金额
    const valueInWei = tx.value?.toString() || '0';
    const valueInEth = EthUtil.fromWei(valueInWei);

    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to || '',
      value: valueInWei,
      valueInEth: valueInEth,
      gasPrice: tx.gasPrice?.toString() || '0',
      gas: tx.gasLimit?.toString() || tx.gas?.toString() || '0',
      nonce: tx.nonce || 0,
      blockNumber: parseInt(tx.blockNumber, 16) || 0,
      transactionIndex: parseInt(tx.transactionIndex, 16) || 0,
      isTargetTransaction,
      role,
      data: tx.input,
      isContractCall,
      transactionType,
      erc20Details,
    };
  }

  /**
   * 分析 ERC20 交易数据
   */
  private analyzeERC20Transaction(input: string, targetAddress: string, contractAddress: string): {
    isERC20Transaction: boolean;
    method: string;
    recipient?: string;
    amount?: string;
  } {
    try {
      // ERC20 标准方法签名
      const ERC20_METHODS = {
        'a9059cbb': 'transfer', // transfer(address,uint256)
        '23b872dd': 'transferFrom', // transferFrom(address,address,uint256)
        '095ea7b3': 'approve', // approve(address,uint256)
      };

      if (input.length < 10) {
        return { isERC20Transaction: false, method: 'unknown' };
      }

      // 获取方法签名（前4字节）
      const methodSignature = input.slice(2, 10).toLowerCase();
      const methodName = ERC20_METHODS[methodSignature];

      if (!methodName) {
        return { isERC20Transaction: false, method: 'unknown' };
      }

      // 解析参数
      const params = input.slice(10);
      let recipient: string | undefined;
      let amount: string | undefined;

      try {
        if (methodName === 'transfer' && params.length >= 128) {
          // transfer(address to, uint256 amount)
          recipient = '0x' + params.slice(24, 64);
          amount = BigInt('0x' + params.slice(64, 128)).toString();
        } else if (methodName === 'transferFrom' && params.length >= 192) {
          // transferFrom(address from, address to, uint256 amount)
          recipient = '0x' + params.slice(88, 128);
          amount = BigInt('0x' + params.slice(128, 192)).toString();
        } else if (methodName === 'approve' && params.length >= 128) {
          // approve(address spender, uint256 amount)
          recipient = '0x' + params.slice(24, 64);
          amount = BigInt('0x' + params.slice(64, 128)).toString();
        }
      } catch (parseError) {
        console.warn(`解析 ERC20 参数失败:`, parseError.message);
      }

      return {
        isERC20Transaction: true,
        method: methodName,
        recipient,
        amount,
      };
    } catch (error) {
      return { isERC20Transaction: false, method: 'unknown' };
    }
  }

  /**
   * 获取交易类型显示文本
   */
  private getTransactionTypeDisplay(type: string): string {
    const typeMap = {
      'ETH_TRANSFER': 'ETH 转账',
      'ERC20_TRANSFER': 'ERC20 代币转账', 
      'CONTRACT_CALL': '合约调用',
      'OTHER': '其他'
    };
    return typeMap[type] || '未知';
  }

  /**
   * 格式化代币数量显示
   */
  private formatTokenAmount(amount: string, decimals: number = 18): string {
    try {
      const amountBigInt = BigInt(amount);
      const divisor = BigInt(10 ** decimals);
      const integerPart = amountBigInt / divisor;
      const remainder = amountBigInt % divisor;
      
      if (remainder === BigInt(0)) {
        return integerPart.toString();
      } else {
        const fractionalPart = remainder.toString().padStart(decimals, '0');
        return `${integerPart}.${fractionalPart.replace(/0+$/, '')}`;
      }
    } catch (error) {
      return amount; // 如果格式化失败，返回原始值
    }
  }

  /**
   * 获取目标地址的账户信息
   */
  private async getAccountInfo(): Promise<void> {
    console.log('📋 步骤 4: 获取目标地址的账户信息');

    try {
      // 获取余额信息
      const balanceInfo = await this.ethUtil.getBalance(TARGET_ADDRESS);
      console.log('余额信息:');
      console.log(`  地址: ${balanceInfo.address}`);
      console.log(`  余额: ${balanceInfo.balance} Wei`);
      console.log(`  余额 (ETH): ${balanceInfo.balanceEth} ETH`);

      // 获取交易计数（nonce）
      const transactionCount = await this.ethUtil.getTransactionCount(TARGET_ADDRESS);
      console.log(`  交易计数: ${transactionCount}`);
    

      console.log('');

    } catch (error) {
      throw new Error(`获取账户信息失败: ${error.message}`);
    }
  }
}

/**
 * 运行修复版 demo
 */
async function main() {
  const demo = new EthSepoliaDemoFixed();
  await demo.run();
}

// 如果直接运行此文件，则执行 demo
if (require.main === module) {
  main().catch(console.error);
}

export { EthSepoliaDemoFixed };