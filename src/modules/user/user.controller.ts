import { Controller, Get, Post, Body, Param, Put, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { ApiSecurityAuth } from '@/common/decorators/swagger.decorator';
import { Public } from '@/modules/auth/decorators/public.decorator';
import { UserService } from './user.service';
import { UserEntity } from '@/entities/user.entity';

@ApiTags('User - 用户管理')
@ApiSecurityAuth()
@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  /**
   * 获取用户信息
   */
  @Get(':id')
  @ApiOperation({ summary: '获取用户信息' })
  @ApiResponse({ type: UserEntity, description: '用户信息' })
  async getUser(@Param('id') id: number): Promise<UserEntity | null> {
    return this.userService.findUserById(id);
  }

  /**
   * 更新用户信息
   */
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新用户信息' })
  @ApiResponse({ type: UserEntity, description: '更新后的用户信息' })
  async updateUser(@Param('id') id: number, @Body() updates: Partial<UserEntity>): Promise<UserEntity | null> {
    await this.userService.updateUser(id, updates);
    return this.userService.findUserById(id);
  }

  /**
   * 删除用户
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除用户' })
  @ApiResponse({ status: 204, description: '删除成功' })
  async deleteUser(@Param('id') id: number): Promise<void> {
    await this.userService.deleteUser(id);
  }
}
