import { Contract } from 'ethers';
import { TronWeb, Types } from 'tronweb';

export interface TronAddressInfo {
  address: string;
  publicKey: string;
  privateKey: string;
  hexAddress: string;
}

export interface TronBalanceInfo {
  address: string;
  balance: bigint; // TRX balance in SUN
  balanceTrx: string; // TRX balance in TRX
}

/**
 * TRON 链操作工具类 - 基于 TronWeb 6.x
 */
export class TronUtil {
  private tronWeb: TronWeb;

  // TRON 资源消耗常量（固定值）
  private readonly TRX_BANDWIDTH = 270; // TRX 转账固定消耗
  private readonly TRC20_BANDWIDTH = 350; // TRC20 转账固定消耗

  constructor(nodeUrl: string, privateKey?: string) {
    this.tronWeb = new TronWeb({
      fullHost: nodeUrl,
      privateKey: privateKey,
    });
  }

  /**
   * 生成 TRON 地址 (静态方法)
   */
  static async generate(): Promise<TronAddressInfo> {
    try {
      const account = await TronWeb.createAccount();

      return {
        address: account.address.base58,
        publicKey: account.publicKey,
        privateKey: account.privateKey,
        hexAddress: account.address.hex,
      };
    } catch (error) {
      throw new Error(`Failed to generate TRON address: ${error.message}`);
    }
  }

  /**
   * 验证 TRON 地址格式
   */
  static validateAddress(address: string): boolean {
    try {
      return TronWeb.isAddress(address);
    } catch (error) {
      return false;
    }
  }

  /**
   * 验证私钥格式
   */
  static validatePrivateKey(privateKey: string): boolean {
    try {
      const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
      return /^[a-fA-F0-9]{64}$/.test(cleanKey);
    } catch (error) {
      return false;
    }
  }

  /**
   * 规范化 TRON 地址
   */
  static normalize(address: string): string {
    try {
      return address.toUpperCase();
    } catch (error) {
      throw new Error(`Failed to normalize TRON address: ${error.message}`);
    }
  }

  /**
   * 将 TRON 地址转换为十六进制格式
   */
  static addressToHex(address: string): string {
    try {
      return TronWeb.address.toHex(address);
    } catch (error) {
      throw new Error(`Failed to convert TRON address to hex: ${error.message}`);
    }
  }

  /**
   * 将十六进制地址转换为 TRON 地址格式
   */
  static hexToAddress(hexAddress: string): string {
    try {
      return TronWeb.address.fromHex(hexAddress);
    } catch (error) {
      throw new Error(`Failed to convert hex to TRON address: ${error.message}`);
    }
  }

  /**
   * 地址校验和 - TronWeb 6.x 新功能
   */
  static toChecksumAddress(address: string): string {
    try {
      return TronWeb.address.toChecksumAddress(address);
    } catch (error) {
      throw new Error(`Failed to convert to checksum address: ${error.message}`);
    }
  }

  /**
   * 验证地址校验和 - TronWeb 6.x 新功能
   */
  static isChecksumAddress(address: string): boolean {
    try {
      return TronWeb.address.isChecksumAddress(address);
    } catch (error) {
      return false;
    }
  }

  async getContract(contract: string): Promise<Types.ContractInstance<Types.ContractAbiInterface>> {
    return await this.tronWeb.contract().at(contract);
  }

  /**
   * 获取地址余额
   */
  async getTRXBalance(address: string): Promise<number> {
    return await this.tronWeb.trx.getBalance(address);
  }

  async getTRC20Balance(address: string, contract: string): Promise<number> {
    const contractInstance = await this.getContract(contract);
    return await contractInstance.balanceOf(address).call({ from: address });
  }

  /**
   * 获取交易信息
   */
  async getTransaction(txHash: string): Promise<Types.GetTransactionResponse | null> {
    try {
      return await this.tronWeb.trx.getTransaction(txHash);
    } catch (error) {
      throw new Error(`Failed to get TRON transaction: ${error.message}`);
    }
  }

  /**
   * 获取交易详细信息（包含费用等信息）
   */
  async getTransactionInfo(txHash: string): Promise<Types.TransactionInfo> {
    try {
      return await this.tronWeb.trx.getTransactionInfo(txHash);
    } catch (error) {
      throw new Error(`Failed to get TRON transaction info: ${error.message}`);
    }
  }

  /**
   * 检查交易是否成功
   * @param txHash 交易哈希
   * @returns 返回交易状态信息
   */
  async isTransactionSuccess(txHash: string): Promise<boolean> {
    try {
      // 获取交易信息
      const transaction = await this.getTransaction(txHash);
      if (!transaction || !transaction.txID) {
        return false;
      }

      // 检查 ret 数组中的 contractRet 状态
      const contractRet = transaction.ret?.[0]?.contractRet;
      return contractRet === 'SUCCESS';
    } catch (error) {
      return false;
    }
  }

  /**
   * 发送 TRX 交易
   */
  async sendTrx(to: string, amount: number): Promise<string> {
    try {
      if (!this.tronWeb.defaultPrivateKey) {
        throw new Error('Private key not provided in constructor');
      }

      const fromAddress = this.getFromAddress();
      if (!fromAddress) {
        throw new Error('Failed to derive address from private key');
      }

      // 构建交易
      const transaction = await this.tronWeb.transactionBuilder.sendTrx(to, amount, fromAddress);

      // 签名交易
      const signedTx = await this.tronWeb.trx.sign(transaction);

      // 广播交易
      const broadcast = await this.tronWeb.trx.sendRawTransaction(signedTx);
      if (!broadcast.result) {
        throw new Error(`Transaction failed: ${broadcast.code || 'Unknown error'}`);
      }

      return broadcast.txid;
    } catch (error) {
      throw new Error(`Failed to send TRX: ${error.message}`);
    }
  }

  async sendTrc20(to: string, amount: number, contract: string): Promise<string> {
    try {
      if (!this.tronWeb.defaultPrivateKey) {
        throw new Error('Private key not provided in constructor');
      }

      const fromAddress = this.getFromAddress();
      if (!fromAddress) {
        throw new Error('Failed to derive address from private key');
      }

      const contractInstance = await this.getContract(contract);
      return await contractInstance.transfer(to, amount).send({
        from: fromAddress,
      });
    } catch (error) {
      throw new Error(`Failed to send TRC20: ${error.message}`);
    }
  }

  getFromAddress(): string | false {
    return this.tronWeb.defaultAddress.base58;
  }

  /**
   * 获取最新区块号
   */
  async getLatestBlockNumber(): Promise<number> {
    try {
      const block = await this.tronWeb.trx.getCurrentBlock();
      return block.block_header?.raw_data?.number || 0;
    } catch (error) {
      throw new Error(`Failed to get latest TRON block number: ${error.message}`);
    }
  }

  /**
   * 获取区块信息
   */
  async getBlock(blockNumber: number): Promise<Types.Block> {
    try {
      return await this.tronWeb.trx.getBlock(blockNumber);
    } catch (error) {
      throw new Error(`Failed to get TRON block: ${error.message}`);
    }
  }

  /**
   * 转换单位：TRX 到 SUN
   */
  static toSun(trx: number | string): string {
    try {
      const result = TronWeb.toSun(Number(trx));
      return typeof result === 'string' ? result : String(result);
    } catch (error) {
      throw new Error(`Failed to convert TRX to SUN: ${error.message}`);
    }
  }

  /**
   * 转换单位：SUN 到 TRX
   */
  static fromSun(sun: number | string | bigint): string {
    try {
      const result = TronWeb.fromSun(Number(sun));
      return typeof result === 'string' ? result : String(result);
    } catch (error) {
      throw new Error(`Failed to convert SUN to TRX: ${error.message}`);
    }
  }

  /**
   * 获取 TronWeb 实例（用于高级操作）
   */
  getTronWeb(): TronWeb {
    return this.tronWeb;
  }

  /**
   * 设置私钥
   */
  setPrivateKey(privateKey: string): void {
    this.tronWeb.setPrivateKey(privateKey);
  }

  /**
   * 设置地址
   */
  setAddress(address: string): void {
    this.tronWeb.setAddress(address);
  }

  async calculateTrxTransFee(address: string): Promise<bigint> {
    return await this.calculateTrxFee(address, this.TRX_BANDWIDTH);
  }

  async calculateTrc20TransFee(address: string): Promise<bigint> {
    return await this.calculateTrxFee(address, this.TRC20_BANDWIDTH);
  }

  /**
   * 计算 TRX 转账所需的手续费
   * @param address 转账地址
   * @param balance 地址余额（可选，不传则自动查询）
   * @returns 实际需要燃烧的 TRX（单位：SUN）
   */
  private async calculateTrxFee(address: string, bandwidth: number): Promise<bigint> {
    // 获取账户资源信息
    const accountResources = await this.tronWeb.trx.getAccountResources(address);
    const freeNetLimit = accountResources.freeNetLimit || 0;
    const freeNetUsed = accountResources.freeNetUsed || 0;
    const availableBandwidth = freeNetLimit - freeNetUsed;

    // 动态获取带宽价格
    const { bandwidthPrice } = await this.getResourcePrices();

    // 计算需要燃烧的 TRX（如果带宽不足）
    const bandwidthShortage = availableBandwidth < bandwidth ? bandwidth : 0;

    return BigInt(bandwidthShortage) * bandwidthPrice;
  }

  /**
   * 获取链上资源价格
   */
  private async getResourcePrices(): Promise<{
    energyPrice: bigint;
    bandwidthPrice: bigint;
  }> {
    try {
      const chainParameters = await this.tronWeb.trx.getChainParameters();

      // 从链参数中获取 energy 和 bandwidth 的价格
      // getEnergyFee: 每个 energy 的价格（单位：SUN）
      // getTransactionFee: 每个 bandwidth 的价格（单位：SUN）
      const energyFeeParam = chainParameters.find((p: any) => p.key === 'getEnergyFee');
      const bandwidthFeeParam = chainParameters.find((p: any) => p.key === 'getTransactionFee');

      const energyPrice = energyFeeParam ? BigInt(energyFeeParam.value) : 100n; // 默认 100 SUN (2025 官方标准)
      const bandwidthPrice = bandwidthFeeParam ? BigInt(bandwidthFeeParam.value) : 1000n; // 默认 1000 SUN

      return { energyPrice, bandwidthPrice };
    } catch (error) {
      return { energyPrice: 100n, bandwidthPrice: 1000n };
    }
  }
}
