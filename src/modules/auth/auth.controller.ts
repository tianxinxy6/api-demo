import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UnauthorizedException } from '@nestjs/common';

import { ApiSecurityAuth } from '@/common/decorators/swagger.decorator';
import { Public } from './decorators/public.decorator';
import { AuthUser } from './decorators/auth-user.decorator';
import { UserService } from '../user/user.service';
import { TokenService } from './services/token.service';
import { UserRegisterDto, UserLoginDto } from '../user/dto';
import { UserEntity } from '@/entities/user.entity';

@ApiTags('Auth - 认证模块')
@Controller('auth')
export class AuthController {
  constructor(
    private userService: UserService,
    private tokenService: TokenService,
  ) {}

  /**
   * 用户注册
   */
  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '用户注册' })
  @ApiResponse({ status: 201, description: '注册成功，返回访问令牌' })
  async register(@Body() dto: UserRegisterDto) {
    const user = await this.userService.createUser(dto);
    const token = await this.tokenService.sign({ uid: user.id, pv: 1 });
    
    return {
      user,
      accessToken: token,
    };
  }

  /**
   * 用户登录
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({ description: '登录成功，返回访问令牌' })
  async login(@Body() dto: UserLoginDto) {
    const user = await this.userService.verifyPassword(dto.username, dto.password);
    
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const token = await this.tokenService.sign({ uid: user.id, pv: 1 });
    
    return {
      user: { id: user.id, username: user.username, nickname: user.nickname },
      accessToken: token,
    };
  }

  /**
   * 刷新 Token
   */
  @Post('refresh')
  @ApiSecurityAuth()
  @ApiOperation({ summary: '刷新访问令牌' })
  @ApiResponse({ description: '返回新的访问令牌' })
  async refreshToken(@AuthUser() user: IAuthUser) {
    const userInfo = await this.userService.findUserById(user.uid);
    
    if (!userInfo) {
      throw new UnauthorizedException('用户不存在');
    }

    const newToken = await this.tokenService.sign({ uid: user.uid, pv: 1 });
    
    return {
      accessToken: newToken,
    };
  }

  /**
   * 获取当前登录用户信息
   */
  @Get('me')
  @ApiSecurityAuth()
  @ApiOperation({ summary: '获取当前登录用户信息' })
  @ApiResponse({ type: UserEntity, description: '返回当前登录用户信息' })
  async getCurrentUser(@AuthUser() user: IAuthUser) {
    const userInfo = await this.userService.findUserById(user.uid);
    
    if (!userInfo) {
      throw new UnauthorizedException('用户不存在');
    }

    return userInfo;
  }

  /**
   * 用户登出
   */
  @Post('logout')
  @ApiSecurityAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '用户登出' })
  @ApiResponse({ status: 204, description: '登出成功' })
  async logout(@AuthUser() user: IAuthUser) {
    // 可选: 将 token 加入黑名单或清除用户会话
    // 这里只是简单的登出响应
    return;
  }
}
