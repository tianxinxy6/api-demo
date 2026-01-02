import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import * as crypto from 'crypto';
import { UserWalletAddressEntity } from '@/entities/user-wallet-address.entity';
import { AddressInfo, ChainType, Status, ErrorCode } from '@/constants';
import { BusinessException } from '@/common/exceptions/biz.exception';
import { VaultUtil, VaultConfig } from '@/utils/vault.util';
import { CacheService } from '@/shared/cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { WalletService } from '@/shared/services/wallet.service';
import { ChainAddressResponse } from '../model';

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
export class ChainAddressService {
  private readonly logger = new Logger(ChainAddressService.name);
  private readonly CACHE_TTL = 3600000; // 1小时缓存
  private vaultUtil: VaultUtil;

  constructor(
    @InjectRepository(UserWalletAddressEntity)
    private readonly walletAddressRepository: Repository<UserWalletAddressEntity>,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly walletService: WalletService,
  ) {
    // 初始化 Vault 配置
    const vaultConfig: VaultConfig = this.configService.get('app.vault');
    this.vaultUtil = new VaultUtil(vaultConfig, this.httpService);
  }

  /**
   * 为用户创建或获取链上地址
   * 每个用户在每条链上只能有一个地址
   */
  async createChainAddress(userId: number, chainType: ChainType): Promise<ChainAddressResponse> {
    // 检查用户在该链上是否已有地址
    const existingAddress = await this.findByUserAndChain(userId, chainType);
    if (existingAddress) {
      return this.toAddressResponse(existingAddress);
    }

    try {
      // 生成新地址
      const addressInfo = await this.walletService.generateWallet(chainType);

      // 生成32位随机加密密钥
      const key = crypto.randomBytes(16).toString('hex');

      // 保存到数据库
      const chainAddress = this.walletAddressRepository.create({
        userId,
        chainId: 0,
        chainType,
        address: addressInfo.address,
        key,
        status: Status.Enabled,
      });

      const savedAddress = await this.walletAddressRepository.save(chainAddress);

      // 将私钥加密存储到 Vault
      await this.storePrivateKeyToVault(savedAddress.id, userId, addressInfo, key);
      // 清除用户地址列表缓存
      await this.clearUserAddressCache(userId);

      return this.toAddressResponse(savedAddress);
    } catch (error) {
      this.logger.error(
        `Failed to create chain address for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findByUserAndChain(
    userId: number,
    chainType: ChainType,
  ): Promise<UserWalletAddressEntity | null> {
    return this.walletAddressRepository.findOne({
      where: { userId, chainType },
    });
  }

  async findByAddress(
    chainType: ChainType,
    address: string,
  ): Promise<UserWalletAddressEntity | null> {
    return this.walletAddressRepository.findOne({
      where: { chainType, address },
    });
  }

  /**
   * 获取用户的钱包地址列表
   */
  async getChainAddresses(userId: number): Promise<ChainAddressResponse[]> {
    const cacheKey = `user_addresses:${userId}`;

    // 尝试从缓存获取
    const cachedResult = await this.cacheService.get<ChainAddressResponse[]>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // 从数据库查询
    const addresses = await this.walletAddressRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      select: ['id', 'chainType', 'address', 'status', 'createdAt'], // 只选择必要字段
    });

    const result: ChainAddressResponse[] = addresses.map(
      (addr) =>
        new ChainAddressResponse({
          id: addr.id,
          chainType: addr.chainType,
          address: addr.address,
          createdAt: addr.createdAt,
        }),
    );

    // 存储到缓存
    await this.cacheService.set(cacheKey, result, { ttl: this.CACHE_TTL });

    return result;
  }

  /**
   * 从 Vault 获取私钥（支持解密）
   */
  async getPrivateKey(chainType: ChainType, address: string): Promise<string> {
    try {
      const chainAddress = await this.findByAddress(chainType, address);
      if (!chainAddress) {
        throw new BusinessException(ErrorCode.ErrChainAddressNotFound);
      }

      const addressId = chainAddress.id;
      const userId = chainAddress.userId;
      const key = chainAddress.key;
      const vaultKey = `address_${addressId}`;
      const data = await this.vaultUtil.getPrivateKey(vaultKey);
      return this.decryptPrivateKey(
        data.privateKey, // 这里存储的是加密后的数据
        data.keyHash,
        userId,
        addressId,
        key,
      );
    } catch (error) {
      this.logger.error(`Failed to get private key for address ${address}: ${error.message}`);
      throw new BusinessException(ErrorCode.ErrPrivateKeyRetrieveFailed);
    }
  }

  /**
   * 获取需要处理的链上地址列表
   */
  async getAddressesByChain(chainType: ChainType, addresss: string[]): Promise<string[]> {
    const addresses = await this.walletAddressRepository.find({
      where: { chainType, address: In(addresss) },
      select: ['address'],
    });

    return addresses.map((addr) => addr.address);
  }

  /**
   * 根据地址获取用户ID
   */
  async getUserIdByAddress(address: string): Promise<number | undefined> {
    try {
      const chainAddress = await this.walletAddressRepository.findOne({
        where: { address: address?.toLowerCase() },
        select: ['userId'],
      });

      return chainAddress?.userId;
    } catch (error) {
      this.logger.warn(`Failed to get user ID for address ${address}:`, error.message);
      return undefined;
    }
  }

  /**
   * 私有方法：将加密私钥存储到 Vault
   */
  private async storePrivateKeyToVault(
    addressId: number,
    userId: number,
    addressInfo: AddressInfo,
    key: string,
  ): Promise<string> {
    try {
      const vaultKey = `address_${addressId}`;
      const { encryptedData, keyHash } = this.encryptPrivateKey(
        addressInfo.privateKey,
        userId,
        addressId,
        key,
      );

      // 将加密后的私钥和验证信息作为普通数据存储到Vault
      await this.vaultUtil.storePrivateKey(vaultKey, {
        privateKey: encryptedData, // 存储加密后的数据
        address: addressInfo.address,
        publicKey: addressInfo.publicKey,
        keyHash,
        userId,
      });

      this.logger.debug(`Encrypted private key stored for address ${addressId}`);
      return keyHash;
    } catch (error) {
      this.logger.error(`Failed to store private key: ${error.message}`, error.stack);
      throw new BusinessException(ErrorCode.ErrPrivateKeyStoreFailed);
    }
  }

  /**
   * 清除用户地址缓存
   * @private
   */
  private async clearUserAddressCache(userId: number): Promise<void> {
    await this.cacheService.del(`user_addresses:${userId}`);
  }

  /**
   * 生成私钥加密密钥
   * 基于用户ID、地址ID、系统密钥和唯一加密密钥生成
   */
  private generateKey(userId: number, addressId: number, key: string): string {
    const systemKey = this.configService.get('app.encryptKey');
    const keyMaterial = `user:${userId}|address:${addressId}|system:${systemKey}|key:${key}`;

    // 使用PBKDF2派生密钥，增强安全性
    return crypto.pbkdf2Sync(keyMaterial, 'wallet-salt-2025', 100000, 32, 'sha256').toString('hex');
  }

  /**
   * 加密私钥
   */
  private encryptPrivateKey(
    privateKey: string,
    userId: number,
    addressId: number,
    secKey: string,
  ): { encryptedData: string; keyHash: string } {
    const derivedKey = this.generateKey(userId, addressId, secKey);
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
   */
  private decryptPrivateKey(
    encryptedData: string,
    keyHash: string,
    userId: number,
    addressId: number,
    secKey: string,
  ): string {
    const derivedKey = this.generateKey(userId, addressId, secKey);
    const expectedKeyHash = crypto
      .createHash('sha256')
      .update(derivedKey)
      .digest('hex')
      .slice(0, 16);

    if (expectedKeyHash !== keyHash) {
      throw new Error('Invalid key hash - decryption key mismatch');
    }

    const key = crypto.createHash('sha256').update(derivedKey).digest();
    const iv = Buffer.from(encryptedData.slice(0, 32), 'hex');
    const encrypted = encryptedData.slice(32);

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private toAddressResponse(entity: UserWalletAddressEntity): ChainAddressResponse {
    return new ChainAddressResponse({
      id: entity.id,
      chainType: entity.chainType,
      address: entity.address,
      createdAt: entity.createdAt,
    });
  }
}
