import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { ApiSecurityAuth } from '@/common/decorators/swagger.decorator';
import { AuthUser } from '@/common/decorators/auth-user.decorator';
import { UserService } from '../services/user.service';
import { UserProfileResponse } from '../model';
import { ChangePasswordDto, UpdateUserDto } from '../dto/user.dto';

@ApiTags('User - 用户管理')
@ApiSecurityAuth()
@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  /**
   * 获取当前登录用户信息
   */
  @Get('me')
  @ApiOperation({ summary: '获取当前登录用户信息' })
  @ApiResponse({ type: UserProfileResponse, description: '当前用户的详细信息' })
  async getCurrentUserInfo(@AuthUser() user: IAuthUser): Promise<UserProfileResponse | null> {
    return this.userService.getUserProfile(user.uid);
  }

  /**
   * 更新当前用户信息
   */
  @Put('edit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新当前用户信息' })
  @ApiResponse({ status: 200, description: '更新成功', type: UserProfileResponse })
  async updateCurrentUser(
    @AuthUser() user: IAuthUser,
    @Body() updates: UpdateUserDto,
  ): Promise<UserProfileResponse | null> {
    await this.userService.updateUser(user.uid, updates);
    return;
  }

  /**
   * 修改密码
   */
  @Post('edit-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '修改密码' })
  @ApiResponse({ status: 200, description: '密码修改成功' })
  async changePassword(
    @AuthUser() user: IAuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.userService.changePassword(
      user.uid,
      dto.oldPassword,
      dto.newPassword,
      dto.confirmPassword,
    );

    return;
  }

  /**
   * 注销账户
   */
  @Delete('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '注销账户' })
  @ApiResponse({ status: 200, description: '账户注销成功' })
  async deactivateAccount(
    @AuthUser() user: IAuthUser,
  ) {
    await this.userService.deleteUser(user.uid);
    return;
  }
}
