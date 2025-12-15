import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { DatabaseService } from '@/shared/database/database.service';
import { RedisService } from '@/shared/cache/redis.service';

describe('HealthController', () => {
  let controller: HealthController;
  let databaseService: DatabaseService;
  let redisService: RedisService;

  const mockDatabaseService = {
    getConnectionInfo: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    databaseService = module.get<DatabaseService>(DatabaseService);
    redisService = module.get<RedisService>(RedisService);

    jest.clearAllMocks();
  });

  describe('checkDetailed', () => {
    it('should return health status with database and redis info', async () => {
      const mockConnectionInfo = {
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        isConnected: true,
      };

      const mockRedisClient = {
        ping: jest.fn().mockResolvedValue('PONG'),
      };

      mockDatabaseService.getConnectionInfo.mockReturnValue(mockConnectionInfo);
      mockRedisService.getClient.mockReturnValue(mockRedisClient);

      const result = await controller.checkDetailed();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('database');
      expect(result).toHaveProperty('redis');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('memory');
      expect(result.database.status).toBe('healthy');
      expect(result.redis.status).toBe('healthy');
      expect(result.redis.response).toBe('PONG');
    });

    it('should handle database connection error', async () => {
      const mockRedisClient = {
        ping: jest.fn().mockResolvedValue('PONG'),
      };

      mockDatabaseService.getConnectionInfo.mockImplementation(() => {
        throw new Error('Connection failed');
      });
      mockRedisService.getClient.mockReturnValue(mockRedisClient);

      const result = await controller.checkDetailed();

      expect(result.database.status).toBe('unhealthy');
      expect(result.database.error).toBeDefined();
    });

    it('should handle redis connection error', async () => {
      const mockConnectionInfo = {
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'test_db',
        isConnected: true,
      };

      const mockRedisClient = {
        ping: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
      };

      mockDatabaseService.getConnectionInfo.mockReturnValue(mockConnectionInfo);
      mockRedisService.getClient.mockReturnValue(mockRedisClient);

      const result = await controller.checkDetailed();

      expect(result.database.status).toBe('healthy');
      expect(result.redis.status).toBe('unhealthy');
      expect(result.redis.error).toBeDefined();
    });
  });
});
