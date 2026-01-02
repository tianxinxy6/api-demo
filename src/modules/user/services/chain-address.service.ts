import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserWalletAddressEntity } from '@/entities/user-wallet-address.entity';
import { ChainType, Status, ErrorCode, CacheConfigs } from '@/constants';
import { BusinessException } from '@/common/exceptions/biz.exception';
import { CacheService } from '@/shared/cache/cache.service';
import { AddressMgrService } from '@/shared/services/wallet.service';
import { ChainAddressResponse } from '../vo';

/**
 * 用户链上地址服务
 */
@Injectable()
export class ChainAddressService {
  private readonly logger = new Logger(ChainAddressService.name);
  private readonly cacheConfig = CacheConfigs.CHAIN_ADDRESS;

  constructor(
    @InjectRepository(UserWalletAddressEntity)
    private readonly walletAddressRepository: Repository<UserWalletAddressEntity>,
    private readonly cacheService: CacheService,
    private readonly addressMgrService: AddressMgrService,
  ) {}

  /**
   * 为用户创建或获取链上地址
   * 每个用户在每条链上只能有一个地址
   */
  async createAndGet(userId: number, chainType: ChainType): Promise<ChainAddressResponse> {
    // 检查用户在该链上是否已有地址
    const existingAddress = await this.findByUserAndChain(userId, chainType);
    if (existingAddress) {
      return this.toAddressResponse(existingAddress);
    }

    try {
      // 生成新地址（委托给管理器）
      const addressInfo = await this.addressMgrService.generateWallet(chainType);

      // 保存到数据库
      const chainAddress = this.walletAddressRepository.create({
        userId,
        chainId: 0,
        chainType,
        address: addressInfo.address,
        key: addressInfo.secKey,
        status: Status.Enabled,
      });

      const savedAddress = await this.walletAddressRepository.save(chainAddress);

      // 将私钥加密存储到 Vault（委托给管理器）
      await this.addressMgrService.storePrivateKey(savedAddress.id, userId, addressInfo);

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
    await this.cacheService.set(cacheKey, result, { ttl: this.cacheConfig.ttl });

    return result;
  }

  /**
   * 从 Vault 获取私钥
   */
  async getPrivateKey(chainType: ChainType, address: string): Promise<string> {
    try {
      const chainAddress = await this.findByAddress(chainType, address);
      if (!chainAddress) {
        throw new BusinessException(ErrorCode.ErrChainAddressNotFound);
      }

      // 委托给管理器解密
      return await this.addressMgrService.getPrivateKey(
        chainAddress.id,
        chainAddress.userId,
        chainAddress.key,
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
   * 清除用户地址缓存
   * @private
   */
  private async clearUserAddressCache(userId: number): Promise<void> {
    await this.cacheService.del(`user_addresses:${userId}`);
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
