import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { JwtTokenService } from './token.service';
import { BusinessException } from '@/common/exceptions/biz.exception';
import { ErrorCode } from '@/constants';

describe('JwtTokenService', () => {
  let service: JwtTokenService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    // Mock Logger to suppress error logs in tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtTokenService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<JwtTokenService>(JwtTokenService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  it('应该被正确定义', () => {
    expect(service).toBeDefined();
  });

  describe('verify', () => {
    it('应该成功验证令牌并返回用户信息', async () => {
      const token = 'valid-token';
      const expectedPayload: IAuthUser = { uid: 1 };

      mockJwtService.verifyAsync.mockResolvedValue(expectedPayload);

      const result = await service.verify(token);

      expect(result).toEqual(expectedPayload);
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(token);
      expect(mockJwtService.verifyAsync).toHaveBeenCalledTimes(1);
    });

    it('当令牌验证失败时应该返回 null', async () => {
      const token = 'invalid-token';
      const error = new Error('Token expired');

      mockJwtService.verifyAsync.mockRejectedValue(error);

      const result = await service.verify(token);

      expect(result).toBeNull();
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(token);
    });

    it('当令牌格式错误时应该返回 null', async () => {
      const token = 'malformed.token';
      const error = new Error('jwt malformed');

      mockJwtService.verifyAsync.mockRejectedValue(error);

      const result = await service.verify(token);

      expect(result).toBeNull();
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(token);
    });
  });

  describe('sign', () => {
    it('应该成功生成访问令牌', async () => {
      const payload: IAuthUser = { uid: 1 };
      const expectedToken = 'generated-access-token';

      mockJwtService.signAsync.mockResolvedValue(expectedToken);

      const result = await service.sign(payload);

      expect(result).toBe(expectedToken);
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(payload);
      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(1);
    });

    it('当令牌生成失败时应该抛出错误', async () => {
      const payload: IAuthUser = { uid: 1 };
      const error = new Error('Token generation failed');

      mockJwtService.signAsync.mockRejectedValue(error);

      await expect(service.sign(payload)).rejects.toThrow(error);
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(payload);
    });
  });

  describe('generateRefreshToken', () => {
    it('应该成功生成刷新令牌', async () => {
      const payload: IAuthUser = { uid: 1 };
      const refreshExpiresIn = '7d';
      const expectedToken = 'generated-refresh-token';

      mockConfigService.get.mockReturnValue(refreshExpiresIn);
      mockJwtService.signAsync.mockResolvedValue(expectedToken);

      const result = await service.generateRefreshToken(payload);

      expect(result).toBe(expectedToken);
      expect(mockConfigService.get).toHaveBeenCalledWith('jwt.refreshExpiresIn', '7d');
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        { ...payload, type: 'refresh' },
        { expiresIn: refreshExpiresIn },
      );
      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(1);
    });

    it('当配置未设置时应该使用默认过期时间', async () => {
      const payload: IAuthUser = { uid: 1 };
      const defaultExpiresIn = '7d';
      const expectedToken = 'generated-refresh-token';

      mockConfigService.get.mockReturnValue(defaultExpiresIn);
      mockJwtService.signAsync.mockResolvedValue(expectedToken);

      const result = await service.generateRefreshToken(payload);

      expect(result).toBe(expectedToken);
      expect(mockConfigService.get).toHaveBeenCalledWith('jwt.refreshExpiresIn', '7d');
    });

    it('当刷新令牌生成失败时应该抛出错误', async () => {
      const payload: IAuthUser = { uid: 1 };
      const error = new Error('Token generation failed');

      mockConfigService.get.mockReturnValue('7d');
      mockJwtService.signAsync.mockRejectedValue(error);

      await expect(service.generateRefreshToken(payload)).rejects.toThrow(error);
    });

    it('应该在刷新令牌载荷中添加 type 字段', async () => {
      const payload: IAuthUser = { uid: 123 };
      const refreshExpiresIn = '30d';
      const expectedToken = 'refresh-token-with-type';

      mockConfigService.get.mockReturnValue(refreshExpiresIn);
      mockJwtService.signAsync.mockResolvedValue(expectedToken);

      await service.generateRefreshToken(payload);

      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        { uid: 123, type: 'refresh' },
        { expiresIn: refreshExpiresIn },
      );
    });
  });

  describe('verifyRefreshToken', () => {
    it('应该成功验证刷新令牌', async () => {
      const token = 'valid-refresh-token';
      const payload = { uid: 1, type: 'refresh' };
      const expectedUserPayload: IAuthUser = { uid: 1 };

      mockJwtService.verifyAsync.mockResolvedValue(payload);

      const result = await service.verifyRefreshToken(token);

      expect(result).toEqual(expectedUserPayload);
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(token);
      expect(mockJwtService.verifyAsync).toHaveBeenCalledTimes(1);
    });

    it('当令牌类型不是 refresh 时应该抛出错误', async () => {
      const token = 'access-token-not-refresh';
      const payload = { uid: 1, type: 'access' };

      mockJwtService.verifyAsync.mockResolvedValue(payload);

      await expect(service.verifyRefreshToken(token)).rejects.toThrow(
        new BusinessException(ErrorCode.ErrAuthRefreshTokenInvalid),
      );
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(token);
    });

    it('当令牌缺少 type 字段时应该抛出错误', async () => {
      const token = 'token-without-type';
      const payload = { uid: 1 };

      mockJwtService.verifyAsync.mockResolvedValue(payload);

      await expect(service.verifyRefreshToken(token)).rejects.toThrow(
        new BusinessException(ErrorCode.ErrAuthRefreshTokenInvalid),
      );
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(token);
    });

    it('当令牌验证失败时应该抛出业务异常', async () => {
      const token = 'expired-refresh-token';
      const error = new Error('Token expired');

      mockJwtService.verifyAsync.mockRejectedValue(error);

      await expect(service.verifyRefreshToken(token)).rejects.toThrow(
        new BusinessException(ErrorCode.ErrAuthRefreshTokenInvalid),
      );
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(token);
    });

    it('应该传递 BusinessException 错误', async () => {
      const token = 'invalid-token';
      const businessError = new BusinessException(ErrorCode.ErrAuthRefreshTokenInvalid);

      mockJwtService.verifyAsync.mockRejectedValue(businessError);

      await expect(service.verifyRefreshToken(token)).rejects.toThrow(businessError);
      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(token);
    });

    it('应该从返回的载荷中移除 type 字段', async () => {
      const token = 'valid-refresh-token';
      const payload = { uid: 42, type: 'refresh', iat: 1234567890 };
      const expectedUserPayload = { uid: 42, iat: 1234567890 };

      mockJwtService.verifyAsync.mockResolvedValue(payload);

      const result = await service.verifyRefreshToken(token);

      expect(result).toEqual(expectedUserPayload);
      expect((result as any).type).toBeUndefined();
    });
  });
});
