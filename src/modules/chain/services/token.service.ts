import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChainTokenEntity } from '@/entities/chain-token.entity';
import { TokenStatus, CacheConfigs, ChainType } from '@/constants';
import { CacheService } from '@/shared/cache/cache.service';
import { ChainTokenResponse } from '../vo';
import { chain } from 'lodash';

/**
 * 代币服务 - 钱包系统核心功能
 * 提供钱包业务必需的代币查询和缓存功能
 */
@Injectable()
export class ChainTokenService {
  private readonly logger = new Logger(ChainTokenService.name);
  private readonly cacheConfig = CacheConfigs.CHAIN_TOKEN;

  constructor(
    @InjectRepository(ChainTokenEntity)
    private readonly tokenRepository: Repository<ChainTokenEntity>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * 私有方法：获取链上所有代币的基础数据
   * @private
   */
  private async getChainTokenData(chainId: number): Promise<Array<IChainToken>> {
    const cacheKey = `${this.cacheConfig.prefix}data:${chainId}`;

    const cached = await this.cacheService.get<Array<IChainToken>>(cacheKey);
    if (cached) {
      return cached;
    }

    const tokens = await this.tokenRepository.find({
      where: {
        chainId,
        status: TokenStatus.ACTIVE,
      },
    });

    const tokenData = tokens.map((token) => ({
      code: token.code,
      chainType: token.chainType,
      contractAddress: token.contract,
      decimals: token.decimals,
    }));

    await this.cacheService.set(cacheKey, tokenData, { ttl: this.cacheConfig.ttl });
    return tokenData;
  }

  /**
   * 根据代币代码获取合约地址
   */
  async getAddressByCode(chainId: number, code: string): Promise<IChainToken | null> {
    if (!code?.trim()) return null;

    const tokenData = await this.getChainTokenData(chainId);
    const token = tokenData.find((t) => t.code === code.trim());
    return token || null;
  }

  /**
   * 根据合约地址获取代币代码
   */
  async getCodeByAddress(chainId: number, contractAddress: string): Promise<IChainToken | null> {
    if (!contractAddress?.trim()) return null;

    const normalizedAddress = contractAddress.trim();
    const tokenData = await this.getChainTokenData(chainId);
    const token = tokenData.find((t) => t.contractAddress === normalizedAddress);
    return token || null;
  }

  /**
   * 获取链上需要监听的代币合约地址数组（用于区块交易过滤）
   */
  async getChainTokens(chainId: number): Promise<string[]> {
    const tokenData = await this.getChainTokenData(chainId);
    return tokenData.map((t) => t.contractAddress);
  }

  /**
   * 获取链上所有支持的代币列表（包括原生代币）
   */
  async getChainTokenList(chainId: number): Promise<ChainTokenResponse[]> {
    const cacheKey = `${this.cacheConfig.prefix}list:${chainId}`;

    const cached = await this.cacheService.get<ChainTokenResponse[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const tokens = await this.tokenRepository.find({
      where: {
        chainId,
        status: TokenStatus.ACTIVE,
      },
      select: ['id', 'code', 'name', 'logo', 'contract', 'decimals'],
      order: { id: 'ASC' },
    });

    const tokenList = tokens.map(
      (token) =>
        new ChainTokenResponse({
          id: token.id,
          code: token.code,
          name: token.name,
          logo: token.logo,
          contract: token.contract ?? null,
          decimals: token.decimals,
        }),
    );

    await this.cacheService.set(cacheKey, tokenList, { ttl: this.cacheConfig.ttl });
    return tokenList;
  }

  /**
   * 清除代币缓存
   * @private
   */
  private async clearTokenCache(chainId: number): Promise<void> {
    await Promise.all([
      this.cacheService.del(`${this.cacheConfig.prefix}data:${chainId}`),
      this.cacheService.del(`${this.cacheConfig.prefix}list:${chainId}`),
    ]);
  }
}
