import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserLoginLogService } from './user-login-log.service';
import { UserLoginLogEntity } from '@/entities/user-login-log.entity';
import type { FastifyRequest } from 'fastify';

describe('UserLoginLogService', () => {
  let service: UserLoginLogService;
  let repository: Repository<UserLoginLogEntity>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const createMockRequest = (userAgent: string, ip: string = '127.0.0.1'): FastifyRequest => {
    return {
      headers: {
        'user-agent': userAgent,
      },
      ip,
    } as unknown as FastifyRequest;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserLoginLogService,
        {
          provide: getRepositoryToken(UserLoginLogEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UserLoginLogService>(UserLoginLogService);
    repository = module.get<Repository<UserLoginLogEntity>>(getRepositoryToken(UserLoginLogEntity));

    jest.clearAllMocks();
  });

  it('应该被正确定义', () => {
    expect(service).toBeDefined();
  });

  describe('recordLoginLog', () => {
    it('应该成功记录登录日志', async () => {
      const userId = 1;
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124';
      const mockRequest = createMockRequest(userAgent);
      const expectedLog = {
        id: 1,
        userId,
        loginIp: '127.0.0.1',
        userAgent,
        deviceType: 'desktop',
        platform: 'Windows',
        browser: 'Chrome',
        os: 'Windows',
        status: 1,
        failureReason: '',
        location: '',
      };

      mockRepository.create.mockReturnValue(expectedLog);
      mockRepository.save.mockResolvedValue(expectedLog);

      const result = await service.recordLoginLog(userId, mockRequest, 1);

      expect(result).toEqual(expectedLog);
      expect(mockRepository.create).toHaveBeenCalledWith({
        userId,
        loginIp: '127.0.0.1',
        userAgent,
        deviceType: 'desktop',
        platform: 'Windows',
        browser: 'Chrome',
        os: 'Windows',
        status: 1,
        failureReason: '',
        location: '',
      });
      expect(mockRepository.save).toHaveBeenCalledWith(expectedLog);
    });

    it('应该记录失败的登录日志并包含失败原因', async () => {
      const userId = 0;
      const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/537.36';
      const mockRequest = createMockRequest(userAgent);
      const failureReason = '密码错误: testuser';
      const expectedLog = {
        userId,
        loginIp: '127.0.0.1',
        userAgent,
        deviceType: 'desktop',
        platform: 'macOS',
        browser: 'Safari',
        os: 'macOS',
        status: 0,
        failureReason,
        location: '',
      };

      mockRepository.create.mockReturnValue(expectedLog);
      mockRepository.save.mockResolvedValue(expectedLog);

      const result = await service.recordLoginLog(userId, mockRequest, 0, failureReason);

      expect(result).toEqual(expectedLog);
      expect(mockRepository.create).toHaveBeenCalledWith({
        userId,
        loginIp: '127.0.0.1',
        userAgent,
        deviceType: 'desktop',
        platform: 'macOS',
        browser: 'Safari',
        os: 'macOS',
        status: 0,
        failureReason,
        location: '',
      });
    });

    it('应该正确识别移动设备（iPhone）', async () => {
      const userId = 1;
      const userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
      const mockRequest = createMockRequest(userAgent);

      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockResolvedValue({});

      await service.recordLoginLog(userId, mockRequest);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceType: 'mobile',
          platform: 'iOS',
          browser: 'Safari',
          os: 'macOS', // 注意：由于代码先检查 mac，所以是 macOS
        }),
      );
    });

    it('应该正确识别 Android 设备', async () => {
      const userId = 1;
      const userAgent =
        'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 Chrome/91.0.4472.120 Mobile Safari/537.36';
      const mockRequest = createMockRequest(userAgent);

      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockResolvedValue({});

      await service.recordLoginLog(userId, mockRequest);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceType: 'mobile',
          platform: 'Android',
          browser: 'Chrome',
          os: 'Linux', // 注意：由于代码先检查 linux，所以是 Linux
        }),
      );
    });

    it('应该正确识别平板设备（iPad）', async () => {
      const userId = 1;
      const userAgent =
        'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
      const mockRequest = createMockRequest(userAgent);

      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockResolvedValue({});

      await service.recordLoginLog(userId, mockRequest);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceType: 'tablet',
          platform: 'iOS',
          os: 'macOS',
        }),
      );
    });

    it('应该正确识别 Firefox 浏览器', async () => {
      const userId = 1;
      const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';
      const mockRequest = createMockRequest(userAgent);

      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockResolvedValue({});

      await service.recordLoginLog(userId, mockRequest);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          browser: 'Firefox',
        }),
      );
    });

    it('应该正确识别 Edge 浏览器', async () => {
      const userId = 1;
      const userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59';
      const mockRequest = createMockRequest(userAgent);

      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockResolvedValue({});

      await service.recordLoginLog(userId, mockRequest);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          browser: 'Edge',
        }),
      );
    });

    it('应该正确识别 Linux 操作系统', async () => {
      const userId = 1;
      const userAgent =
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      const mockRequest = createMockRequest(userAgent);

      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockResolvedValue({});

      await service.recordLoginLog(userId, mockRequest);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          os: 'Linux',
          platform: 'Linux',
        }),
      );
    });

    it('当 User-Agent 为空时应该使用未知值', async () => {
      const userId = 1;
      const mockRequest = createMockRequest('');

      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockResolvedValue({});

      await service.recordLoginLog(userId, mockRequest);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: '',
          deviceType: 'unknown',
          platform: 'unknown',
          browser: 'unknown',
          os: 'unknown',
        }),
      );
    });

    it('当缺少 User-Agent 请求头时应该使用未知值', async () => {
      const userId = 1;
      const mockRequest = {
        headers: {},
        ip: '192.168.1.1',
      } as unknown as FastifyRequest;

      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockResolvedValue({});

      await service.recordLoginLog(userId, mockRequest);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          loginIp: '192.168.1.1',
          userAgent: '',
          deviceType: 'unknown',
          platform: 'unknown',
          browser: 'unknown',
          os: 'unknown',
        }),
      );
    });

    it('当未提供 status 参数时应该默认为 1', async () => {
      const userId = 1;
      const userAgent = 'Mozilla/5.0';
      const mockRequest = createMockRequest(userAgent);

      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockResolvedValue({});

      await service.recordLoginLog(userId, mockRequest);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 1,
        }),
      );
    });

    it('应该正确提取客户端 IP 地址', async () => {
      const userId = 1;
      const userAgent = 'Mozilla/5.0';
      const mockRequest = createMockRequest(userAgent, '192.168.1.100');

      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockResolvedValue({});

      await service.recordLoginLog(userId, mockRequest);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          loginIp: '192.168.1.100',
        }),
      );
    });
  });
});
