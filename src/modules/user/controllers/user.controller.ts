import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { ApiSecurityAuth } from '@/common/decorators/swagger.decorator';
import { AuthUser } from '@/common/decorators/auth-user.decorator';
import { UserService } from '../services/user.service';
import { UserProfileResponse } from '../vo';
import { ChangePasswordDto, UpdateUserDto, SetPasswordDto } from '../dto/user.dto';
import type { FastifyRequest } from 'fastify';

@ApiTags('User - 用户管理')
@ApiSecurityAuth()
@Controller({ path: 'user', version: '1' })
export class UserController {
  constructor(private userService: UserService) {}

  /**
   * 获取当前用户信息
   */
  @Get('me')
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ type: UserProfileResponse, description: '用户详细信息' })
  async getCurrentUserInfo(@AuthUser() user: IAuthUser): Promise<UserProfileResponse | null> {
    return this.userService.getUserProfile(user.uid);
  }

  /**
   * 更新当前用户信息
   */
  @Put('edit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新当前用户信息' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async updateCurrentUser(
    @AuthUser() user: IAuthUser,
    @Body() updates: UpdateUserDto,
  ): Promise<void> {
    await this.userService.updateUser(user.uid, updates);
  }

  /**
   * 修改登录密码
   */
  @Put('password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '修改登录密码' })
  @ApiResponse({ status: 200, description: '密码修改成功' })
  async changePassword(@AuthUser() user: IAuthUser, @Body() dto: ChangePasswordDto): Promise<void> {
    await this.userService.changePassword(
      user.uid,
      dto.oldPassword,
      dto.newPassword,
      dto.confirmPassword,
    );
  }

  /**
   * 设置交易密码
   */
  @Post('trans-pwd')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '设置交易密码' })
  @ApiResponse({ status: 200, description: '交易密码设置成功' })
  async setTransferPassword(
    @AuthUser() user: IAuthUser,
    @Body() dto: SetPasswordDto,
  ): Promise<void> {
    await this.userService.setTransferPassword(user.uid, dto.password, dto.confirmPassword);
  }

  /**
   * 修改交易密码
   */
  @Put('trans-pwd')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '修改交易密码' })
  @ApiResponse({ status: 200, description: '交易密码修改成功' })
  async changeTransferPassword(
    @AuthUser() user: IAuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.userService.changeTransferPassword(
      user.uid,
      dto.oldPassword,
      dto.newPassword,
      dto.confirmPassword,
    );
  }

  /**
   * 注销账户
   */
  @Delete('del')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '注销账户' })
  @ApiResponse({ status: 200, description: '账户注销成功' })
  async deactivateAccount(@AuthUser() user: IAuthUser, @Req() req: FastifyRequest): Promise<void> {
    await this.userService.deleteUser(user.uid, req);
  }
}
