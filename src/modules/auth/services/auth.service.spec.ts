import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../../user/services/user.service';
import { JwtTokenService } from './token.service';
import { TokenBlacklistService } from '../../user/services/token-blacklist.service';
import { UserLoginLogService } from './user-login-log.service';
import { UserRegisterDto, UserLoginDto } from '../../user/dto/user.dto';
import { UserStatus, ErrorCode } from '@/constants';
import { BusinessException } from '@/common/exceptions/biz.exception';
import type { FastifyRequest } from 'fastify';
import { UserEntity } from '@/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;
  let tokenService: JwtTokenService;
  let tokenBlacklistService: TokenBlacklistService;
  let userLoginLogService: UserLoginLogService;

  const mockUserService = {
    createUser: jest.fn(),
    verifyLogin: jest.fn(),
    updateLoginInfo: jest.fn(),
    findUserById: jest.fn(),
    getUserProfile: jest.fn(),
  };

  const mockTokenService = {
    sign: jest.fn(),
    generateRefreshToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
  };

  const mockTokenBlacklistService = {
    isTokenValid: jest.fn(),
    revokeToken: jest.fn(),
  };

  const mockUserLoginLogService = {
    recordLoginLog: jest.fn(),
  };

  const mockRequest = {
    headers: {
      'user-agent': 'Mozilla/5.0',
    },
    ip: '127.0.0.1',
    accessToken: 'mock-access-token',
  } as unknown as FastifyRequest;

  const mockUser: Partial<UserEntity> = {
    id: 1,
    username: 'testuser',
    password: '$2b$10$hashedpassword',
    nickname: 'Test User',
    status: UserStatus.Enabled,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: JwtTokenService,
          useValue: mockTokenService,
        },
        {
          provide: TokenBlacklistService,
          useValue: mockTokenBlacklistService,
        },
        {
          provide: UserLoginLogService,
          useValue: mockUserLoginLogService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    tokenService = module.get<JwtTokenService>(JwtTokenService);
    tokenBlacklistService = module.get<TokenBlacklistService>(TokenBlacklistService);
    userLoginLogService = module.get<UserLoginLogService>(UserLoginLogService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('应该成功注册用户', async () => {
      const registerDto: UserRegisterDto = {
        username: 'newuser',
        password: 'password123',
        confirmPassword: 'password123',
        nickname: 'New User',
      };

      mockUserService.createUser.mockResolvedValue(undefined);

      await service.register(registerDto);

      expect(mockUserService.createUser).toHaveBeenCalledWith(registerDto);
      expect(mockUserService.createUser).toHaveBeenCalledTimes(1);
    });

    it('当用户已存在时应该抛出错误', async () => {
      const registerDto: UserRegisterDto = {
        username: 'existinguser',
        password: 'password123',
        confirmPassword: 'password123',
      };

      const error = new BusinessException(ErrorCode.ErrUserExisted);
      mockUserService.createUser.mockRejectedValue(error);

      await expect(service.register(registerDto)).rejects.toThrow(error);
      expect(mockUserService.createUser).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    it('应该成功登录并返回用户信息和令牌', async () => {
      const loginDto: UserLoginDto = {
        username: 'testuser',
        password: 'password123',
      };

      mockUserService.verifyLogin.mockResolvedValue(mockUser);
      mockTokenService.sign.mockResolvedValue('access-token');
      mockTokenService.generateRefreshToken.mockResolvedValue('refresh-token');
      mockUserLoginLogService.recordLoginLog.mockResolvedValue(undefined);
      mockUserService.updateLoginInfo.mockResolvedValue(undefined);

      const result = await service.login(loginDto, mockRequest);

      expect(result).toEqual({
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(mockUserService.verifyLogin).toHaveBeenCalledWith(
        loginDto.username,
        loginDto.password,
      );
      expect(mockTokenService.sign).toHaveBeenCalledWith({ uid: mockUser.id });
      expect(mockTokenService.generateRefreshToken).toHaveBeenCalledWith({ uid: mockUser.id });
      expect(mockUserLoginLogService.recordLoginLog).toHaveBeenCalledWith(
        mockUser.id,
        mockRequest,
        1,
      );
      expect(mockUserService.updateLoginInfo).toHaveBeenCalledWith(
        mockUser.id,
        mockRequest,
        'access-token',
      );
    });

    it('当用户名或密码错误时应该抛出错误并记录失败日志', async () => {
      const loginDto: UserLoginDto = {
        username: 'testuser',
        password: 'wrongpassword',
      };

      mockUserService.verifyLogin.mockResolvedValue(null);
      mockUserLoginLogService.recordLoginLog.mockResolvedValue(undefined);

      await expect(service.login(loginDto, mockRequest)).rejects.toThrow(
        new BusinessException(ErrorCode.ErrAuthLogin),
      );

      expect(mockUserService.verifyLogin).toHaveBeenCalledWith(
        loginDto.username,
        loginDto.password,
      );
      expect(mockUserLoginLogService.recordLoginLog).toHaveBeenCalledWith(
        0,
        mockRequest,
        0,
        `密码错误: ${loginDto.username}`,
      );
      expect(mockTokenService.sign).not.toHaveBeenCalled();
    });

    it('当用户被禁用时应该抛出错误', async () => {
      const loginDto: UserLoginDto = {
        username: 'testuser',
        password: 'password123',
      };

      const disabledUser = {
        ...mockUser,
        status: UserStatus.Disable,
      };

      mockUserService.verifyLogin.mockResolvedValue(disabledUser);

      await expect(service.login(loginDto, mockRequest)).rejects.toThrow(
        new BusinessException(ErrorCode.ErrAuthUserDisabled),
      );

      expect(mockUserService.verifyLogin).toHaveBeenCalledWith(
        loginDto.username,
        loginDto.password,
      );
      expect(mockTokenService.sign).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('应该成功刷新令牌', async () => {
      const refreshToken = 'valid-refresh-token';
      const userPayload = { uid: 1 };

      mockTokenBlacklistService.isTokenValid.mockResolvedValue(true);
      mockTokenService.verifyRefreshToken.mockResolvedValue(userPayload);
      mockUserService.findUserById.mockResolvedValue(mockUser);
      mockTokenService.sign.mockResolvedValue('new-access-token');
      mockTokenService.generateRefreshToken.mockResolvedValue('new-refresh-token');
      mockTokenBlacklistService.revokeToken.mockResolvedValue(undefined);

      const result = await service.refreshToken(refreshToken, mockRequest);

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      expect(mockTokenBlacklistService.isTokenValid).toHaveBeenCalledWith(refreshToken);
      expect(mockTokenService.verifyRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(mockUserService.findUserById).toHaveBeenCalledWith(userPayload.uid);
      expect(mockTokenService.sign).toHaveBeenCalledWith({ uid: userPayload.uid });
      expect(mockTokenService.generateRefreshToken).toHaveBeenCalledWith({ uid: userPayload.uid });
      expect(mockTokenBlacklistService.revokeToken).toHaveBeenCalledWith(
        refreshToken,
        userPayload.uid,
      );
      expect(mockTokenBlacklistService.revokeToken).toHaveBeenCalledWith(
        mockRequest.accessToken,
        userPayload.uid,
      );
    });

    it('当刷新令牌在黑名单中时应该抛出错误', async () => {
      const refreshToken = 'invalid-refresh-token';

      mockTokenBlacklistService.isTokenValid.mockResolvedValue(false);

      await expect(service.refreshToken(refreshToken, mockRequest)).rejects.toThrow(
        new BusinessException(ErrorCode.ErrAuthTokenInvalid),
      );

      expect(mockTokenBlacklistService.isTokenValid).toHaveBeenCalledWith(refreshToken);
      expect(mockTokenService.verifyRefreshToken).not.toHaveBeenCalled();
    });

    it('当用户不存在时应该抛出错误', async () => {
      const refreshToken = 'valid-refresh-token';
      const userPayload = { uid: 999 };

      mockTokenBlacklistService.isTokenValid.mockResolvedValue(true);
      mockTokenService.verifyRefreshToken.mockResolvedValue(userPayload);
      mockUserService.findUserById.mockResolvedValue(null);

      await expect(service.refreshToken(refreshToken, mockRequest)).rejects.toThrow(
        new BusinessException(ErrorCode.ErrUserNotFound),
      );

      expect(mockTokenBlacklistService.isTokenValid).toHaveBeenCalledWith(refreshToken);
      expect(mockTokenService.verifyRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(mockUserService.findUserById).toHaveBeenCalledWith(userPayload.uid);
      expect(mockTokenService.sign).not.toHaveBeenCalled();
    });

    it('当请求中没有 accessToken 时应该只撤销刷新令牌', async () => {
      const refreshToken = 'valid-refresh-token';
      const userPayload = { uid: 1 };
      const requestWithoutToken = {
        ...mockRequest,
        accessToken: undefined,
      } as unknown as FastifyRequest;

      mockTokenBlacklistService.isTokenValid.mockResolvedValue(true);
      mockTokenService.verifyRefreshToken.mockResolvedValue(userPayload);
      mockUserService.findUserById.mockResolvedValue(mockUser);
      mockTokenService.sign.mockResolvedValue('new-access-token');
      mockTokenService.generateRefreshToken.mockResolvedValue('new-refresh-token');
      mockTokenBlacklistService.revokeToken.mockResolvedValue(undefined);

      const result = await service.refreshToken(refreshToken, requestWithoutToken);

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      expect(mockTokenBlacklistService.revokeToken).toHaveBeenCalledTimes(1);
      expect(mockTokenBlacklistService.revokeToken).toHaveBeenCalledWith(
        refreshToken,
        userPayload.uid,
      );
    });
  });

  describe('getCurrentUser', () => {
    it('应该返回当前用户信息', async () => {
      const authUser: IAuthUser = { uid: 1 };
      const userProfile = {
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

      const result = await service.getCurrentUser(authUser);

      expect(result).toEqual(userProfile);
      expect(mockUserService.getUserProfile).toHaveBeenCalledWith(authUser.uid);
      expect(mockUserService.getUserProfile).toHaveBeenCalledTimes(1);
    });

    it('当用户不存在时应该抛出错误', async () => {
      const authUser: IAuthUser = { uid: 999 };

      mockUserService.getUserProfile.mockResolvedValue(null);

      await expect(service.getCurrentUser(authUser)).rejects.toThrow(
        new BusinessException(ErrorCode.ErrUserNotFound),
      );

      expect(mockUserService.getUserProfile).toHaveBeenCalledWith(authUser.uid);
    });
  });

  describe('logout', () => {
    it('应该成功登出用户并撤销令牌', async () => {
      const authUser: IAuthUser = { uid: 1 };

      mockTokenBlacklistService.revokeToken.mockResolvedValue(undefined);

      await service.logout(authUser, mockRequest);

      expect(mockTokenBlacklistService.revokeToken).toHaveBeenCalledWith(
        mockRequest.accessToken,
        authUser.uid,
      );
      expect(mockTokenBlacklistService.revokeToken).toHaveBeenCalledTimes(1);
    });

    it('应该正确传递撤销令牌失败错误', async () => {
      const authUser: IAuthUser = { uid: 1 };
      const error = new Error('Failed to revoke token');

      mockTokenBlacklistService.revokeToken.mockRejectedValue(error);

      await expect(service.logout(authUser, mockRequest)).rejects.toThrow(error);
      expect(mockTokenBlacklistService.revokeToken).toHaveBeenCalledWith(
        mockRequest.accessToken,
        authUser.uid,
      );
    });
  });
});
