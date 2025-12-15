import { Injectable, Logger } from '@nestjs/common';
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
  ) {}

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
      // 使用配置中的过期时间
      const expiresIn = this.configService.get('jwt.expires', '7d');
      return await this.jwtService.signAsync(payload, { expiresIn });
    } catch (error) {
      this.logger.error(`Token generation failed: ${error.message}`);
      throw error;
    }
  }
}
