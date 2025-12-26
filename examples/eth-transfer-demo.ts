import { EthUtil } from '../src/utils/eth.util';
import { ethers } from 'ethers';

/**
 * ETH 转账和 ERC20 代币转账 Demo
 * 
 * 功能：
 * 1. ETH 原生代币转账
 * 2. ERC20 代币转账（以 USDT 为例）
 * 3. 查询余额
 * 4. 查询交易状态
 * 
 * 使用回调函数方式，不使用 async/await
 */

// ETH Sepolia 测试网配置
const SEPOLIA_TESTNET_URL = 'https://sepolia.infura.io/v3/b88dc0d822ba4d06b2e0d2b0fae8f816';

// 示例私钥（请替换为你的测试网私钥）
const SENDER_PRIVATE_KEY = 'b94f617150a31e48695f6afa759943a18516b62e5be63e262e7dc0d8d931e9c2';

// 接收地址
const RECIPIENT_ADDRESS = '0xB07d3DD505404F7d1A8B5016a2CFF7E185Cb77Ec';

// ERC20 代币合约地址（Sepolia USDT 示例）
const USDT_CONTRACT_ADDRESS = '0x779877a7b0d9e8603169ddbd7836e478b4624789'; // Sepolia USDT

// ERC20 ABI (只需要 transfer, balanceOf, decimals 方法)
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

/**
 * ERC20 代币转账 Demo 类
 */
class EthTransferDemo {
  private ethUtil: EthUtil;
  private provider: ethers.JsonRpcProvider;
  private wallet?: ethers.Wallet;

  constructor(rpcUrl: string, privateKey?: string) {
    this.ethUtil = new EthUtil(rpcUrl, privateKey);
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    if (privateKey && privateKey !== '0xYOUR_PRIVATE_KEY_HERE') {
      this.wallet = new ethers.Wallet(privateKey, this.provider);
    }
  }

  /**
   * 运行完整 demo
   */
  run(callback: (error?: Error) => void): void {
    console.log('🚀 ETH 转账 Demo 开始运行...\n');
    
    // 1. 生成新地址（可选）
    // this.generateNewAddress((err) => {
    //   if (err) return callback(err);

      // 2. 查询 ETH 余额
      this.checkEthBalance((err) => {
        if (err) return callback(err);

        // 3. 查询 ERC20 代币余额
        this.checkErc20Balance((err) => {
          if (err) {
            console.log('   提示：查询 ERC20 余额失败，继续执行...\n');
          }

          console.log('\n✅ Demo 运行完成！');
          console.log('\n💡 提示：要实际执行转账，请调用相应的方法：');
          console.log('   - transferEth(): ETH 转账');
          console.log('   - transferErc20(): ERC20 代币转账');
          console.log('\n   并确保：');
          console.log('   1. 已设置正确的私钥');
          console.log('   2. 账户有足够的余额');
          console.log('   3. 已设置正确的接收地址');

          callback();
        });
      });
    // });
  }

  /**
   * 2. 查询 ETH 余额
   */
  private checkEthBalance(callback: (error?: Error) => void): void {
    console.log('📋 步骤 2: 查询 ETH 余额');
    
    const checkAddress = EthUtil.fromPrivateKey(SENDER_PRIVATE_KEY).address 

    this.ethUtil.getBalance(checkAddress)
      .then((balanceInfo) => {
        console.log('✅ 余额查询结果：');
        console.log(`   余额 (Wei): ${balanceInfo.balance}`);
        console.log(`   余额 (ETH): ${balanceInfo.balanceEth} ETH\n`);
        callback();
      })
      .catch((error) => {
        callback(error);
      });
  }

  /**
   * 3. 查询 ERC20 代币余额
   */
  private checkErc20Balance(callback: (error?: Error) => void): void {
    console.log('📋 步骤 3: 查询 ERC20 代币余额');
    
    // 如果没有提供私钥，使用示例地址
    const checkAddress = EthUtil.fromPrivateKey(SENDER_PRIVATE_KEY).address 
    
    console.log(`   查询地址: ${checkAddress}`);
    console.log(`   代币合约: ${USDT_CONTRACT_ADDRESS}`);
    
    const contract = new ethers.Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, this.provider);
    
    // 先获取代币的 decimals
    contract.decimals()
      .then((decimals: number) => {
        // 然后获取余额
        return contract.balanceOf(checkAddress)
          .then((balance: bigint) => {
            const balanceFormatted = ethers.formatUnits(balance, decimals);
            
            console.log('✅ ERC20 代币余额：');
            console.log(`   余额 (最小单位): ${balance.toString()}`);
            console.log(`   余额 (格式化): ${balanceFormatted}\n`);
            callback();
          });
      })
      .catch((error) => {
        console.error('❌ 查询 ERC20 余额失败:', error.message);
        callback(error);
      });
  }

  /**
   * 4. ETH 转账 (使用原始 ethers 直接操作)
   */
  transferEth(recipientAddress: string, amountInEth: string, callback: (error?: Error, txHash?: string) => void): void {
    console.log('📋 ETH 转账');
    
    if (!this.wallet) {
      return callback(new Error('请先设置 SENDER_PRIVATE_KEY'));
    }

    if (!ethers.isAddress(recipientAddress)) {
      return callback(new Error('接收地址格式不正确'));
    }

    const senderAddress = this.wallet.address;
    
    console.log(`   发送方: ${senderAddress}`);
    console.log(`   接收方: ${recipientAddress}`);
    console.log(`   金额: ${amountInEth} ETH`);
    
    // 1. 查询当前余额
    this.provider.getBalance(senderAddress)
      .then((balance) => {
        const balanceEth = ethers.formatEther(balance);
        console.log(`   当前余额: ${balanceEth} ETH`);
        
        // 检查余额是否足够
        const amountWei = ethers.parseEther(amountInEth);
        if (balance < amountWei) {
          throw new Error('余额不足');
        }
        
        // 2. 估算 Gas
        const tx = {
          to: recipientAddress,
          value: amountWei,
        };
        
        return Promise.all([
          this.provider.estimateGas(tx),
          this.provider.getFeeData(),
        ]);
      })
      .then(([estimatedGas, feeData]) => {
        console.log(`   预估 Gas: ${estimatedGas.toString()}`);
        console.log(`   Gas Price: ${feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') : 'N/A'} Gwei`);
        
        // 3. 发送交易
        console.log('\n   正在发送交易...');
        return this.wallet!.sendTransaction({
          to: recipientAddress,
          value: ethers.parseEther(amountInEth),
        });
      })
      .then((tx) => {
        console.log('✅ 交易已发送！');
        console.log(`   交易哈希: ${tx.hash}`, tx);
        
        // 4. 监听交易确认（不等待）
        console.log('\n   交易已提交到网络，等待确认...');
        tx.wait()
          .then((receipt) => {
            if (receipt && receipt.status === 1) {
              console.log('✅ 交易已确认！');
              console.log(`   区块号: ${receipt.blockNumber}`);
              console.log(`   Gas 使用: ${receipt.gasUsed.toString()}\n`);
            } else {
              console.log('❌ 交易失败\n');
            }
          })
          .catch((err) => {
            console.error('等待交易确认时出错:', err.message);
          });
        
        callback(undefined, tx.hash);
      })
      .catch((error) => {
        console.error('❌ ETH 转账失败:', error.message, '\n');
        callback(error);
      });
  }

  /**
   * 5. ERC20 代币转账
   */
  transferErc20(
    tokenAddress: string,
    recipientAddress: string,
    amount: string,
    callback: (error?: Error, txHash?: string) => void
  ): void {
    console.log('📋 ERC20 代币转账');
    
    if (!this.wallet) {
      return callback(new Error('请先设置 SENDER_PRIVATE_KEY'));
    }

    if (!EthUtil.validateAddress(recipientAddress)) {
      return callback(new Error('接收地址格式不正确'));
    }

    if (!EthUtil.validateAddress(tokenAddress)) {
      return callback(new Error('代币合约地址格式不正确'));
    }

    const senderAddress = this.wallet.address;
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.wallet);
    
    console.log(`   发送方: ${senderAddress}`);
    console.log(`   接收方: ${recipientAddress}`);
    console.log(`   代币合约: ${tokenAddress}`);
    
    // 1. 获取代币信息
    Promise.all([
      contract.decimals(),
      contract.symbol(),
      contract.balanceOf(senderAddress)
    ])
      .then(([decimals, symbol, balance]: [number, string, bigint]) => {
        const amountBigInt = ethers.parseUnits(amount, decimals);
        const amountFormatted = ethers.formatUnits(amountBigInt, decimals);
        
        console.log(`   金额: ${amountFormatted} ${symbol}`);
        console.log(`   当前余额: ${ethers.formatUnits(balance, decimals)} ${symbol}`);
        
        // 2. 检查余额是否足够
        if (balance < amountBigInt) {
          throw new Error('余额不足');
        }
        
        // 3. 发送 ERC20 转账交易
        console.log('\n   正在发送交易...');
        return contract.transfer(recipientAddress, amountBigInt);
      })
      .then((tx: ethers.ContractTransactionResponse) => {
        console.log('✅ 交易已发送！');
        console.log(`   交易哈希: ${tx.hash}`);
        console.log(`   区块浏览器: https://sepolia.etherscan.io/tx/${tx.hash}`);
        
        // 4. 监听交易确认（不等待）
        console.log('\n   交易已提交到网络，等待确认...');
        tx.wait()
          .then((receipt) => {
            if (receipt && receipt.status === 1) {
              console.log('✅ 交易已确认！');
              console.log(`   区块号: ${receipt.blockNumber}`);
              console.log(`   Gas 使用: ${receipt.gasUsed.toString()}\n`);
            } else {
              console.log('❌ 交易失败\n');
            }
          })
          .catch((err) => {
            console.error('等待交易确认时出错:', err.message);
          });
        
        callback(undefined, tx.hash);
      })
      .catch((error) => {
        console.error('❌ ERC20 转账失败:', error.message, '\n');
        callback(error);
      });
  }

  /**
   * 6. 查询交易详情
   */
  getTransactionDetails(txHash: string, callback: (error?: Error) => void): void {
    console.log('📋 查询交易详情');
    console.log(`   交易哈希: ${txHash}`);
    
    // 获取交易详情
    this.ethUtil.getTransaction(txHash)
      .then((tx) => {
        if (!tx) {
          throw new Error('交易不存在');
        }
        
        console.log('\n✅ 交易详情：');
        console.log(`   发送方: ${tx.from}`);
        console.log(`   接收方: ${tx.to}`);
        console.log(`   金额 (Wei): ${tx.value.toString()}`);
        console.log(`   金额 (ETH): ${EthUtil.fromWei(tx.value.toString())}`);
        console.log(`   Nonce: ${tx.nonce}`);
        console.log(`   Gas Limit: ${tx.gasLimit.toString()}`);
        console.log(`   Gas Price: ${tx.gasPrice ? tx.gasPrice.toString() : 'N/A'}`);
        
        // 获取交易收据
        return this.provider.getTransactionReceipt(txHash);
      })
      .then((receipt) => {
        if (receipt) {
          console.log('\n   交易收据：');
          console.log(`   状态: ${receipt.status === 1 ? '成功' : '失败'}`);
          console.log(`   区块号: ${receipt.blockNumber}`);
          console.log(`   Gas 使用: ${receipt.gasUsed.toString()}`);
        }
        callback();
      })
      .catch((error) => {
        console.error('❌ 查询交易详情失败:', error.message);
        callback(error);
      });
  }
}

/**
 * 主函数
 */
function main() {
  // 创建 demo 实例
  const demo = new EthTransferDemo(SEPOLIA_TESTNET_URL, SENDER_PRIVATE_KEY);
  
  // 运行 demo（查询余额等）
  demo.run((err) => {
    if (err) {
      console.error('程序执行失败:', err.message);
      process.exit(1);
    }
    
    console.log('\n💡 使用示例：');
    console.log('\n// ETH 转账示例：');
    console.log('demo.transferEth("0xRecipientAddress", "0.001", (err, txHash) => {');
    console.log('  if (err) return console.error("转账失败:", err.message);');
    console.log('  console.log("交易哈希:", txHash);');
    console.log('});\n');
    
    console.log('// ERC20 转账示例：');
    console.log('demo.transferErc20(');
    console.log('  "0xTokenAddress",');
    console.log('  "0xRecipientAddress",');
    console.log('  "1.0", // 金额（会根据代币 decimals 自动转换）');
    console.log('  (err, txHash) => {');
    console.log('    if (err) return console.error("转账失败:", err.message);');
    console.log('    console.log("交易哈希:", txHash);');
    console.log('  }');
    console.log(');\n');
    
    console.log('// 查询交易详情示例：');
    console.log('demo.getTransactionDetails("0xTransactionHash", (err) => {');
    console.log('  if (err) return console.error("查询失败:", err.message);');
    console.log('});\n');
    
    // 取消下面的注释来执行实际转账（请谨慎操作！）
    
    // ETH 转账示例
    // demo.transferEth(RECIPIENT_ADDRESS, "0.001", (err, txHash) => {
    //   if (err) {
    //     console.error('ETH 转账失败:', err.message);
    //     return;
    //   }
    //   console.log('ETH 转账成功，交易哈希:', txHash);
    // });
    
    // ERC20 转账示例
    demo.transferErc20(USDT_CONTRACT_ADDRESS, RECIPIENT_ADDRESS, "1.0", (err, txHash) => {
      if (err) {
        console.error('ERC20 转账失败:', err.message);
        return;
      }
      console.log('ERC20 转账成功，交易哈希:', txHash);
    });
    
    // 查询交易详情示例
    // demo.getTransactionDetails('0xYourTransactionHashHere', (err) => {
    //   if (err) {
    //     console.error('查询失败:', err.message);
    //   }
    // });
  });
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

export { EthTransferDemo };
