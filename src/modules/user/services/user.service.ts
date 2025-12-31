import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isNil } from 'lodash';
import { Repository } from 'typeorm';
import type { FastifyRequest } from 'fastify';
import { UserEntity } from '@/entities/user.entity';
import { UserRegisterDto } from '../dto/user.dto';
import { 
  UserProfileResponse, 
  UserBasicResponse,
  maskPhone 
} from '../model';
import { CacheService } from '@/shared/cache/cache.service';
import * as bcrypt from 'bcrypt';
import { UserStatus, ErrorCode } from '@/constants';
import { getClientIp, md5 } from '@/utils';
import { BusinessException } from '@/common/exceptions/biz.exception';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly CACHE_PREFIX = 'user:';
  private readonly CACHE_TTL = 3600000; // 1小时

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * 将UserEntity转换为UserBasicResponse
   */
  private toBasicResponse(user: UserEntity): UserBasicResponse {
    return new UserBasicResponse({
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
      status: user.status,
    });
  }

  /**
   * 将UserEntity转换为UserProfileResponse
   */
  private toProfileResponse(user: UserEntity): UserProfileResponse {
    return new UserProfileResponse({
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
      email: user.email,
      phone: user.phone ? maskPhone(user.phone) : undefined,
      gender: user.gender,
      createdAt: user.createdAt,
      loginTime: user.loginTime,
    });
  }

  /**
   * 根据 ID 查找用户
   */
  async findUserById(id: number): Promise<UserEntity | null> {
    const cacheKey = `${this.CACHE_PREFIX}${id}`;

    // 从缓存获取
    let user = await this.cacheService.get<UserEntity>(cacheKey);

    if (!user) {
      user = await this.userRepository.findOne({
        where: {
          id,
          status: UserStatus.Enabled,
        },
      });

      if (user) {
        await this.cacheService.set(cacheKey, user, { ttl: this.CACHE_TTL });
      }
    }

    return user || null;
  }

  /**
   * 获取用户基本信息（公开展示用）
   */
  async getUserBasicInfo(id: number): Promise<UserBasicResponse | null> {
    const user = await this.findUserById(id);
    return user ? this.toBasicResponse(user) : null;
  }

  /**
   * 获取用户个人资料信息
   */
  async getUserProfile(id: number): Promise<UserProfileResponse | null> {
    const user = await this.findUserById(id);
    return user ? this.toProfileResponse(user) : null;
  }

  /**
   * 根据用户名查找用户（用于登录验证）
   */
  async findUserByUserName(username: string): Promise<UserEntity | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .where({
        username,
        status: UserStatus.Enabled,
      })
      .getOne();
  }

  /**
   * 用户注册
   */
  async createUser(
    dto: UserRegisterDto,
  ): Promise<UserBasicResponse> {
    // 检查用户名是否已存在
    const exists = await this.userRepository.findOne({
      where: { username: dto.username },
    });

    if (exists) {
      throw new BusinessException(ErrorCode.ErrUserExisted);
    }

    // 密码哈希
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 从 dto 中排除 confirmPassword 字段
    const { confirmPassword, ...userDto } = dto;

    // 创建用户
    const user = this.userRepository.create({
      ...userDto,
      password: hashedPassword,
      status: UserStatus.Enabled,
    });

    const savedUser = await this.userRepository.save(user);

    // 返回格式化的用户数据
    return new UserBasicResponse({
      id: savedUser.id,
      username: savedUser.username,
      nickname: savedUser.nickname,
      avatar: savedUser.avatar,
    });
  }

  /**
   * 验证用户密码（用于登录）
   */
  async verifyPassword(
    username: string,
    password: string,
  ): Promise<UserEntity | null> {
    const user = await this.findUserByUserName(username);
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return null;
    }

    // 使用白名单模式，只返回必要字段，避免敏感信息泄露
    const safeUser = new UserEntity();
    safeUser.id = user.id;
    safeUser.username = user.username;
    safeUser.nickname = user.nickname;
    safeUser.avatar = user.avatar;
    safeUser.status = user.status;
    safeUser.email = user.email;
    safeUser.phone = user.phone;
    safeUser.gender = user.gender;
    safeUser.loginTime = user.loginTime;
    safeUser.createdAt = user.createdAt;
    
    return safeUser;
  }

  /**
   * 验证用户登录并返回登录响应模型
   */
  async verifyLogin(
    username: string,
    password: string,
  ): Promise<UserBasicResponse | null> {
    const user = await this.verifyPassword(username, password);
    return user ? this.toBasicResponse(user) : null;
  }

  /**
   * 更新用户信息
   */
  async updateUser(id: number, updates: Partial<UserEntity>): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new BusinessException(ErrorCode.ErrUserNotFound);
    }

    // 禁止直接修改密码和敏感字段
    const { 
      email,
      phone,
      password, 
      status, 
      username, 
      loginIp, 
      loginTime, 
      lastToken,
      createdAt,
      updatedAt,
      id: userId,
      ...safeUpdates 
    } = updates;

    if (Object.keys(safeUpdates).length === 0) {
      return;
    }

    await this.userRepository.update(id, safeUpdates);
    await this.clearUserCache(id);
  }

  /**
   * 清除用户缓存
   * @private
   */
  private async clearUserCache(id: number): Promise<void> {
    await this.cacheService.del(`${this.CACHE_PREFIX}${id}`);
  }

  /**
   * 删除用户（软删除）
   */
  async deleteUser(id: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new BusinessException(ErrorCode.ErrUserNotFound);
    }

    await this.userRepository.softDelete(id);
    await this.clearUserCache(id);
    
    this.logger.warn(`User ${id} account deleted`);
  }

  /**
   * 恢复软删除的用户
   */
  async restoreUser(id: number): Promise<void> {
    const result = await this.userRepository.restore(id);
    
    if (result.affected === 0) {
      throw new BusinessException(ErrorCode.ErrUserNotDeleted);
    }

    await this.clearUserCache(id);
    this.logger.log(`User ${id} account restored`);
  }

  /**
   * 修改用户密码
   */
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<void> {
    // 验证新密码和确认密码是否一致
    if (newPassword !== confirmPassword) {
      throw new BusinessException(ErrorCode.ErrPasswordConfirmNotMatch);
    }

    // 获取用户信息（包括密码）
    const user = await this.findUserById(userId);
    if (!user) {
      throw new BusinessException(ErrorCode.ErrUserNotFound);
    }

    // 验证当前密码
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new BusinessException(ErrorCode.ErrPasswordNotMatch);
    }

    // 检查新密码是否与当前密码相同
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new BusinessException(ErrorCode.ErrPasswordSame);
    }

    // 加密新密码
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await this.userRepository.update(userId, {
      password: hashedNewPassword,
    });

    await this.clearUserCache(userId);
    this.logger.log(`User ${userId} password changed`);
  }

  /**
   * 设置提现密码
   */
  async setTransferPassword(
    userId: number,
    password: string,
    confirmPassword: string,
  ): Promise<void> {
    // 验证密码和确认密码是否一致
    if (password !== confirmPassword) {
      throw new BusinessException(ErrorCode.ErrPasswordConfirmNotMatch);
    }

    // 获取用户信息
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'transPassword'],
    });

    if (!user) {
      throw new BusinessException(ErrorCode.ErrUserNotFound);
    }

    // 检查是否已设置交易密码
    if (user.transPassword) {
      throw new BusinessException(ErrorCode.ErrTransPasswordAlreadySet);
    }

    // 加密提现密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 更新交易密码
    await this.userRepository.update(userId, {
      transPassword: hashedPassword,
    });

    await this.clearUserCache(userId);
    this.logger.log(`User ${userId} transaction password set`);
  }

  /**
   * 修改提现密码
   */
  async changeTransferPassword(
    userId: number,
    oldPassword: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<void> {
    // 验证新密码和确认密码是否一致
    if (newPassword !== confirmPassword) {
      throw new BusinessException(ErrorCode.ErrPasswordConfirmNotMatch);
    }

    // 获取用户信息（包括交易密码）
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'transPassword'],
    });

    if (!user) {
      throw new BusinessException(ErrorCode.ErrUserNotFound);
    }

    if (!user.transPassword) {
      throw new BusinessException(ErrorCode.ErrTransPasswordNotSet);
    }

    // 验证当前交易密码
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.transPassword);
    if (!isOldPasswordValid) {
      throw new BusinessException(ErrorCode.ErrTransPasswordNotMatch);
    }

    // 检查新密码是否与当前密码相同
    const isSamePassword = await bcrypt.compare(newPassword, user.transPassword);
    if (isSamePassword) {
      throw new BusinessException(ErrorCode.ErrPasswordSame);
    }

    // 加密新交易密码
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // 更新交易密码
    await this.userRepository.update(userId, {
      transPassword: hashedNewPassword,
    });

    await this.clearUserCache(userId);
    this.logger.log(`User ${userId} transaction password changed`);
  }

  /**
   * 验证用户的交易密码
   * @param userId 用户ID
   * @param password 待验证的交易密码
   */
  async verifyTransferPassword(userId: number, password: string): Promise<void> {
    // 获取用户信息（包括交易密码）
    const user = await this.findUserById(userId);
    if (!user) {
      throw new BusinessException(ErrorCode.ErrUserNotFound);
    }

    if (!user.transPassword) {
      throw new BusinessException(ErrorCode.ErrTransPasswordNotSet);
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.transPassword);
    if (!isPasswordValid) {
      throw new BusinessException(ErrorCode.ErrTransPasswordNotMatch);
    }
  }

  /**
   * 判断用户名是否存在
   */
  async exist(username: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: {
        username,
        status: UserStatus.Enabled,
      },
    });
    return !isNil(user);
  }

  /**
   * 更新用户登录信息
   */
  async updateLoginInfo(userId: number, req: FastifyRequest): Promise<void> {
    const loginIp = getClientIp(req);
    
    await this.userRepository.update(userId, {
      loginIp,
      loginTime: new Date(),
      lastToken: md5(req.accessToken)
    });

    await this.clearUserCache(userId);
  }
}
