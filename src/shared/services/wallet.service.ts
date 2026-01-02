import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { ChainType, ErrorCode } from '@/constants';
import { EthUtil } from '@/utils/eth.util';
import { TronUtil } from '@/utils/tron.util';
import { VaultUtil, VaultConfig } from '@/utils/vault.util';
import { BusinessException } from '@/common/exceptions/biz.exception';

/**
 * 钱包地址管理服务
 * 职责：
 * 1. 提供统一的钱包地址生成接口
 * 2. 支持多种区块链类型（ETH、TRON）
 * 3. 私钥加密/解密管理
 * 4. Vault 存储操作
 */
@Injectable()
export class AddressMgrService {
  private readonly logger = new Logger(AddressMgrService.name);
  private readonly vaultUtil: VaultUtil;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    const vaultConfig: VaultConfig = this.configService.get('app.vault');
    this.vaultUtil = new VaultUtil(vaultConfig, this.httpService);
  }

  /**
   * 根据链类型生成钱包地址
   * @param chainType 区块链类型
   * @returns 地址信息（包含私钥、公钥、地址）
   */
  async generateWallet(chainType: ChainType): Promise<GeneratedAddress> {
    try {
      // 随机生成 32 位 key
      const secKey = crypto.randomBytes(16).toString('hex');
      switch (chainType) {
        case ChainType.ETH:
          return { ...EthUtil.generate(), secKey };
        case ChainType.TRON:
          return { ...(await TronUtil.generate()), secKey };
        default:
          this.logger.warn(`Unsupported chain type: ${chainType}`);
          throw new BusinessException(ErrorCode.ErrSharedChainTypeNotSupported);
      }
    } catch (error) {
      this.logger.error(`Failed to generate wallet for chain type ${chainType}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 存储用户私钥到 Vault（带用户ID）
   */
  async storePrivateKey(
    addressId: number,
    userId: number | null,
    addressInfo: GeneratedAddress,
  ): Promise<void> {
    try {
      const vaultKey = this.genrateVaultKey(addressId, userId);
      const { encryptedData, keyHash } = this.encryptPrivateKey(
        addressInfo.privateKey,
        addressId,
        userId,
        addressInfo.secKey,
      );

      await this.vaultUtil.storePrivateKey(vaultKey, {
        privateKey: encryptedData,
        address: addressInfo.address,
        publicKey: addressInfo.publicKey,
        keyHash,
      });
    } catch (error) {
      this.logger.error(`Failed to store private key: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 获取私钥
   */
  async getPrivateKey(addressId: number, userId: number | null, key: string): Promise<string> {
    try {
      const vaultKey = this.genrateVaultKey(addressId, userId);

      const data = await this.vaultUtil.getPrivateKey(vaultKey);
      return this.decryptPrivateKey(data.privateKey, data.keyHash, addressId, userId, key);
    } catch (error) {
      this.logger.error(
        `Failed to get private key for address ${addressId} - ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private genrateVaultKey(addressId: number, userId: number | null): string {
    if (userId) {
      return `address_${addressId}`;
    }
    return `address_sys_${addressId}`;
  }

  /**
   * 生成派生密钥
   * @param addressId 地址ID
   * @param userId 用户ID（系统地址传 null）
   * @param key 加密密钥
   */
  private generateDerivedKey(addressId: number, userId: number | null, key: string): string {
    const systemKey = this.configService.get('app.encryptKey');
    if (!systemKey) {
      throw new Error('System encryption key is not configured');
    }

    // 用户地址包含 userId，系统地址不包含
    const keyMaterial = userId
      ? `user:${userId}|address:${addressId}|system:${systemKey}|key:${key}`
      : `address:${addressId}|system:${systemKey}|key:${key}`;

    return crypto.pbkdf2Sync(keyMaterial, 'wallet-salt-2025', 100000, 32, 'sha256').toString('hex');
  }

  /**
   * 加密私钥
   */
  private encryptPrivateKey(
    privateKey: string,
    addressId: number,
    userId: number | null,
    key: string,
  ): { encryptedData: string; keyHash: string } {
    const derivedKey = this.generateDerivedKey(addressId, userId, key);
    const encryptionKey = crypto.createHash('sha256').update(derivedKey).digest();
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const encryptedData = iv.toString('hex') + encrypted;
    const keyHash = crypto.createHash('sha256').update(derivedKey).digest('hex').slice(0, 16);

    return { encryptedData, keyHash };
  }

  /**
   * 解密私钥
   */
  private decryptPrivateKey(
    encryptedData: string,
    keyHash: string,
    addressId: number,
    userId: number | null,
    key: string,
  ): string {
    const derivedKey = this.generateDerivedKey(addressId, userId, key);
    const expectedKeyHash = crypto
      .createHash('sha256')
      .update(derivedKey)
      .digest('hex')
      .slice(0, 16);

    if (expectedKeyHash !== keyHash) {
      this.logger.error(`Decryption key mismatch for address ${addressId}`);
      throw new BusinessException(ErrorCode.ErrSysWalletDecryptionFailed);
    }

    const encryptionKey = crypto.createHash('sha256').update(derivedKey).digest();
    const iv = Buffer.from(encryptedData.slice(0, 32), 'hex');
    const encrypted = encryptedData.slice(32);

    const decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
