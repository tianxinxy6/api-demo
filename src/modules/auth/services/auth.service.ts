import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { UserService } from '../../user/services/user.service';
import { TokenService } from './token.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { UserLoginLogService } from './user-login-log.service';
import { UserRegisterDto, UserLoginDto } from '../../user/dto/user.dto';
import { UserStatus } from '@/constants';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private tokenService: TokenService,
    private tokenBlacklistService: TokenBlacklistService,
    private userLoginLogService: UserLoginLogService,
  ) {}

  /**
   * 用户注册业务逻辑
   */
  async register(dto: UserRegisterDto) {
    await this.userService.createUser(dto);
    return;
  }

  /**
   * 用户登录业务逻辑
   */
  async login(dto: UserLoginDto, req: FastifyRequest) {
    try {
      const user = await this.userService.verifyLogin(dto.username, dto.password);
      if (!user) {
        await this.userLoginLogService.recordLoginLog(
            0,
            req,
            0, // 登录失败
            '密码错误:' + dto.username + ':' + dto.password,
          );
        throw new UnauthorizedException('用户名或密码错误');
      }
      if(user.status !== UserStatus.Enabled) {
        throw new UnauthorizedException('用户已被禁用');
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
    } catch (error) {
      // 如果是用户名不存在的情况，不记录日志
      throw error;
    }
  }

  /**
   * 刷新 Token 业务逻辑
   */
  async refreshToken(refreshToken: string, req: FastifyRequest) {
    const isValidToken = await this.tokenBlacklistService.isTokenValid(refreshToken);
    if (!isValidToken) {
      throw new UnauthorizedException('Token 已失效，请重新登录');
    }

    // 验证刷新令牌
    const user = await this.tokenService.verifyRefreshToken(refreshToken);
    
    // 验证用户是否存在
    const userInfo = await this.userService.findUserById(user.uid);
    if (!userInfo) {
      throw new UnauthorizedException('用户不存在');
    }

    // 生成新的访问令牌和刷新令牌
    const payload = { uid: user.uid };
    const newAccessToken = await this.tokenService.sign(payload);
    const newRefreshToken = await this.tokenService.generateRefreshToken(payload);

    // 作废旧的刷新令牌
    await this.tokenBlacklistService.revokeToken(
      refreshToken,
      user.uid,
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * 获取当前登录用户信息业务逻辑
   */
  async getCurrentUser(user: IAuthUser) {
    const userInfo = await this.userService.getUserProfile(user.uid);
    if (!userInfo) {
      throw new UnauthorizedException('用户不存在');
    }

    return userInfo;
  }

  /**
   * 用户登出业务逻辑
   */
  async logout(user: IAuthUser, req: FastifyRequest) {
    await this.tokenBlacklistService.revokeToken(
        req.accessToken,
        user.uid,
      );

    return;
  }
}