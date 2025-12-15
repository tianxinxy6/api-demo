import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { UserService } from '../user/user.service';
import { TokenService } from './services/token.service';
import { UserRegisterDto, UserLoginDto } from '../user/dto';

describe('AuthController', () => {
  let controller: AuthController;
  let userService: UserService;
  let tokenService: TokenService;

  const mockUser = {
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

  const mockToken = 'mock-jwt-token';

  const mockUserService = {
    createUser: jest.fn(),
    verifyPassword: jest.fn(),
    findUserById: jest.fn(),
  };

  const mockTokenService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: TokenService,
          useValue: mockTokenService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    userService = module.get<UserService>(UserService);
    tokenService = module.get<TokenService>(TokenService);

    // 重置所有 mock
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const registerDto: UserRegisterDto = {
        username: 'newuser',
        password: 'Password123',
        nickname: 'New User',
      };

      const { password, ...userWithoutPassword } = mockUser;

      mockUserService.createUser.mockResolvedValue(userWithoutPassword);
      mockTokenService.sign.mockResolvedValue(mockToken);

      const result = await controller.register(registerDto);

      expect(result).toEqual({
        user: userWithoutPassword,
        accessToken: mockToken,
      });
      expect(userService.createUser).toHaveBeenCalledWith(registerDto);
      expect(tokenService.sign).toHaveBeenCalledWith({ uid: mockUser.id, pv: 1 });
    });

    it('should throw ConflictException when username already exists', async () => {
      const registerDto: UserRegisterDto = {
        username: 'existinguser',
        password: 'Password123',
      };

      const conflictError = new Error('用户名已存在');
      mockUserService.createUser.mockRejectedValue(conflictError);

      await expect(controller.register(registerDto)).rejects.toThrow();
      expect(userService.createUser).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    it('should successfully login user and return token', async () => {
      const loginDto: UserLoginDto = {
        username: 'testuser',
        password: 'password123',
      };

      const { password, ...userWithoutPassword } = mockUser;

      mockUserService.verifyPassword.mockResolvedValue(userWithoutPassword);
      mockTokenService.sign.mockResolvedValue(mockToken);

      const result = await controller.login(loginDto);

      expect(result).toEqual({
        user: {
          id: mockUser.id,
          username: mockUser.username,
          nickname: mockUser.nickname,
        },
        accessToken: mockToken,
      });
      expect(userService.verifyPassword).toHaveBeenCalledWith(
        loginDto.username,
        loginDto.password,
      );
      expect(tokenService.sign).toHaveBeenCalledWith({ uid: mockUser.id, pv: 1 });
    });

    it('should throw UnauthorizedException when username not found', async () => {
      const loginDto: UserLoginDto = {
        username: 'nonexistent',
        password: 'password123',
      };

      mockUserService.verifyPassword.mockResolvedValue(null);

      await expect(controller.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userService.verifyPassword).toHaveBeenCalledWith(
        loginDto.username,
        loginDto.password,
      );
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      const loginDto: UserLoginDto = {
        username: 'testuser',
        password: 'wrongpassword',
      };

      mockUserService.verifyPassword.mockResolvedValue(null);

      await expect(controller.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh token for valid user', async () => {
      const authUser: IAuthUser = { uid: 1, pv: 1 };

      const { password, ...userWithoutPassword } = mockUser;

      mockUserService.findUserById.mockResolvedValue(userWithoutPassword);
      mockTokenService.sign.mockResolvedValue(mockToken);

      const result = await controller.refreshToken(authUser);

      expect(result).toEqual({
        accessToken: mockToken,
      });
      expect(userService.findUserById).toHaveBeenCalledWith(authUser.uid);
      expect(tokenService.sign).toHaveBeenCalledWith({
        uid: authUser.uid,
        pv: 1,
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      const authUser: IAuthUser = { uid: 999, pv: 1 };

      mockUserService.findUserById.mockResolvedValue(null);

      await expect(controller.refreshToken(authUser)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userService.findUserById).toHaveBeenCalledWith(authUser.uid);
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user information', async () => {
      const authUser: IAuthUser = { uid: 1, pv: 1 };

      const { password, ...userWithoutPassword } = mockUser;

      mockUserService.findUserById.mockResolvedValue(userWithoutPassword);

      const result = await controller.getCurrentUser(authUser);

      expect(result).toEqual(userWithoutPassword);
      expect(userService.findUserById).toHaveBeenCalledWith(authUser.uid);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      const authUser: IAuthUser = { uid: 999, pv: 1 };

      mockUserService.findUserById.mockResolvedValue(null);

      await expect(controller.getCurrentUser(authUser)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should successfully logout user', async () => {
      const authUser: IAuthUser = { uid: 1, pv: 1 };

      const result = await controller.logout(authUser);

      expect(result).toBeUndefined();
    });
  });
});
