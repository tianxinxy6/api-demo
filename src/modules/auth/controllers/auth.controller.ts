import { Controller, Get, Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { ApiSecurityAuth } from '@/common/decorators/swagger.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { AuthUser } from '@/common/decorators/auth-user.decorator';
import { AuthService } from '../services/auth.service';
import { UserRegisterDto, UserLoginDto } from '../../user/dto/user.dto';
import { RefreshTokenDto } from '../dto/auth.dto';
import { UserProfileResponse } from '../../user/vo';

@ApiTags('Auth - 认证模块')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * 用户注册
   */
  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '用户注册' })
  @ApiResponse({ status: 201, description: '注册成功' })
  async register(@Body() dto: UserRegisterDto): Promise<void> {
    await this.authService.register(dto);
  }

  /**
   * 用户登录
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({ status: 200, description: '登录成功，返回访问令牌' })
  async login(@Body() dto: UserLoginDto, @Req() req: FastifyRequest) {
    return this.authService.login(dto, req);
  }

  /**
   * 刷新令牌
   */
  @Post('token/refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新访问令牌' })
  @ApiResponse({ status: 200, description: '返回新的访问令牌' })
  async refreshToken(@Body() dto: RefreshTokenDto, @Req() req: FastifyRequest) {
    return this.authService.refreshToken(dto.refreshToken, req);
  }

  /**
   * 登出
   */
  @Post('logout')
  @ApiSecurityAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登出' })
  @ApiResponse({ status: 200, description: '登出成功' })
  async logout(@AuthUser() user: IAuthUser, @Req() req: FastifyRequest): Promise<void> {
    await this.authService.logout(user, req);
  }

  /**
   * 获取当前登录用户信息
   */
  @Get('me')
  @ApiSecurityAuth()
  @ApiOperation({ summary: '获取当前登录用户信息' })
  @ApiResponse({ status: 200, type: UserProfileResponse })
  async getCurrentUser(@AuthUser() user: IAuthUser) {
    return this.authService.getCurrentUser(user);
  }
}
