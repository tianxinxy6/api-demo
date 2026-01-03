import { ethers } from 'ethers';
import { formatEther, parseEther } from 'ethers';

export interface EthAddressInfo {
  address: string;
  publicKey: string;
  privateKey: string;
}

export interface EthGasInfo {
  gasPrice: bigint; // Gwei 格式
  gasFee: bigint;
  gasLimit: bigint;
}

/**
 * ETH 链操作工具类
 */
export class EthUtil {
  private provider: ethers.JsonRpcProvider;
  private wallet?: ethers.Wallet;

  // ERC20 ABI
  static readonly ERC20_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
  ];

  constructor(rpcUrl: string, privateKey?: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    if (privateKey) {
      this.wallet = new ethers.Wallet(privateKey, this.provider);
    }
  }

  getWallet(privateKey?: string): ethers.Wallet {
    if (this.wallet) return this.wallet;
    return new ethers.Wallet(privateKey, this.provider);
  }

  getContract(contract: string, wallet?: ethers.Wallet | ethers.JsonRpcProvider): ethers.Contract {
    return new ethers.Contract(contract, EthUtil.ERC20_ABI, wallet || this.provider);
  }

  /**
   * 生成 ETH 地址 (静态方法，不需要网络连接)
   */
  static generate(): EthAddressInfo {
    try {
      const wallet = ethers.Wallet.createRandom();

      return {
        address: wallet.address,
        publicKey: wallet.signingKey.publicKey,
        privateKey: wallet.privateKey,
      };
    } catch (error) {
      throw new Error(`Failed to generate ETH address: ${error.message}`);
    }
  }

  /**
   * 从私钥生成地址信息 (静态方法)
   */
  static fromPrivateKey(privateKey: string): EthAddressInfo {
    try {
      const wallet = new ethers.Wallet(privateKey);

      return {
        address: wallet.address,
        publicKey: wallet.signingKey.publicKey,
        privateKey: wallet.privateKey,
      };
    } catch (error) {
      throw new Error(`Failed to generate ETH address from private key: ${error.message}`);
    }
  }

  /**
   * 验证 ETH 地址格式 (静态方法)
   */
  static validateAddress(address: string): boolean {
    try {
      return ethers.isAddress(address);
    } catch (_error) {
      return false;
    }
  }

  /**
   * 验证私钥格式 (静态方法)
   */
  static validatePrivateKey(privateKey: string): boolean {
    try {
      const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
      return /^[a-fA-F0-9]{64}$/.test(cleanKey);
    } catch (_error) {
      return false;
    }
  }

  /**
   * 规范化地址（返回校验和地址）(静态方法)
   */
  static normalizeAddress(address: string): string {
    try {
      return ethers.getAddress(address);
    } catch (error) {
      throw new Error(`Failed to normalize ETH address: ${error.message}`);
    }
  }

  /**
   * 获取地址余额
   */
  async getETHBalance(address: string): Promise<bigint> {
    return await this.provider.getBalance(address);
  }

  async getERC20Balance(address: string, contract: string): Promise<bigint> {
    const erc20 = new ethers.Contract(contract, EthUtil.ERC20_ABI, this.provider);
    return await erc20.balanceOf(address);
  }

  /**
   * 获取原始交易对象（用于区块交易分析）
   */
  async getTransaction(txHash: string): Promise<ethers.TransactionResponse | null> {
    try {
      return await this.provider.getTransaction(txHash);
    } catch (error) {
      throw new Error(`Failed to get raw transaction: ${error.message}`);
    }
  }

  /**
   * 估算gas费用
   */
  async estimateGas(
    from: string,
    to: string,
    value: bigint,
    data: string = '0x',
  ): Promise<EthGasInfo> {
    const [gasLimit, feeData] = await Promise.all([
      this.provider.estimateGas({
        from,
        to,
        value,
        data,
      }),
      this.provider.getFeeData(),
    ]);

    return {
      gasPrice: feeData.gasPrice,
      gasFee: gasLimit * feeData.gasPrice,
      gasLimit,
    };
  }

  async estimateERC20Gas(
    from: string,
    contract: string,
    to: string,
    amount: bigint,
  ): Promise<EthGasInfo> {
    const erc20 = new ethers.Contract(contract, EthUtil.ERC20_ABI, this.provider);
    const data = erc20.interface.encodeFunctionData('transfer', [to, amount]);

    return await this.estimateGas(from, contract, 0n, data);
  }

  /**
   * 获取最新区块号
   */
  async getLatestBlockNumber(): Promise<number> {
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      throw new Error(`Failed to get latest block number: ${error.message}`);
    }
  }

  /**
   * 获取区块信息（仅包含交易哈希）
   * 注意：ethers v6 中 getBlock 的第二个参数已失效，只能获取交易哈希
   * 如需完整交易详情，请使用 getBlockWithFullTransactions 方法
   */
  async getBlock(blockNumber: number | string) {
    try {
      return await this.provider.getBlock(blockNumber);
    } catch (error) {
      throw new Error(`Failed to get block: ${error.message}`);
    }
  }

  /**
   * 获取区块信息（包含完整交易详情）
   * 修复 ethers v6 getBlock() 无法获取完整交易详情的问题
   */
  async getBlockWithFullTransactions(blockNumber: number | string): Promise<any> {
    try {
      // 转换为十六进制格式
      const blockHex =
        typeof blockNumber === 'string' ? blockNumber : `0x${blockNumber.toString(16)}`;

      // 直接使用 JSON-RPC 调用，确保获取完整交易详情
      return await this.provider.send('eth_getBlockByNumber', [blockHex, true]);
    } catch (error) {
      throw new Error(`Failed to get block with full transactions: ${error.message}`);
    }
  }

  /**
   * 转换单位：ETH 到 Wei
   */
  static toWei(ether: string): string {
    try {
      return parseEther(ether).toString();
    } catch (error) {
      throw new Error(`Failed to convert ETH to Wei: ${error.message}`);
    }
  }

  /**
   * 转换单位：Wei 到 ETH
   */
  static fromWei(wei: string | number | bigint): string {
    try {
      if (wei === null || wei === undefined || wei === '') return '0';

      // 统一转换为字符串
      let weiString = wei.toString();

      // 处理无效值
      if (weiString === 'NaN' || weiString === 'undefined') {
        return '0';
      }

      // 如果是小数，只取整数部分
      if (weiString.includes('.')) {
        weiString = weiString.split('.')[0];
      }

      return formatEther(weiString);
    } catch (error) {
      console.warn(`fromWei conversion warning for value: ${wei}`, error.message);
      return '0';
    }
  }

  /**
   * 检查交易是否成功
   */
  async isTransactionSuccess(txHash: string): Promise<boolean> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      return receipt?.status === 1;
    } catch (error) {
      throw new Error(`Failed to check transaction status: ${error.message}`);
    }
  }

  /**
   * 获取交易数量 (nonce)
   * @param blockTag 'latest' | 'pending' | 'earliest' 等
   */
  async getTransactionCount(address: string, blockTag: string = 'latest'): Promise<number> {
    try {
      return await this.provider.getTransactionCount(address, blockTag);
    } catch (error) {
      throw new Error(`Failed to get transaction count: ${error.message}`);
    }
  }
}
