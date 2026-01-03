import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { UserRegisterDto, UserLoginDto } from '../../user/dto/user.dto';
import { RefreshTokenDto } from '../dto/auth.dto';
import { UserProfileResponse } from '../../user/vo';
import type { FastifyRequest } from 'fastify';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    getCurrentUser: jest.fn(),
  };

  const mockRequest = {
    headers: {
      'user-agent': 'Mozilla/5.0',
    },
    ip: '127.0.0.1',
    accessToken: 'mock-access-token',
  } as unknown as FastifyRequest;

  const mockUser: IAuthUser = {
    uid: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('应该成功注册新用户', async () => {
      const registerDto: UserRegisterDto = {
        username: 'testuser',
        password: 'password123',
        confirmPassword: 'password123',
        nickname: 'Test User',
      };

      mockAuthService.register.mockResolvedValue(undefined);

      await controller.register(registerDto);

      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
      expect(mockAuthService.register).toHaveBeenCalledTimes(1);
    });

    it('应该正确传递注册错误', async () => {
      const registerDto: UserRegisterDto = {
        username: 'existinguser',
        password: 'password123',
        confirmPassword: 'password123',
      };

      const error = new Error('User already exists');
      mockAuthService.register.mockRejectedValue(error);

      await expect(controller.register(registerDto)).rejects.toThrow(error);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    it('应该成功登录并返回令牌', async () => {
      const loginDto: UserLoginDto = {
        username: 'testuser',
        password: 'password123',
      };

      const loginResult = {
        user: {
          id: 1,
          username: 'testuser',
          nickname: 'Test User',
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      mockAuthService.login.mockResolvedValue(loginResult);

      const result = await controller.login(loginDto, mockRequest);

      expect(result).toEqual(loginResult);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto, mockRequest);
      expect(mockAuthService.login).toHaveBeenCalledTimes(1);
    });

    it('应该正确传递登录失败错误', async () => {
      const loginDto: UserLoginDto = {
        username: 'testuser',
        password: 'wrongpassword',
      };

      const error = new Error('Invalid credentials');
      mockAuthService.login.mockRejectedValue(error);

      await expect(controller.login(loginDto, mockRequest)).rejects.toThrow(error);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto, mockRequest);
    });
  });

  describe('refreshToken', () => {
    it('应该成功刷新令牌', async () => {
      const refreshTokenDto: RefreshTokenDto = {
        refreshToken: 'valid-refresh-token',
      };

      const refreshResult = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      mockAuthService.refreshToken.mockResolvedValue(refreshResult);

      const result = await controller.refreshToken(refreshTokenDto, mockRequest);

      expect(result).toEqual(refreshResult);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        refreshTokenDto.refreshToken,
        mockRequest,
      );
      expect(mockAuthService.refreshToken).toHaveBeenCalledTimes(1);
    });

    it('应该正确传递无效刷新令牌错误', async () => {
      const refreshTokenDto: RefreshTokenDto = {
        refreshToken: 'invalid-refresh-token',
      };

      const error = new Error('Invalid refresh token');
      mockAuthService.refreshToken.mockRejectedValue(error);

      await expect(controller.refreshToken(refreshTokenDto, mockRequest)).rejects.toThrow(error);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        refreshTokenDto.refreshToken,
        mockRequest,
      );
    });
  });

  describe('logout', () => {
    it('应该成功登出用户', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      await controller.logout(mockUser, mockRequest);

      expect(mockAuthService.logout).toHaveBeenCalledWith(mockUser, mockRequest);
      expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
    });

    it('应该正确传递登出错误', async () => {
      const error = new Error('Logout failed');
      mockAuthService.logout.mockRejectedValue(error);

      await expect(controller.logout(mockUser, mockRequest)).rejects.toThrow(error);
      expect(mockAuthService.logout).toHaveBeenCalledWith(mockUser, mockRequest);
    });
  });

  describe('getCurrentUser', () => {
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

      mockAuthService.getCurrentUser.mockResolvedValue(userProfile);

      const result = await controller.getCurrentUser(mockUser);

      expect(result).toEqual(userProfile);
      expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith(mockUser);
      expect(mockAuthService.getCurrentUser).toHaveBeenCalledTimes(1);
    });

    it('应该正确传递用户不存在错误', async () => {
      const error = new Error('User not found');
      mockAuthService.getCurrentUser.mockRejectedValue(error);

      await expect(controller.getCurrentUser(mockUser)).rejects.toThrow(error);
      expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith(mockUser);
    });
  });
});
