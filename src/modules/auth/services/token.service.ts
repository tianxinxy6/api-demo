import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * 令牌服务
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
  }

  /**
   * 验证Token是否正确,如果正确则返回所属用户对象
   * @param token
   * @returns 验证成功返回用户信息，失败返回 null
   */
  async verify(token: string): Promise<IAuthUser | null> {
    try {
      const payload = await this.jwtService.verifyAsync(token);
      return payload as IAuthUser;
    } catch (error) {
      this.logger.warn(`Token verification failed: ${error.message}`);
      return null;
    }
  }

  /**
   * 生成访问令牌
   * @param payload 令牌载荷
   */
  async sign(payload: IAuthUser): Promise<string> {
    try {
      return await this.jwtService.signAsync(payload);
    } catch (error) {
      this.logger.error(`Token generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 生成刷新令牌（JWT版本）
   * @param payload 令牌载荷，通常包含用户ID
   */
  async generateRefreshToken(payload: IAuthUser): Promise<string> {
    try {
      const refreshExpiresIn = this.configService.get('jwt.refreshExpires', 604800);
      // 刷新令牌使用不同的载荷标识
      return await this.jwtService.signAsync(
        { ...payload, type: 'refresh' }, 
        { expiresIn: `${refreshExpiresIn}s` }
      );
    } catch (error) {
      this.logger.error(`Refresh token generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 验证刷新令牌（JWT版本）
   * @param token 刷新令牌
   * @returns 返回用户信息
   */
  async verifyRefreshToken(token: string): Promise<IAuthUser> {
    try {
      const payload = await this.jwtService.verifyAsync(token);
      
      // 验证是否为刷新令牌
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('令牌类型错误');
      }
      
      // 移除type字段，返回原始用户信息
      const { type, ...userPayload } = payload;
      return userPayload as IAuthUser;
    } catch (error) {
      this.logger.warn(`Refresh token verification failed: ${error.message}`);
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }
  }
}
