import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import * as crypto from 'crypto';
import { AddressInfo, ChainType, Status, SysWalletType, ErrorCode } from '@/constants';
import { VaultUtil, VaultConfig } from '@/utils/vault.util';
import { ConfigService } from '@nestjs/config';
import { SysWalletAddressEntity } from '@/entities/sys-wallet-address.entity';
import { WalletService } from '@/shared/services/wallet.service';
import { ConfigService as SystemConfigService } from '@/shared/config/config.service';
import { BusinessException } from '@/common/exceptions/biz.exception';

/**
 * 链上地址服务
 *
 * 主要功能：
 * 1. 生成 ETH/TRON 钱包地址
 * 2. 管理用户在不同区块链上的专属充值地址
 * 3. 私钥安全存储（使用 Vault）
 * 4. 获取用户钱包地址列表
 *
 * 设计原则：
 * - API 返回数据最小化
 * - 使用 DTO 规范输入输出
 * - 敏感信息（私钥）不在常规 API 中返回
 */
@Injectable()
export class SysWalletAddressService {
  private readonly logger = new Logger(SysWalletAddressService.name);
  private readonly CACHE_TTL = 3600000; // 1小时缓存
  private vaultUtil: VaultUtil;

  constructor(
    @InjectRepository(SysWalletAddressEntity)
    private readonly walletAddressRepository: Repository<SysWalletAddressEntity>,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly walletService: WalletService,
    private readonly systemConfigService: SystemConfigService,
  ) {
    // 初始化 Vault 配置
    const vaultConfig: VaultConfig = this.configService.get('app.vault');
    this.vaultUtil = new VaultUtil(vaultConfig, this.httpService);
  }

  /**
   * 创建新的链上地址
   */
  async createAddress(chainType: ChainType, type: SysWalletType): Promise<void> {
    const address = await this.walletAddressRepository.findOne({
      where: { chainType, type },
    });
    if (address) {
      return;
    }

    try {
      // 生成新地址
      const addressInfo = await this.walletService.generateWallet(chainType);

      // 生成32位随机加密密钥
      const key = crypto.randomBytes(16).toString('hex');

      // 保存到数据库
      const walletAddress = new SysWalletAddressEntity();
      walletAddress.chainId = 0;
      walletAddress.type = type;
      walletAddress.chainType = chainType;
      walletAddress.name = 'wallet';
      walletAddress.address = addressInfo.address;
      walletAddress.key = key;
      walletAddress.status = Status.Enabled;

      const savedAddress = await this.walletAddressRepository.save(walletAddress);

      // 将私钥加密存储到 Vault
      await this.storePrivateKeyToVault(savedAddress.id, addressInfo, key);
    } catch (error) {
      this.logger.error(`Failed to create chain address: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getFeeWallet(chainType: ChainType): Promise<string> {
    return await this.getWallet(chainType, SysWalletType.Fee);
  }

  async getWithdrawWallet(chainType: ChainType): Promise<string> {
    return await this.getWallet(chainType, SysWalletType.Widthdraw);
  }

  /**
   * 获取系统钱包地址的私钥
   * @param chainType 链类型
   * @param type 钱包类型
   */
  async getWallet(chainType: ChainType, type: SysWalletType): Promise<string> {
    const address = await this.walletAddressRepository.findOne({
      where: {
        chainType,
        type,
        status: Status.Enabled,
      },
    });
    if (!address) {
      this.logger.warn(`System wallet not found: chainType=${chainType}, type=${type}`);
      throw new BusinessException(ErrorCode.ErrSysWalletNotFound);
    }
    return await this.getPrivateKey(address.id, address.key);
  }

  /**
   * 获取归集钱包地址
   * 从 config 表中读取归集钱包地址配置
   * @param chainType 链类型
   * @returns 归集钱包地址
   */
  async getCollectWalletAddress(chainName: string): Promise<string | null> {
    // 根据链类型构建配置键名
    const configKey = `collect_wallet_address_${chainName.toLowerCase()}`;

    // 从 config 表中获取归集钱包地址
    const address = await this.systemConfigService.get(configKey);
    if (!address) {
      return null;
    }

    return address;
  }

  /**
   * 从 Vault 获取私钥（支持解密）
   * @private
   */
  private async getPrivateKey(addressId: number, key: string): Promise<string> {
    try {
      const vaultKey = `address_sys_${addressId}`;
      const data = await this.vaultUtil.getPrivateKey(vaultKey);
      return this.decryptPrivateKey(data.privateKey, data.keyHash, addressId, key);
    } catch (error) {
      this.logger.error(
        `Failed to get private key for address ${addressId}: ${error.message}`,
        error.stack,
      );
      throw new BusinessException(ErrorCode.ErrSysWalletPrivateKeyFailed);
    }
  }

  /**
   * 将加密私钥存储到 Vault
   * @private
   */
  private async storePrivateKeyToVault(
    addressId: number,
    addressInfo: AddressInfo,
    key: string,
  ): Promise<string> {
    try {
      const vaultKey = `address_sys_${addressId}`;
      const { encryptedData, keyHash } = this.encryptPrivateKey(
        addressInfo.privateKey,
        addressId,
        key,
      );

      await this.vaultUtil.storePrivateKey(vaultKey, {
        privateKey: encryptedData,
        address: addressInfo.address,
        publicKey: addressInfo.publicKey,
        keyHash,
      });

      this.logger.log(`Successfully stored encrypted private key for address ${addressId}`);
      return keyHash;
    } catch (error) {
      this.logger.error(`Failed to store private key to vault: ${error.message}`, error.stack);
      throw new BusinessException(ErrorCode.ErrSysWalletPrivateKeyStoreFailed);
    }
  }

  /**
   * 生成私钥加密密钥
   * 基于地址ID、系统密钥和唯一加密密钥生成
   */
  private generateKey(addressId: number, key: string): string {
    const systemKey = this.configService.get('app.encryptKey');
    if (!systemKey) {
      throw new Error('System encryption key is not configured');
    }
    const keyMaterial = `address:${addressId}|system:${systemKey}|key:${key}`;

    // 使用PBKDF2派生密钥，增强安全性
    return crypto.pbkdf2Sync(keyMaterial, 'wallet-salt-2025', 100000, 32, 'sha256').toString('hex');
  }

  /**
   * 加密私钥
   */
  private encryptPrivateKey(
    privateKey: string,
    addressId: number,
    secKey: string,
  ): { encryptedData: string; keyHash: string } {
    const derivedKey = this.generateKey(addressId, secKey);
    const key = crypto.createHash('sha256').update(derivedKey).digest();
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const encryptedData = iv.toString('hex') + encrypted;
    const keyHash = crypto.createHash('sha256').update(derivedKey).digest('hex').slice(0, 16);

    return { encryptedData, keyHash };
  }

  /**
   * 解密私钥
   * @private
   */
  private decryptPrivateKey(
    encryptedData: string,
    keyHash: string,
    addressId: number,
    secKey: string,
  ): string {
    const derivedKey = this.generateKey(addressId, secKey);
    const expectedKeyHash = crypto
      .createHash('sha256')
      .update(derivedKey)
      .digest('hex')
      .slice(0, 16);

    if (expectedKeyHash !== keyHash) {
      this.logger.error(`Decryption key mismatch for address ${addressId}`);
      throw new BusinessException(ErrorCode.ErrSysWalletDecryptionFailed);
    }

    const key = crypto.createHash('sha256').update(derivedKey).digest();
    const iv = Buffer.from(encryptedData.slice(0, 32), 'hex');
    const encrypted = encryptedData.slice(32);

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
