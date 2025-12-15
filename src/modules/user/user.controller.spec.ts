import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserEntity } from '@/entities/user.entity';

describe('UserController', () => {
  let controller: UserController;
  let service: UserService;

  const mockUser: UserEntity = {
    id: 1,
    username: 'testuser',
    nickname: 'Test User',
    email: 'test@example.com',
    avatar: '',
    gender: 0,
    phone: '',
    loginIp: '127.0.0.1',
    loginTime: new Date(),
    lastToken: '',
    status: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    password: 'hashed_password',
  };

  const mockUserService = {
    findUserById: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    service = module.get<UserService>(UserService);

    // 重置所有 mock
    jest.clearAllMocks();
  });

  describe('getUser', () => {
    it('should return user by id', async () => {
      const userId = 1;

      mockUserService.findUserById.mockResolvedValue(mockUser);

      const result = await controller.getUser(userId);

      expect(result).toEqual(mockUser);
      expect(service.findUserById).toHaveBeenCalledWith(userId);
    });

    it('should return null when user not found', async () => {
      const userId = 999;

      mockUserService.findUserById.mockResolvedValue(null);

      const result = await controller.getUser(userId);

      expect(result).toBeNull();
      expect(service.findUserById).toHaveBeenCalledWith(userId);
    });
  });

  describe('updateUser', () => {
    it('should successfully update user', async () => {
      const userId = 1;
      const updates = {
        nickname: 'Updated User',
        email: 'updated@example.com',
      };

      const updatedUser = { ...mockUser, ...updates };

      mockUserService.updateUser.mockResolvedValue(undefined);
      mockUserService.findUserById.mockResolvedValue(updatedUser);

      const result = await controller.updateUser(userId, updates);

      expect(result).toEqual(updatedUser);
      expect(service.updateUser).toHaveBeenCalledWith(userId, updates);
      expect(service.findUserById).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundException when user not found', async () => {
      const userId = 999;
      const updates = {
        nickname: 'Updated User',
      };

      mockUserService.updateUser.mockRejectedValue(
        new NotFoundException(`用户不存在: ${userId}`),
      );

      await expect(controller.updateUser(userId, updates)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not allow updating password directly', async () => {
      const userId = 1;
      const updates = {
        nickname: 'Updated User',
        password: 'newpassword',  // Should be ignored
      };

      mockUserService.updateUser.mockResolvedValue(undefined);
      mockUserService.findUserById.mockResolvedValue(mockUser);

      await controller.updateUser(userId, updates);

      expect(service.updateUser).toHaveBeenCalledWith(userId, updates);
    });
  });

  describe('deleteUser', () => {
    it('should successfully delete user', async () => {
      const userId = 1;

      mockUserService.deleteUser.mockResolvedValue(undefined);

      const result = await controller.deleteUser(userId);

      expect(result).toBeUndefined();
      expect(service.deleteUser).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundException when user not found', async () => {
      const userId = 999;

      mockUserService.deleteUser.mockRejectedValue(
        new NotFoundException(`用户不存在: ${userId}`),
      );

      await expect(controller.deleteUser(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
