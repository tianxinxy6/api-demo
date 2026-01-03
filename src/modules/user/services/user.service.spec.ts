import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { UserEntity } from '@/entities/user.entity';
import { CacheService } from '@/shared/cache/cache.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { UserRegisterDto } from '../dto/user.dto';
import { UserStatus, ErrorCode } from '@/constants';
import { BusinessException } from '@/common/exceptions/biz.exception';
import type { FastifyRequest } from 'fastify';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');

describe('UserService', () => {
  let service: UserService;
  let repository: Repository<UserEntity>;
  let cacheService: CacheService;
  let tokenBlacklistService: TokenBlacklistService;

  const mockRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockTokenBlacklistService = {
    revokeToken: jest.fn(),
  };

  const mockUser: Partial<UserEntity> = {
    id: 1,
    username: 'testuser',
    password: '$2b$10$hashedPassword',
    nickname: 'Test User',
    avatar: null,
    status: UserStatus.Enabled,
    email: null,
    phone: null,
    gender: 0,
    transPassword: null,
    createdAt: new Date('2025-12-20'),
    loginTime: new Date('2025-12-20'),
  };

  const mockRequest = {
    headers: {
      'user-agent': 'Mozilla/5.0',
    },
    ip: '127.0.0.1',
    accessToken: 'mock-access-token',
  } as unknown as FastifyRequest;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: TokenBlacklistService,
          useValue: mockTokenBlacklistService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));
    cacheService = module.get<CacheService>(CacheService);
    tokenBlacklistService = module.get<TokenBlacklistService>(TokenBlacklistService);

    jest.clearAllMocks();
  });

  it('应该被正确定义', () => {
    expect(service).toBeDefined();
  });

  describe('findUserById', () => {
    it('应该从缓存中获取用户', async () => {
      mockCacheService.get.mockResolvedValue(mockUser);

      const result = await service.findUserById(1);

      expect(result).toEqual(mockUser);
      expect(mockCacheService.get).toHaveBeenCalledWith('user:1');
      expect(mockRepository.findOne).not.toHaveBeenCalled();
    });

    it('当缓存未命中时应该从数据库获取并缓存', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.findUserById(1);

      expect(result).toEqual(mockUser);
      expect(mockCacheService.get).toHaveBeenCalledWith('user:1');
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, status: UserStatus.Enabled },
      });
      expect(mockCacheService.set).toHaveBeenCalledWith('user:1', mockUser, { ttl: 3600000 });
    });

    it('当用户不存在时应该返回 null', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findUserById(999);

      expect(result).toBeNull();
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('createUser', () => {
    it('应该成功创建用户', async () => {
      const registerDto: UserRegisterDto = {
        username: 'newuser',
        password: 'password123',
        confirmPassword: 'password123',
        nickname: 'New User',
      };

      mockRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashedNewPassword');
      mockRepository.create.mockReturnValue({ ...mockUser, username: 'newuser' });
      mockRepository.save.mockResolvedValue({ ...mockUser, id: 2, username: 'newuser' });

      const result = await service.createUser(registerDto);

      expect(result).toBeDefined();
      expect(result.id).toBe(2);
      expect(result.username).toBe('newuser');
      expect(result.nickname).toBe('Test User');
      expect(result.avatar).toBeNull();
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { username: 'newuser' } });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('当用户名已存在时应该抛出错误', async () => {
      const registerDto: UserRegisterDto = {
        username: 'existinguser',
        password: 'password123',
        confirmPassword: 'password123',
      };

      mockRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.createUser(registerDto)).rejects.toThrow(
        new BusinessException(ErrorCode.ErrUserExisted),
      );
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('verifyLogin', () => {
    it('应该成功验证用户登录', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.verifyLogin('testuser', 'password123');

      expect(result).toBeDefined();
      expect(result?.username).toBe('testuser');
      expect(queryBuilder.where).toHaveBeenCalledWith({
        username: 'testuser',
        status: UserStatus.Enabled,
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', mockUser.password);
    });

    it('当用户名不存在时应该返回 null', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.verifyLogin('nonexistent', 'password123');

      expect(result).toBeNull();
    });

    it('当密码错误时应该返回 null', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.verifyLogin('testuser', 'wrongpassword');

      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', mockUser.password);
    });
  });

  describe('updateUser', () => {
    it('应该成功更新用户信息', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockCacheService.del.mockResolvedValue(undefined);

      await service.updateUser(1, { nickname: 'Updated Name', avatar: 'new-avatar.jpg' });

      expect(mockRepository.update).toHaveBeenCalledWith(1, {
        nickname: 'Updated Name',
        avatar: 'new-avatar.jpg',
      });
      expect(mockCacheService.del).toHaveBeenCalledWith('user:1');
    });

    it('当用户不存在时应该抛出错误', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.updateUser(999, { nickname: 'New Name' })).rejects.toThrow(
        new BusinessException(ErrorCode.ErrUserNotFound),
      );
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('应该过滤敏感字段不允许更新', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockCacheService.del.mockResolvedValue(undefined);

      await service.updateUser(1, {
        nickname: 'New Name',
        password: 'should-be-filtered',
        username: 'should-be-filtered',
      } as any);

      expect(mockRepository.update).toHaveBeenCalledWith(1, { nickname: 'New Name' });
    });

    it('当没有有效更新字段时应该直接返回', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      await service.updateUser(1, { password: 'filtered' } as any);

      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    it('应该成功软删除用户并撤销令牌', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.softDelete.mockResolvedValue({ affected: 1 });
      mockCacheService.del.mockResolvedValue(undefined);
      mockTokenBlacklistService.revokeToken.mockResolvedValue(undefined);

      await service.deleteUser(1, mockRequest);

      expect(mockRepository.softDelete).toHaveBeenCalledWith(1);
      expect(mockCacheService.del).toHaveBeenCalledWith('user:1');
      expect(mockTokenBlacklistService.revokeToken).toHaveBeenCalledWith('mock-access-token', 1);
    });

    it('当用户不存在时应该抛出错误', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteUser(999, mockRequest)).rejects.toThrow(
        new BusinessException(ErrorCode.ErrUserNotFound),
      );
      expect(mockRepository.softDelete).not.toHaveBeenCalled();
    });

    it('当没有 accessToken 时应该跳过令牌撤销', async () => {
      const requestWithoutToken = { ...mockRequest, accessToken: undefined };
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.softDelete.mockResolvedValue({ affected: 1 });
      mockCacheService.del.mockResolvedValue(undefined);

      await service.deleteUser(1, requestWithoutToken as FastifyRequest);

      expect(mockTokenBlacklistService.revokeToken).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('应该成功修改密码', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // 验证当前密码
        .mockResolvedValueOnce(false); // 检查新密码与旧密码不同
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$newHashedPassword');
      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockCacheService.del.mockResolvedValue(undefined);

      await service.changePassword(1, 'oldPassword', 'newPassword', 'newPassword');

      expect(bcrypt.compare).toHaveBeenCalledWith('oldPassword', mockUser.password);
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword', 10);
      expect(mockRepository.update).toHaveBeenCalledWith(1, {
        password: '$2b$10$newHashedPassword',
      });
      expect(mockCacheService.del).toHaveBeenCalledWith('user:1');
    });

    it('当新密码和确认密码不一致时应该抛出错误', async () => {
      await expect(
        service.changePassword(1, 'oldPassword', 'newPassword', 'differentPassword'),
      ).rejects.toThrow(new BusinessException(ErrorCode.ErrPasswordConfirmNotMatch));
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('当当前密码错误时应该抛出错误', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(1, 'wrongPassword', 'newPassword', 'newPassword'),
      ).rejects.toThrow(new BusinessException(ErrorCode.ErrPasswordNotMatch));
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('当新密码与当前密码相同时应该抛出错误', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // 验证当前密码
        .mockResolvedValueOnce(true); // 检查新密码与旧密码相同

      await expect(
        service.changePassword(1, 'samePassword', 'samePassword', 'samePassword'),
      ).rejects.toThrow(new BusinessException(ErrorCode.ErrPasswordSame));
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('setTransferPassword', () => {
    it('应该成功设置交易密码', async () => {
      const userWithoutTransPwd = { ...mockUser, transPassword: null };
      mockRepository.findOne.mockResolvedValue(userWithoutTransPwd);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashedTransPassword');
      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockCacheService.del.mockResolvedValue(undefined);

      await service.setTransferPassword(1, 'transPwd123', 'transPwd123');

      expect(bcrypt.hash).toHaveBeenCalledWith('transPwd123', 10);
      expect(mockRepository.update).toHaveBeenCalledWith(1, {
        transPassword: '$2b$10$hashedTransPassword',
      });
      expect(mockCacheService.del).toHaveBeenCalledWith('user:1');
    });

    it('当密码和确认密码不一致时应该抛出错误', async () => {
      await expect(service.setTransferPassword(1, 'transPwd123', 'differentPwd')).rejects.toThrow(
        new BusinessException(ErrorCode.ErrPasswordConfirmNotMatch),
      );
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('当交易密码已设置时应该抛出错误', async () => {
      const userWithTransPwd = { ...mockUser, transPassword: '$2b$10$existingTransPwd' };
      mockRepository.findOne.mockResolvedValue(userWithTransPwd);

      await expect(service.setTransferPassword(1, 'transPwd123', 'transPwd123')).rejects.toThrow(
        new BusinessException(ErrorCode.ErrTransPasswordAlreadySet),
      );
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('changeTransferPassword', () => {
    it('应该成功修改交易密码', async () => {
      const userWithTransPwd = { ...mockUser, transPassword: '$2b$10$oldTransPwd' };
      mockRepository.findOne.mockResolvedValue(userWithTransPwd);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // 验证旧密码
        .mockResolvedValueOnce(false); // 检查新密码与旧密码不同
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$newTransPwd');
      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockCacheService.del.mockResolvedValue(undefined);

      await service.changeTransferPassword(1, 'oldTransPwd', 'newTransPwd', 'newTransPwd');

      expect(bcrypt.compare).toHaveBeenCalledWith('oldTransPwd', '$2b$10$oldTransPwd');
      expect(bcrypt.hash).toHaveBeenCalledWith('newTransPwd', 10);
      expect(mockRepository.update).toHaveBeenCalledWith(1, {
        transPassword: '$2b$10$newTransPwd',
      });
    });

    it('当交易密码未设置时应该抛出错误', async () => {
      const userWithoutTransPwd = { ...mockUser, transPassword: null };
      mockRepository.findOne.mockResolvedValue(userWithoutTransPwd);

      await expect(service.changeTransferPassword(1, 'oldPwd', 'newPwd', 'newPwd')).rejects.toThrow(
        new BusinessException(ErrorCode.ErrTransPasswordNotSet),
      );
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('当旧交易密码错误时应该抛出错误', async () => {
      const userWithTransPwd = { ...mockUser, transPassword: '$2b$10$oldTransPwd' };
      mockRepository.findOne.mockResolvedValue(userWithTransPwd);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changeTransferPassword(1, 'wrongPwd', 'newPwd', 'newPwd'),
      ).rejects.toThrow(new BusinessException(ErrorCode.ErrTransPasswordNotMatch));
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('verifyTransferPassword', () => {
    it('应该成功验证交易密码', async () => {
      const userWithTransPwd = { ...mockUser, transPassword: '$2b$10$transPwd' };
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(userWithTransPwd);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.verifyTransferPassword(1, 'correctPwd')).resolves.not.toThrow();
      expect(bcrypt.compare).toHaveBeenCalledWith('correctPwd', '$2b$10$transPwd');
    });

    it('当交易密码未设置时应该抛出错误', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.verifyTransferPassword(1, 'anyPwd')).rejects.toThrow(
        new BusinessException(ErrorCode.ErrTransPasswordNotSet),
      );
    });

    it('当交易密码错误时应该抛出错误', async () => {
      const userWithTransPwd = { ...mockUser, transPassword: '$2b$10$transPwd' };
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(userWithTransPwd);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.verifyTransferPassword(1, 'wrongPwd')).rejects.toThrow(
        new BusinessException(ErrorCode.ErrTransPasswordNotMatch),
      );
    });
  });

  describe('updateLoginInfo', () => {
    it('应该成功更新登录信息', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockCacheService.del.mockResolvedValue(undefined);

      await service.updateLoginInfo(1, mockRequest, 'access-token');

      expect(mockRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          loginIp: '127.0.0.1',
          loginTime: expect.any(Date),
          lastToken: expect.any(String),
        }),
      );
      expect(mockCacheService.del).toHaveBeenCalledWith('user:1');
    });
  });
});
