import { Injectable, Logger } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { UserService } from '../../user/services/user.service';
import { TokenService } from './token.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { UserLoginLogService } from './user-login-log.service';
import { UserRegisterDto, UserLoginDto } from '../../user/dto/user.dto';
import { UserStatus, ErrorCode } from '@/constants';
import { BusinessException } from '@/common/exceptions/biz.exception';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private userService: UserService,
    private tokenService: TokenService,
    private tokenBlacklistService: TokenBlacklistService,
    private userLoginLogService: UserLoginLogService,
  ) {}

  /**
   * 用户注册
   */
  async register(dto: UserRegisterDto): Promise<void> {
    await this.userService.createUser(dto);
  }

  /**
   * 用户登录
   */
  async login(dto: UserLoginDto, req: FastifyRequest) {
    const user = await this.userService.verifyLogin(dto.username, dto.password);
    
    if (!user) {
      await this.userLoginLogService.recordLoginLog(
        0,
        req,
        0,
        `密码错误: ${dto.username}`,
      );
      throw new BusinessException(ErrorCode.ErrAuthLogin);
    }

    if (user.status !== UserStatus.Enabled) {
      throw new BusinessException(ErrorCode.ErrAuthUserDisabled);
    }

    const payload = { uid: user.id };
    const accessToken = await this.tokenService.sign(payload);
    const refreshToken = await this.tokenService.generateRefreshToken(payload);

    // 记录登录成功日志
    await this.userLoginLogService.recordLoginLog(user.id, req, 1);

    // 更新用户登录信息
    await this.userService.updateLoginInfo(user.id, req);

    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  /**
   * 刷新令牌
   */
  async refreshToken(refreshToken: string, req: FastifyRequest) {
    const isValidToken = await this.tokenBlacklistService.isTokenValid(refreshToken);
    if (!isValidToken) {
      throw new BusinessException(ErrorCode.ErrAuthTokenRevoked);
    }

    // 验证刷新令牌
    const user = await this.tokenService.verifyRefreshToken(refreshToken);
    
    // 验证用户是否存在
    const userInfo = await this.userService.findUserById(user.uid);
    if (!userInfo) {
      throw new BusinessException(ErrorCode.ErrUserNotFound);
    }

    // 生成新的访问令牌和刷新令牌
    const payload = { uid: user.uid };
    const newAccessToken = await this.tokenService.sign(payload);
    const newRefreshToken = await this.tokenService.generateRefreshToken(payload);

    // 作废旧的刷新令牌
    await this.tokenBlacklistService.revokeToken(refreshToken, user.uid);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * 获取当前登录用户信息
   */
  async getCurrentUser(user: IAuthUser) {
    const userInfo = await this.userService.getUserProfile(user.uid);
    if (!userInfo) {
      throw new BusinessException(ErrorCode.ErrUserNotFound);
    }

    return userInfo;
  }

  /**
   * 用户登出
   */
  async logout(user: IAuthUser, req: FastifyRequest): Promise<void> {
    await this.tokenBlacklistService.revokeToken(req.accessToken, user.uid);
  }
}