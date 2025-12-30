import { TronUtil } from '../src/utils/tron.util';
import { TronWeb } from 'tronweb';

/**
 * TRON 转账 Demo
 * 
 * 功能：
 * 1. TRX 原生代币转账
 * 2. TRC20 代币转账（以 USDT 为例）
 * 3. 查询余额
 * 4. 查询交易状态
 * 
 * 使用回调函数方式
 */

// TRON Nile 测试网配置
const TRON_TESTNET_URL = 'https://nile.trongrid.io';

// 示例私钥（请替换为你的测试网私钥）
const SENDER_PRIVATE_KEY = '91acc3b13609d1b6dffe32272bcd0d699107aebdf3812d0e0b66de1c21ff02bb';

// 接收地址
const RECIPIENT_ADDRESS = 'TNvg3wwr64mPDLwV7TxSJPK5fB2GTjZVYm';

// TRC20 代币合约地址（Nile USDT 示例）
const USDT_CONTRACT_ADDRESS = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf'; // Nile USDT

/**
 * TRON 转账 Demo 类
 */
class TronTransferDemo {
    private tronUtil: TronUtil;
    private tronWeb: TronWeb;
    private walletAddress?: string;

    constructor(rpcUrl: string, privateKey?: string) {
        this.tronUtil = new TronUtil(rpcUrl, privateKey);
        this.tronWeb = new TronWeb({
            fullHost: rpcUrl,
            privateKey: privateKey,
        });

        if (privateKey && privateKey !== 'YOUR_PRIVATE_KEY_HERE') {
            const address = this.tronWeb.address.fromPrivateKey(privateKey);
            if (address) {
                this.walletAddress = address;
            }
        }
    }

    /**
     * 运行完整 demo
     */
    run(callback: (error?: Error) => void): void {
        console.log('🚀 TRON 转账 Demo 开始运行...\n');

        // 1. 查询 TRX 余额
        this.checkTrxBalance((err) => {
            if (err) return callback(err);

            // 2. 查询 TRC20 代币余额
            this.checkTrc20Balance((err) => {
                if (err) {
                    console.log('   提示：查询 TRC20 余额失败，继续执行...\n');
                }

                console.log('\n✅ Demo 运行完成！');
                console.log('\n💡 提示：要实际执行转账，请调用相应的方法：');
                console.log('   - transferTrx(): TRX 转账');
                console.log('   - transferTrc20(): TRC20 代币转账');
                console.log('\n   并确保：');
                console.log('   1. 已设置正确的私钥');
                console.log('   2. 账户有足够的余额和资源（带宽/能量）');
                console.log('   3. 已设置正确的接收地址');

                callback();
            });
        });
    }

    /**
     * 1. 生成新的 TRON 地址
     */
    async generateNewAddress(callback: (error?: Error) => void): Promise<void> {
        console.log('📋 生成新的 TRON 地址');

        try {
            const addressInfo = await TronUtil.generate();

            console.log('✅ 新地址已生成：');
            console.log(`   地址: ${addressInfo.address}`);
            console.log(`   Hex 地址: ${addressInfo.hexAddress}`);
            console.log(`   公钥: ${addressInfo.publicKey}`);
            console.log(`   私钥: ${addressInfo.privateKey}`);
            console.log('   ⚠️  请妥善保管私钥！\n');

            callback();
        } catch (error) {
            callback(error);
        }
    }

    /**
     * 2. 查询 TRX 余额
     */
    private checkTrxBalance(callback: (error?: Error) => void): void {
        console.log('📋 步骤 1: 查询 TRX 余额');

        const checkAddress = this.walletAddress || 'TYsbWxNnyTgsZaTFaue9hqpxkU3Fkco94a';

        console.log(`   查询地址: ${checkAddress}`);

        this.tronUtil.getTRXBalance(checkAddress)
            .then((balance) => {
                console.log(`   余额 (TRX): ${balance} TRX\n`);
                callback();
            })
            .catch((error) => {
                callback(error);
            });
    }

    /**
     * 3. 查询 TRC20 代币余额
     */
    private checkTrc20Balance(callback: (error?: Error) => void): void {
        console.log('📋 步骤 2: 查询 TRC20 代币余额');

        const checkAddress = this.walletAddress || 'TYsbWxNnyTgsZaTFaue9hqpxkU3Fkco94a';

        console.log(`   查询地址: ${checkAddress}`);
        console.log(`   代币合约: ${USDT_CONTRACT_ADDRESS}`);

        this.tronWeb.contract().at(USDT_CONTRACT_ADDRESS)
            .then((contract: any) => {
                return Promise.all([
                    contract.decimals().call(),
                    contract.symbol().call(),
                    contract.balanceOf(checkAddress).call()
                ]);
            })
            .then(([decimals, symbol, balance]) => {
                const balanceBigInt = BigInt(balance.toString());
                const divisor = BigInt(10 ** Number(decimals));
                const balanceFormatted = (Number(balanceBigInt) / Number(divisor)).toFixed(Number(decimals));

                console.log('✅ TRC20 代币余额：');
                console.log(`   代币符号: ${symbol}`);
                console.log(`   余额 (最小单位): ${balanceBigInt.toString()}`);
                console.log(`   余额 (格式化): ${balanceFormatted} ${symbol}\n`);
                callback();
            })
            .catch((error) => {
                console.error('❌ 查询 TRC20 余额失败:', error.message);
                callback(error);
            });
    }

    /**
     * 4. TRX 转账
     */
    transferTrx(
        recipientAddress: string,
        amountInTrx: number,
        callback: (error?: Error, txHash?: string) => void
    ): void {
        console.log('📋 TRX 转账');

        if (!this.walletAddress) {
            return callback(new Error('请先设置 SENDER_PRIVATE_KEY'));
        }

        if (!TronUtil.validateAddress(recipientAddress)) {
            return callback(new Error('接收地址格式不正确'));
        }

        console.log(`   发送方: ${this.walletAddress}`);
        console.log(`   接收方: ${recipientAddress}`);
        console.log(`   金额: ${amountInTrx} TRX`);

        // 1. 查询当前余额
        this.tronUtil.getTRXBalance(this.walletAddress)
            .then((balance) => {
                console.log(`   当前余额: ${balance} TRX`);

                const amountInSun = Number(TronUtil.toSun(amountInTrx));
                if (balance < BigInt(amountInSun)) {
                    throw new Error('余额不足');
                }

                // 2. 查询账户资源
                return this.tronWeb.trx.getAccountResources(this.walletAddress);
            })
            .then((resources) => {
                const freeBandwidth = resources.freeNetLimit || 0;
                console.log(`   可用带宽: ${freeBandwidth}`);

                // 3. 发送交易
                console.log('\n   正在发送交易...');
                return this.tronUtil.sendTrx(recipientAddress, amountInTrx);
            })
            .then((txHash) => {
                console.log('✅ 交易已发送！');
                console.log(`   交易哈希: ${txHash}`);
                console.log(`   区块浏览器: https://nile.tronscan.org/#/transaction/${txHash}`);

                // 4. 监听交易确认（不等待）
                console.log('\n   交易已提交到网络，等待确认...');
                this.waitForConfirmation(txHash);

                callback(undefined, txHash);
            })
            .catch((error) => {
                console.error('❌ TRX 转账失败:', error.message, '\n');
                callback(error);
            });
    }

    /**
     * 5. TRC20 代币转账
     */
    transferTrc20(
        tokenAddress: string,
        recipientAddress: string,
        amount: string,
        callback: (error?: Error, txHash?: string) => void
    ): void {
        console.log('📋 TRC20 代币转账');

        if (!this.walletAddress) {
            return callback(new Error('请先设置 SENDER_PRIVATE_KEY'));
        }

        if (!TronUtil.validateAddress(recipientAddress)) {
            return callback(new Error('接收地址格式不正确'));
        }

        if (!TronUtil.validateAddress(tokenAddress)) {
            return callback(new Error('代币合约地址格式不正确'));
        }

        console.log(`   发送方: ${this.walletAddress}`);
        console.log(`   接收方: ${recipientAddress}`);
        console.log(`   代币合约: ${tokenAddress}`);

        let contract: any;
        let decimals: number;
        let symbol: string;

        // 1. 获取代币信息
        this.tronWeb.contract().at(tokenAddress)
            .then((contractInstance: any) => {
                contract = contractInstance;
                return Promise.all([
                    contract.decimals().call(),
                    contract.symbol().call(),
                    contract.balanceOf(this.walletAddress).call()
                ]);
            })
            .then(([dec, sym, balance]) => {
                decimals = Number(dec);
                symbol = sym;

                const amountBigInt = BigInt(amount) * BigInt(10 ** decimals);
                const balanceBigInt = BigInt(balance.toString());
                const amountFormatted = (Number(amountBigInt) / Number(10 ** decimals)).toFixed(decimals);

                console.log(`   金额: ${amountFormatted} ${symbol}`);
                console.log(`   当前余额: ${(Number(balanceBigInt) / Number(10 ** decimals)).toFixed(decimals)} ${symbol}`);

                // 2. 检查余额是否足够
                if (balanceBigInt < amountBigInt) {
                    throw new Error('余额不足');
                }

                // 3. 查询账户资源
                return this.tronWeb.trx.getAccountResources(this.walletAddress);
            })
            .then((resources) => {
                const energy = resources.EnergyLimit || 0;
                const bandwidth = resources.freeNetLimit || 0;
                console.log(`   可用能量: ${energy}, 可用带宽: ${bandwidth}`);

                // 4. 发送 TRC20 转账交易
                console.log('\n   正在发送交易...');
                const amountBigInt = BigInt(amount) * BigInt(10 ** decimals);

                return contract.transfer(recipientAddress, amountBigInt.toString()).send({
                    feeLimit: 100_000_000, // 100 TRX fee limit
                    callValue: 0,
                    from: this.walletAddress
                });
            })
            .then((txHash) => {
                console.log('✅ 交易已发送！');
                console.log(`   交易哈希: ${txHash}`);
                console.log(`   区块浏览器: https://nile.tronscan.org/#/transaction/${txHash}`);

                // 5. 监听交易确认（不等待）
                console.log('\n   交易已提交到网络，等待确认...');
                this.waitForConfirmation(txHash);

                callback(undefined, txHash);
            })
            .catch((error) => {
                console.error('❌ TRC20 转账失败:', error.message, '\n');
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
        this.tronUtil.getTransaction(txHash)
            .then((tx) => {
                if (!tx) {
                    throw new Error('交易不存在');
                }

                console.log('\n✅ 交易详情：');
                console.log(`   交易 ID: ${tx.txID}`);
                console.log(`   状态: ${tx.ret?.[0]?.contractRet || 'PENDING'}`);

                // 获取交易费用信息
                return this.tronUtil.getTransactionInfo(txHash);
            })
            .then((info) => {
                if (info && info.blockNumber) {
                    console.log('\n   交易费用信息：');
                    console.log(`   区块号: ${info.blockNumber}`);
                    console.log(`   能量消耗: ${info.receipt?.energy_usage || 0}`);
                    console.log(`   带宽消耗: ${info.receipt?.net_usage || 0}`);
                    console.log(`   费用 (SUN): ${info.fee || 0}`);
                }
                callback();
            })
            .catch((error) => {
                console.error('❌ 查询交易详情失败:', error.message);
                callback(error);
            });
    }

    /**
     * 等待交易确认
     * 
     * 核心问题：TronWeb.trx.getTransactionInfo() 的行为特点
     * 1. 交易刚提交后，返回空对象 {} （不是 null）
     * 2. 只有被打包到区块后，才会返回包含 blockNumber 的对象
     * 3. 因此需要检查返回对象是否有实际内容（Object.keys().length > 0）
     */
    private waitForConfirmation(
        txHash: string,
        timeoutMs: number = 90_000, // 90 秒超时
        intervalMs: number = 3_000
    ): void {
        const start = Date.now();
        let isChecking = false;
        let checkCount = 0;


        const checkStatus = async () => {
            checkCount++;
            
            // 超时检查
            const elapsed = Date.now() - start;
            if (elapsed > timeoutMs) {
                console.log(`⏱️  交易确认超时 (${Math.round(elapsed / 1000)}秒)`);
                console.log(`   建议：请手动查看区块浏览器确认交易状态\n`);
                return;
            }

            // 防止并发
            if (isChecking) {
                return;
            }

            isChecking = true;

            try {
                console.log(`   [${checkCount}] 检查交易状态... (已等待 ${Math.round(elapsed / 1000)}秒)`);
                
                // 方法1：通过 getTransaction 检查交易状态（更可靠）
                const tx = await this.tronUtil.getTransaction(txHash);
                
                if (!tx || !tx.txID) {
                    console.log(`   ⚠️  交易不存在，继续等待...`);
                    isChecking = false;
                    setTimeout(checkStatus, intervalMs);
                    return;
                }

                // 检查交易状态
                const status = tx.ret?.[0]?.contractRet;
                
                if (status === 'SUCCESS') {
                    // 交易成功，尝试获取详细信息
                    console.log('✅ 交易已确认成功！');
                    
                    // 获取交易信息（可能仍为空对象，因为链上数据同步有延迟）
                    const info = await this.tronUtil.getTransactionInfo(txHash);
                    
                    // 检查 info 是否为空对象
                    const hasInfo = info && Object.keys(info).length > 0;
                    
                    if (hasInfo && typeof info.blockNumber === 'number') {
                        console.log(`   区块号: ${info.blockNumber}`);
                        console.log(`   能量消耗: ${info.receipt?.energy_usage || 0}`);
                        console.log(`   带宽消耗: ${info.receipt?.net_usage || 0}`);
                        console.log(`   费用 (SUN): ${info.fee || 0}`);
                    } else {
                        console.log(`   提示: 交易已成功，但详细信息暂未同步（这是正常的）`);
                    }
                    console.log(`   区块浏览器: https://nile.tronscan.org/#/transaction/${txHash}\n`);
                    return;
                    
                } else if (status === 'REVERT') {
                    console.log(`❌ 交易失败: ${status}\n`);
                    return;
                    
                } else if (!status) {
                    // 交易存在但还未被打包（pending 状态）
                    console.log(`   ⏳ 交易处理中，等待区块确认...`);
                    isChecking = false;
                    setTimeout(checkStatus, intervalMs);
                    
                } else {
                    console.log(`   ⚠️  未知状态: ${status}，继续等待...`);
                    isChecking = false;
                    setTimeout(checkStatus, intervalMs);
                }
                
            } catch (error) {
                // 出错后继续重试
                console.log(`   ⚠️  查询出错 (将重试): ${error.message}`);
                isChecking = false;
                setTimeout(checkStatus, intervalMs);
            }
        };

        console.log(`\n🔍 开始监听交易确认 (超时: ${timeoutMs / 1000}秒)...`);
        checkStatus();
    }
}

/**
 * 主函数
 */
function main() {
    // 创建 demo 实例
    const demo = new TronTransferDemo(TRON_TESTNET_URL, SENDER_PRIVATE_KEY);

    // 运行 demo（查询余额等）
    demo.run((err) => {
        if (err) {
            console.error('程序执行失败:', err.message);
            process.exit(1);
        }

        

        // TRX 转账示例
        demo.transferTrx(RECIPIENT_ADDRESS, 10, (err, txHash) => {
          if (err) {
            console.error('TRX 转账失败:', err.message);
            return;
          }
          console.log('TRX 转账成功，交易哈希:', txHash);
        });

        // TRC20 转账示例
        // demo.transferTrc20(USDT_CONTRACT_ADDRESS, RECIPIENT_ADDRESS, "1", (err, txHash) => {
        //   if (err) {
        //     console.error('TRC20 转账失败:', err.message);
        //     return;
        //   }
        //   console.log('TRC20 转账成功，交易哈希:', txHash);
        // });

        // 查询交易详情示例
        // demo.getTransactionDetails('YourTransactionHashHere', (err) => {
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

export { TronTransferDemo };
