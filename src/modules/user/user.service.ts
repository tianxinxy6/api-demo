import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isNil } from 'lodash';
import { Repository } from 'typeorm';
import { UserStatus } from './constant';
import { UserEntity } from '@/entities/user.entity';
import { UserRegisterDto } from './dto';
import { CacheService } from '@/shared/cache/cache.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  private readonly CACHE_PREFIX = 'user:';
  private readonly CACHE_TTL = 3600000; // 1小时

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly cacheService: CacheService,
  ) {}

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
        select: ['id', 'username', 'nickname', 'email', 'avatar', 'gender', 'phone', 'loginIp', 'loginTime', 'createdAt', 'updatedAt'],
      });

      if (user) {
        await this.cacheService.set(cacheKey, user, { ttl: this.CACHE_TTL });
      }
    }

    return user || null;
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
      .select(['user.id', 'user.username', 'user.password', 'user.status', 'user.createdAt'])
      .getOne();
  }

  /**
   * 用户注册
   */
  async createUser(dto: UserRegisterDto): Promise<Omit<UserEntity, 'password'>> {
    // 检查用户名是否已存在
    const exists = await this.userRepository.findOne({
      where: { username: dto.username },
    });

    if (exists) {
      throw new ConflictException('用户名已存在');
    }

    // 密码哈希
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 创建用户
    const user = this.userRepository.create({
      ...dto,
      password: hashedPassword,
      status: UserStatus.Enabled,
    });

    const savedUser = await this.userRepository.save(user);

    // 移除敏感信息
    const { password, ...result } = savedUser;
    return result;
  }

  /**
   * 验证用户密码（用于登录）
   */
  async verifyPassword(username: string, password: string): Promise<Omit<UserEntity, 'password'> | null> {
    const user = await this.findUserByUserName(username);
    
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return null;
    }

    // 移除密码字段返回
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * 更新用户信息
   */
  async updateUser(id: number, updates: Partial<UserEntity>): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    
    if (!user) {
      throw new NotFoundException(`用户不存在: ${id}`);
    }

    // 清除缓存
    await this.cacheService.del(`${this.CACHE_PREFIX}${id}`);

    // 禁止直接修改密码和敏感字段
    const { password, status, ...safeUpdates } = updates;
    
    await this.userRepository.update(id, safeUpdates);
  }

  /**
   * 删除用户（软删除 - 标记为禁用）
   */
  async deleteUser(id: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    
    if (!user) {
      throw new NotFoundException(`用户不存在: ${id}`);
    }

    // 清除缓存
    await this.cacheService.del(`${this.CACHE_PREFIX}${id}`);

    // 软删除 - 标记为禁用
    await this.userRepository.update(id, { status: UserStatus.Disable });
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
}
