import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TokenBlacklistService } from './token-blacklist.service';
import { RedisService } from '@/shared/cache/redis.service';

describe('TokenBlacklistService', () => {
  let service: TokenBlacklistService;
  let redisService: RedisService;
  let configService: ConfigService;

  const mockRedisService = {
    set: jest.fn(),
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenBlacklistService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TokenBlacklistService>(TokenBlacklistService);
    redisService = module.get<RedisService>(RedisService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('revokeToken', () => {
    it('应该成功撤销token（默认1小时过期）', async () => {
      const token = 'test.jwt.token';
      const userId = 123;

      mockConfigService.get.mockReturnValue('1h');
      mockRedisService.set.mockResolvedValue(undefined);

      await service.revokeToken(token, userId);

      expect(mockConfigService.get).toHaveBeenCalledWith('jwt.expiresIn', '1h');
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('token:revoked:'),
        '123',
        { ttl: 3600 },
      );
    });

    it('应该使用自定义过期时间撤销token', async () => {
      const token = 'test.jwt.token';
      const userId = 456;

      mockConfigService.get.mockReturnValue('7d');
      mockRedisService.set.mockResolvedValue(undefined);

      await service.revokeToken(token, userId);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('token:revoked:'),
        '456',
        { ttl: 604800 },
      );
    });

    it('应该对token进行MD5哈希', async () => {
      const token = 'test.jwt.token';
      const userId = 789;

      mockConfigService.get.mockReturnValue('1h');
      mockRedisService.set.mockResolvedValue(undefined);

      await service.revokeToken(token, userId);

      const callArgs = mockRedisService.set.mock.calls[0];
      expect(callArgs[0]).toMatch(/^token:revoked:[a-f0-9]{32}$/);
    });

    it('应该正确处理短时间过期的token（分钟）', async () => {
      const token = 'short.lived.token';
      const userId = 100;

      mockConfigService.get.mockReturnValue('15m');
      mockRedisService.set.mockResolvedValue(undefined);

      await service.revokeToken(token, userId);

      expect(mockRedisService.set).toHaveBeenCalledWith(expect.any(String), '100', { ttl: 900 });
    });

    it('应该正确处理长时间过期的token（天）', async () => {
      const token = 'long.lived.token';
      const userId = 200;

      mockConfigService.get.mockReturnValue('30d');
      mockRedisService.set.mockResolvedValue(undefined);

      await service.revokeToken(token, userId);

      expect(mockRedisService.set).toHaveBeenCalledWith(expect.any(String), '200', {
        ttl: 2592000,
      });
    });
  });

  describe('isTokenValid', () => {
    it('应该返回true当token不在黑名单中', async () => {
      const token = 'valid.jwt.token';

      mockRedisService.get.mockResolvedValue(null);

      const result = await service.isTokenValid(token);

      expect(result).toBe(true);
      expect(mockRedisService.get).toHaveBeenCalledWith(expect.stringContaining('token:revoked:'));
    });

    it('应该返回false当token在黑名单中', async () => {
      const token = 'revoked.jwt.token';

      mockRedisService.get.mockResolvedValue('123');

      const result = await service.isTokenValid(token);

      expect(result).toBe(false);
    });

    it('应该对token进行MD5哈希查询', async () => {
      const token = 'test.jwt.token';

      mockRedisService.get.mockResolvedValue(null);

      await service.isTokenValid(token);

      const callArgs = mockRedisService.get.mock.calls[0];
      expect(callArgs[0]).toMatch(/^token:revoked:[a-f0-9]{32}$/);
    });

    it('应该正确处理同一个token的多次查询', async () => {
      const token = 'same.jwt.token';

      mockRedisService.get.mockResolvedValue(null);

      const result1 = await service.isTokenValid(token);
      const result2 = await service.isTokenValid(token);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(mockRedisService.get).toHaveBeenCalledTimes(2);
    });

    it('应该返回false当Redis返回任何非空值', async () => {
      const token = 'test.token';

      mockRedisService.get.mockResolvedValue('any_value');

      const result = await service.isTokenValid(token);

      expect(result).toBe(false);
    });
  });

  describe('集成场景', () => {
    it('应该先验证token有效，撤销后验证无效', async () => {
      const token = 'test.integration.token';
      const userId = 999;

      // 首次验证应该有效
      mockRedisService.get.mockResolvedValue(null);
      const beforeRevoke = await service.isTokenValid(token);
      expect(beforeRevoke).toBe(true);

      // 撤销token
      mockConfigService.get.mockReturnValue('1h');
      mockRedisService.set.mockResolvedValue(undefined);
      await service.revokeToken(token, userId);

      // 撤销后验证应该无效
      mockRedisService.get.mockResolvedValue(userId.toString());
      const afterRevoke = await service.isTokenValid(token);
      expect(afterRevoke).toBe(false);
    });

    it('应该为不同用户撤销不同token', async () => {
      const token1 = 'user1.token';
      const token2 = 'user2.token';

      mockConfigService.get.mockReturnValue('1h');
      mockRedisService.set.mockResolvedValue(undefined);

      await service.revokeToken(token1, 1);
      await service.revokeToken(token2, 2);

      expect(mockRedisService.set).toHaveBeenCalledTimes(2);
      // 验证两个token的key是不同的
      const call1Key = mockRedisService.set.mock.calls[0][0];
      const call2Key = mockRedisService.set.mock.calls[1][0];
      expect(call1Key).not.toBe(call2Key);
    });
  });
});
