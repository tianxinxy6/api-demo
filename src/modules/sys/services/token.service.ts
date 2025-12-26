import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenEntity } from '@/entities/token.entity';
import { TokenStatus } from '@/constants';
import { CacheService } from '@/shared/cache/cache.service';

@Injectable()
export class TokenService {
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
  async getTokenByCode(code: string): Promise<TokenEntity> {
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
}