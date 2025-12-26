import { TronUtil } from '../src/utils/tron.util';

/**
 * Tron Nile 测试链 Demo
 * 
 * 功能：
 * 1. 连接到 Tron Nile 测试链
 * 2. 获取指定区块（63200140）
 * 3. 检查指定地址（TXs6uNZvgkNkLruKKV54fUDBXbcjusukUL）的交易
 */

// Tron Nile 测试链配置
const NILE_TESTNET_URL = 'https://nile.trongrid.io';
// const TARGET_BLOCK_NUMBER = 63200140;
const TARGET_BLOCK_NUMBER = 63200150;
const TARGET_ADDRESS = 'TXs6uNZvgkNkLruKKV54fUDBXbcjusukUL';

interface BlockTransactionInfo {
  txID: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  contractType: string;
  contractData: any;
  isTargetTransaction: boolean;
  role: 'sender' | 'receiver' | 'none';
}

class TronNileDemo {
  private tronUtil: TronUtil;

  constructor() {
    // 初始化 TronUtil 实例，连接到 Nile 测试链
    this.tronUtil = new TronUtil(NILE_TESTNET_URL);
  }

  /**
   * 运行 demo
   */
  async run(): Promise<void> {
    try {
      console.log('🚀 Tron Nile 测试链 Demo 开始运行...\n');

      // 1. 验证目标地址格式
      await this.validateAddress();

      // 2. 获取目标区块信息
      await this.getBlockInfo();

      // 3. 分析区块中的交易
      await this.analyzeBlockTransactions();

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

    const isValid = TronUtil.validateAddress(TARGET_ADDRESS);
    if (!isValid) {
      throw new Error('无效的 TRON 地址格式');
    }

    const hexAddress = TronUtil.addressToHex(TARGET_ADDRESS);
    console.log(`地址验证: ✅ 有效`);
    console.log(`十六进制格式: ${hexAddress}`);
    console.log('');
  }

  /**
   * 获取目标区块信息
   */
  private async getBlockInfo(): Promise<any> {
    console.log('📋 步骤 2: 获取目标区块信息');
    console.log(`目标区块号: ${TARGET_BLOCK_NUMBER}`);

    try {
      const block = await this.tronUtil.getBlock(TARGET_BLOCK_NUMBER);
      
      if (!block) {
        throw new Error('区块不存在');
      }

      const blockHeader = block.block_header;
      const rawData = blockHeader?.raw_data;
      
      console.log('区块信息:');
      console.log(`  区块哈希: ${block.blockID}`);
      console.log(`  区块号: ${rawData?.number || '未知'}`);
      console.log(`  时间戳: ${rawData?.timestamp || '未知'} (${rawData?.timestamp ? new Date(rawData.timestamp).toLocaleString() : '未知'})`);
      console.log(`  父区块哈希: ${rawData?.parentHash || '未知'}`);
      console.log(`  交易数量: ${block.transactions?.length || 0}`);
      console.log('');

      return block;
    } catch (error) {
      throw new Error(`获取区块信息失败: ${error.message}`);
    }
  }

  /**
   * 分析区块中的交易
   */
  private async analyzeBlockTransactions(): Promise<void> {
    console.log('📋 步骤 3: 分析区块中的交易');

    try {
      const block = await this.tronUtil.getBlock(TARGET_BLOCK_NUMBER);
      const transactions = block.transactions || [];

      if (transactions.length === 0) {
        console.log('该区块中没有交易');
        return;
      }

      console.log(`开始分析 ${transactions.length} 笔交易...`);

      const targetTransactions: BlockTransactionInfo[] = [];
      let totalAnalyzed = 0;

      for (const tx of transactions) {
        const contract = tx.raw_data?.contract?.[0];
    const value = contract?.parameter?.value;
            console.log('\n📊 分析交易:', tx.raw_data, '-------contract--------', value);
        
        try {
          const txInfo = await this.analyzeSingleTransaction(tx);
          if (txInfo.isTargetTransaction) {
    //         const contract = tx.raw_data?.contract?.[0];
    // const value = contract?.parameter?.value;
    //         console.log('\n📊 分析交易:', tx, '---contract---', value);
            targetTransactions.push(txInfo);
          }
          totalAnalyzed++;

          // 显示进度
          if (totalAnalyzed % 10 === 0 || totalAnalyzed === transactions.length) {
            console.log(`  分析进度: ${totalAnalyzed}/${transactions.length}`);
          }
        } catch (error) {
          console.log(`  跳过交易 ${tx.txID}: ${error.message}`);
        }
      }

      console.log(`\n📊 分析结果:`);
      console.log(`  总交易数: ${transactions.length}`);
      console.log(`  成功分析: ${totalAnalyzed}`);
      console.log(`  目标地址相关交易: ${targetTransactions.length}`);

      if (targetTransactions.length > 0) {
        console.log('\n🎯 找到目标地址相关交易:');
        targetTransactions.forEach((tx, index) => {
          console.log(`\n  交易 ${index + 1}:`);
          console.log(`    交易哈希: ${tx.txID}`);
          console.log(`    发送方: ${tx.from}`);
          console.log(`    接收方: ${tx.to}`);
          console.log(`    金额: ${tx.amount} SUN (${TronUtil.fromSun(tx.amount)} TRX)`);
          console.log(`    合约类型: ${tx.contractType}`);
          console.log(`    时间戳: ${new Date(tx.timestamp).toLocaleString()}`);
          console.log(`    地址角色: ${tx.role === 'sender' ? '发送方' : '接收方'}`);
          
          if (tx.contractData) {
            console.log(`    合约数据:`, JSON.stringify(tx.contractData, null, 6));
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
   * 分析单个交易
   */
  private async analyzeSingleTransaction(tx: any): Promise<BlockTransactionInfo> {
    const contract = tx.raw_data?.contract?.[0];
    const value = contract?.parameter?.value;

    let from = '';
    let to = '';
    let amount = 0;

    if (value?.owner_address) {
      from = this.tronUtil['tronWeb'].address.fromHex(value.owner_address);
    }
    if (value?.to_address) {
      to = this.tronUtil['tronWeb'].address.fromHex(value.to_address);
    }
    if (value?.amount) {
      amount = value.amount;
    }

    const isTargetTransaction = from === TARGET_ADDRESS || to === TARGET_ADDRESS;
    let role: 'sender' | 'receiver' | 'none' = 'none';

    if (isTargetTransaction) {
      role = from === TARGET_ADDRESS ? 'sender' : 'receiver';
    }

    return {
      txID: tx.txID,
      from,
      to,
      amount,
      timestamp: tx.raw_data?.timestamp || 0,
      contractType: contract?.type || 'Unknown',
      contractData: value,
      isTargetTransaction,
      role,
    };
  }

  /**
   * 获取最新区块号（用于对比）
   */
  async getLatestBlockNumber(): Promise<void> {
    try {
      const latestBlock = await this.tronUtil.getLatestBlockNumber();
      console.log(`📊 当前最新区块号: ${latestBlock}`);
      console.log(`📊 目标区块与最新区块差距: ${latestBlock - TARGET_BLOCK_NUMBER} 个区块`);
    } catch (error) {
      console.log(`获取最新区块号失败: ${error.message}`);
    }
  }
}

/**
 * 主函数 - 运行 Demo
 */
async function main() {
  const demo = new TronNileDemo();

  try {
    await demo.run();
    await demo.getLatestBlockNumber();
  } catch (error) {
    console.error('Demo 执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行 main 函数
if (require.main === module) {
  main();
}

export { TronNileDemo };