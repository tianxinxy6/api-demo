import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@/shared/cache/redis.service';
import { ConfigService } from '@nestjs/config';
import { md5 } from '@/utils';

/**
 * Token 黑名单服务 - 简化版本
 * 专注于核心功能：撤销未过期的Token
 */
@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private readonly BLACKLIST_PREFIX = 'token:revoked:';

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 撤销单个Token（加入黑名单）
   * 只有未过期的Token才需要撤销
   */
  async revokeToken(token: string, userId: number): Promise<void> {
    // md5 token
    const md5Token = md5(token);
    // 获取 JWT 过期时间（秒），从配置中读取
    const expiresIn = this.configService.get<string>('jwt.expiresIn', '1h');
    // 将时间字符串转换为秒数
    const ttl = this.parseExpireTime(expiresIn);
    // 存储到黑名单，TTL为token剩余有效期
    const blacklistKey = `${this.BLACKLIST_PREFIX}${md5Token}`;
    await this.redisService.set(blacklistKey, userId.toString(), {
      ttl,
    });

    this.logger.log(`Revoked token for user ${userId}`);
  }

  /**
   * 解析过期时间字符串为秒数
   * @param expiresIn 如 '1h', '7d', '60s'
   */
  private parseExpireTime(expiresIn: string): number {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1), 10);
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 3600; // 默认1小时
    }
  }

  /**
   * 检查Token是否有效（未被撤销）
   */
  async isTokenValid(token: string): Promise<boolean> {
    const md5Token = md5(token);
    const blacklistKey = `${this.BLACKLIST_PREFIX}${md5Token}`;
    const exists = await this.redisService.get(blacklistKey);
    return !exists; // 不在黑名单中才是有效的
  }
}