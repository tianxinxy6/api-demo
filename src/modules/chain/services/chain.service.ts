import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChainEntity } from '@/entities/chain.entity';
import { ChainStatus } from '@/constants';
import { CacheService } from '@/shared/cache/cache.service';
import { SupportedChainResponse } from '../model';

export interface ChainConfig {
  rpcUrl: string;
  apiKey?: string;
  confirmationRequired: number;
  isEnabled: boolean;
}

/**
 * 区块链服务 - 钱包系统核心功能
 * 管理支持的区块链配置和基础信息
 */
@Injectable()
export class ChainService {
  private readonly logger = new Logger(ChainService.name);
  private readonly CACHE_TTL = 3600000; // 1小时
  private readonly CACHE_PREFIX = 'chain:';

  constructor(
    @InjectRepository(ChainEntity)
    private readonly chainRepository: Repository<ChainEntity>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * 获取所有支持的区块链
   */
  async getSupportedChains(): Promise<SupportedChainResponse[]> {
    const cacheKey = `${this.CACHE_PREFIX}supported`;

    const cached = await this.cacheService.get<SupportedChainResponse[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const chains = await this.chainRepository.find({
      where: { status: ChainStatus.ACTIVE },
      select: ['id', 'code', 'name', 'logo', 'type'],
      order: { id: 'ASC' },
    });

    const supportedChains = chains.map(
      (chain) =>
        new SupportedChainResponse({
          id: chain.id,
          code: chain.code,
          name: chain.name,
          logo: chain.logo,
          type: chain.type,
        }),
    );

    await this.cacheService.set(cacheKey, supportedChains, {
      ttl: this.CACHE_TTL,
    });
    return supportedChains;
  }

  /**
   * 根据链代码获取区块链配置
   */
  async getChainConfig(code: string): Promise<ChainEntity | null> {
    if (!code?.trim()) {
      return null;
    }

    const cacheKey = `${this.CACHE_PREFIX}config:${code}`;

    const cached = await this.cacheService.get<ChainEntity>(cacheKey);
    if (cached) {
      return cached;
    }

    const chain = await this.chainRepository.findOne({
      where: { code: code.trim(), status: ChainStatus.ACTIVE },
    });

    if (chain) {
      await this.cacheService.set(cacheKey, chain, { ttl: this.CACHE_TTL });
    }

    return chain;
  }

  /**
   * 根据链ID获取区块链信息
   */
  async getChainById(id: number): Promise<ChainEntity | null> {
    const cacheKey = `${this.CACHE_PREFIX}id:${id}`;

    const cached = await this.cacheService.get<ChainEntity>(cacheKey);
    if (cached) {
      return cached;
    }

    const chain = await this.chainRepository.findOne({
      where: { id },
    });

    if (chain) {
      await this.cacheService.set(cacheKey, chain, { ttl: this.CACHE_TTL });
    }

    return chain;
  }

  /**
   * 清除链缓存
   * @private
   */
  private async clearChainCache(chainId?: number): Promise<void> {
    if (chainId) {
      await this.cacheService.del(`${this.CACHE_PREFIX}id:${chainId}`);
    }
    await this.cacheService.del(`${this.CACHE_PREFIX}supported`);
  }
}
