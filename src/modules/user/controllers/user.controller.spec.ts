import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from '../services/user.service';
import { ChangePasswordDto, UpdateUserDto, SetPasswordDto } from '../dto/user.dto';
import { UserProfileResponse } from '../vo';
import type { FastifyRequest } from 'fastify';

describe('UserController', () => {
  let controller: UserController;
  let userService: UserService;

  const mockUserService = {
    getUserProfile: jest.fn(),
    updateUser: jest.fn(),
    changePassword: jest.fn(),
    setTransferPassword: jest.fn(),
    changeTransferPassword: jest.fn(),
    deleteUser: jest.fn(),
  };

  const mockUser: IAuthUser = {
    uid: 1,
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
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);

    jest.clearAllMocks();
  });

  it('应该被正确定义', () => {
    expect(controller).toBeDefined();
  });

  describe('getCurrentUserInfo', () => {
    it('应该返回当前用户信息', async () => {
      const userProfile: UserProfileResponse = {
        id: 1,
        username: 'testuser',
        nickname: 'Test User',
        avatar: null,
        status: 1,
        email: null,
        phone: null,
        gender: 0,
        createdAt: '2025-12-20 15:00:00',
        loginTime: '2025-12-20 16:00:00',
      };

      mockUserService.getUserProfile.mockResolvedValue(userProfile);

      const result = await controller.getCurrentUserInfo(mockUser);

      expect(result).toEqual(userProfile);
      expect(mockUserService.getUserProfile).toHaveBeenCalledWith(mockUser.uid);
      expect(mockUserService.getUserProfile).toHaveBeenCalledTimes(1);
    });

    it('当用户不存在时应该返回 null', async () => {
      mockUserService.getUserProfile.mockResolvedValue(null);

      const result = await controller.getCurrentUserInfo(mockUser);

      expect(result).toBeNull();
      expect(mockUserService.getUserProfile).toHaveBeenCalledWith(mockUser.uid);
    });
  });

  describe('updateCurrentUser', () => {
    it('应该成功更新用户信息', async () => {
      const updateDto: UpdateUserDto = {
        nickname: 'New Nickname',
        avatar: 'https://example.com/avatar.jpg',
      };

      mockUserService.updateUser.mockResolvedValue(undefined);

      await controller.updateCurrentUser(mockUser, updateDto);

      expect(mockUserService.updateUser).toHaveBeenCalledWith(mockUser.uid, updateDto);
      expect(mockUserService.updateUser).toHaveBeenCalledTimes(1);
    });

    it('应该正确传递更新错误', async () => {
      const updateDto: UpdateUserDto = {
        nickname: 'New Nickname',
      };
      const error = new Error('Update failed');

      mockUserService.updateUser.mockRejectedValue(error);

      await expect(controller.updateCurrentUser(mockUser, updateDto)).rejects.toThrow(error);
      expect(mockUserService.updateUser).toHaveBeenCalledWith(mockUser.uid, updateDto);
    });
  });

  describe('changePassword', () => {
    it('应该成功修改登录密码', async () => {
      const changePasswordDto: ChangePasswordDto = {
        oldPassword: 'oldPassword123',
        newPassword: 'newPassword123',
        confirmPassword: 'newPassword123',
      };

      mockUserService.changePassword.mockResolvedValue(undefined);

      await controller.changePassword(mockUser, changePasswordDto);

      expect(mockUserService.changePassword).toHaveBeenCalledWith(
        mockUser.uid,
        changePasswordDto.oldPassword,
        changePasswordDto.newPassword,
        changePasswordDto.confirmPassword,
      );
      expect(mockUserService.changePassword).toHaveBeenCalledTimes(1);
    });

    it('应该正确传递密码修改错误', async () => {
      const changePasswordDto: ChangePasswordDto = {
        oldPassword: 'wrongPassword',
        newPassword: 'newPassword123',
        confirmPassword: 'newPassword123',
      };
      const error = new Error('Password incorrect');

      mockUserService.changePassword.mockRejectedValue(error);

      await expect(controller.changePassword(mockUser, changePasswordDto)).rejects.toThrow(error);
    });
  });

  describe('setTransferPassword', () => {
    it('应该成功设置交易密码', async () => {
      const setPasswordDto: SetPasswordDto = {
        password: 'transPassword123',
        confirmPassword: 'transPassword123',
      };

      mockUserService.setTransferPassword.mockResolvedValue(undefined);

      await controller.setTransferPassword(mockUser, setPasswordDto);

      expect(mockUserService.setTransferPassword).toHaveBeenCalledWith(
        mockUser.uid,
        setPasswordDto.password,
        setPasswordDto.confirmPassword,
      );
      expect(mockUserService.setTransferPassword).toHaveBeenCalledTimes(1);
    });

    it('应该正确传递交易密码设置错误', async () => {
      const setPasswordDto: SetPasswordDto = {
        password: 'transPassword123',
        confirmPassword: 'transPassword123',
      };
      const error = new Error('Password already set');

      mockUserService.setTransferPassword.mockRejectedValue(error);

      await expect(controller.setTransferPassword(mockUser, setPasswordDto)).rejects.toThrow(error);
    });
  });

  describe('changeTransferPassword', () => {
    it('应该成功修改交易密码', async () => {
      const changePasswordDto: ChangePasswordDto = {
        oldPassword: 'oldTransPwd123',
        newPassword: 'newTransPwd123',
        confirmPassword: 'newTransPwd123',
      };

      mockUserService.changeTransferPassword.mockResolvedValue(undefined);

      await controller.changeTransferPassword(mockUser, changePasswordDto);

      expect(mockUserService.changeTransferPassword).toHaveBeenCalledWith(
        mockUser.uid,
        changePasswordDto.oldPassword,
        changePasswordDto.newPassword,
        changePasswordDto.confirmPassword,
      );
      expect(mockUserService.changeTransferPassword).toHaveBeenCalledTimes(1);
    });

    it('应该正确传递交易密码修改错误', async () => {
      const changePasswordDto: ChangePasswordDto = {
        oldPassword: 'wrongPwd',
        newPassword: 'newTransPwd123',
        confirmPassword: 'newTransPwd123',
      };
      const error = new Error('Transaction password incorrect');

      mockUserService.changeTransferPassword.mockRejectedValue(error);

      await expect(controller.changeTransferPassword(mockUser, changePasswordDto)).rejects.toThrow(
        error,
      );
    });
  });

  describe('deactivateAccount', () => {
    it('应该成功注销账户', async () => {
      mockUserService.deleteUser.mockResolvedValue(undefined);

      await controller.deactivateAccount(mockUser, mockRequest);

      expect(mockUserService.deleteUser).toHaveBeenCalledWith(mockUser.uid, mockRequest);
      expect(mockUserService.deleteUser).toHaveBeenCalledTimes(1);
    });

    it('应该正确传递注销错误', async () => {
      const error = new Error('Delete failed');

      mockUserService.deleteUser.mockRejectedValue(error);

      await expect(controller.deactivateAccount(mockUser, mockRequest)).rejects.toThrow(error);
      expect(mockUserService.deleteUser).toHaveBeenCalledWith(mockUser.uid, mockRequest);
    });
  });
});
