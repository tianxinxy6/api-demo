import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenEntity } from '@/entities/token.entity';
import { TokenStatus } from '@/constants';
import { CacheService } from '@/shared/cache/cache.service';

/**
 * 代币服务
 * 职责：
 * 1. 管理系统支持的代币配置
 * 2. 提供代币查询接口（带缓存）
 * 3. 支持按代码、ID查询代币信息
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private static readonly CACHE_PREFIX = 'token:';
  private readonly CACHE_TTL = 3600000; // 1小时缓存

  constructor(
    @InjectRepository(TokenEntity)
    private readonly tokenRepository: Repository<TokenEntity>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * 通过代币代码获取代币记录（带缓存）
   * @param code 代币代码，如 'BTC', 'ETH', 'USDT'
   * @returns 代币实体
   */
  async getTokenByCode(code: string): Promise<TokenEntity | null> {
    const cacheKey = `${TokenService.CACHE_PREFIX}${code.toUpperCase()}`;
    
    // 尝试从缓存获取
    const cachedToken = await this.cacheService.get<TokenEntity>(cacheKey);
    if (cachedToken) {
      return cachedToken;
    }

    // 缓存未命中，从数据库查询
    const token = await this.tokenRepository.findOne({
      where: { 
        code: code.toUpperCase(),
        status: TokenStatus.ACTIVE 
      },
    });
    if (!token) {
      return null;
    }

    // 缓存查询结果
    await this.cacheService.set(cacheKey, token, { ttl: this.CACHE_TTL });

    return token;
  }

  /**
   * 通过代币ID获取代币记录（带缓存）
   * @param id 代币ID
   * @returns 代币实体
   */
  async getTokenById(id: number): Promise<TokenEntity | null> {
    const cacheKey = `${TokenService.CACHE_PREFIX}id:${id}`;
    
    // 尝试从缓存获取
    const cachedToken = await this.cacheService.get<TokenEntity>(cacheKey);
    if (cachedToken) {
      return cachedToken;
    }

    // 缓存未命中，从数据库查询
    const token = await this.tokenRepository.findOne({
      where: { 
        id,
        status: TokenStatus.ACTIVE 
      },
    });
    if (!token) {
      return null;
    }

    // 缓存查询结果
    await this.cacheService.set(cacheKey, token, { ttl: this.CACHE_TTL });

    return token;
  }

  /**
   * 获取所有激活状态的代币列表（带缓存）
   * @returns 代币实体数组
   */
  async getAllTokens(): Promise<TokenEntity[]> {
    const cacheKey = `${TokenService.CACHE_PREFIX}all`;
    
    // 尝试从缓存获取
    const cachedTokens = await this.cacheService.get<TokenEntity[]>(cacheKey);
    if (cachedTokens) {
      return cachedTokens;
    }

    // 缓存未命中，从数据库查询
    const tokens = await this.tokenRepository.find({
      where: { 
        status: TokenStatus.ACTIVE 
      },
      order: {
        id: 'ASC',
      },
    });

    // 缓存查询结果
    await this.cacheService.set(cacheKey, tokens, { ttl: this.CACHE_TTL });

    return tokens;
  }
}