import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChainType, Status, SysWalletType, ErrorCode, CacheConfigs } from '@/constants';
import { SysWalletAddressEntity } from '@/entities/sys-wallet-address.entity';
import { AddressMgrService } from '@/shared/services/wallet.service';
import { AppConfigService } from '@/shared/services/config.service';
import { BusinessException } from '@/common/exceptions/biz.exception';

/**
 * 系统钱包地址服务
 *
 * 主要功能：
 * 1. 管理系统级别的钱包地址（手续费钱包、提现钱包）
 * 3. 归集地址配置管理
 */
@Injectable()
export class SysWalletAddressService {
  private readonly logger = new Logger(SysWalletAddressService.name);
  private readonly cacheConfig = CacheConfigs.SYS_WALLET;

  constructor(
    @InjectRepository(SysWalletAddressEntity)
    private readonly walletAddressRepository: Repository<SysWalletAddressEntity>,
    private readonly addressMgrService: AddressMgrService,
    private readonly systemConfigService: AppConfigService,
  ) {}

  /**
   * 创建新的系统钱包
   * @param chainType 链类型
   * @param type 钱包类型（手续费/提现）
   */
  async create(chainType: ChainType, type: SysWalletType): Promise<void> {
    const address = await this.walletAddressRepository.findOne({
      where: { chainType, type },
    });
    if (address) {
      return;
    }

    try {
      // 使用钱包服务生成地址
      const addressInfo = await this.addressMgrService.generateWallet(chainType);

      // 保存到数据库
      const walletAddress = new SysWalletAddressEntity();
      walletAddress.chainId = 0;
      walletAddress.type = type;
      walletAddress.chainType = chainType;
      walletAddress.name = 'wallet';
      walletAddress.address = addressInfo.address;
      walletAddress.key = addressInfo.secKey;
      walletAddress.status = Status.Enabled;

      const savedAddress = await this.walletAddressRepository.save(walletAddress);

      // 存储私钥到 Vault（系统地址不需要 userId）
      await this.addressMgrService.storePrivateKey(savedAddress.id, null, addressInfo);
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
    return await this.addressMgrService.getPrivateKey(address.id, null, address.key);
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
}
