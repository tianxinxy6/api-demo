import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenService } from './token.service';
import { TokenEntity } from '@/entities/token.entity';
import { CacheService } from '@/shared/cache/cache.service';
import { TokenStatus, CacheConfigs } from '@/constants';

describe('TokenService', () => {
  let service: TokenService;
  let repository: Repository<TokenEntity>;
  let cacheService: CacheService;

  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: getRepositoryToken(TokenEntity),
          useValue: mockRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    repository = module.get<Repository<TokenEntity>>(getRepositoryToken(TokenEntity));
    cacheService = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTokenByCode', () => {
    const mockToken: Partial<TokenEntity> = {
      id: 1,
      code: 'USDT',
      name: 'Tether USD',
      logo: 'usdt.png',
      decimals: 6,
      status: TokenStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('应该从缓存获取代币信息', async () => {
      mockCacheService.get.mockResolvedValue(mockToken);

      const result = await service.getTokenByCode('USDT');

      expect(result).toEqual(mockToken);
      expect(mockCacheService.get).toHaveBeenCalledWith('token:USDT');
      expect(mockRepository.findOne).not.toHaveBeenCalled();
    });

    it('应该在缓存未命中时从数据库查询', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(mockToken as TokenEntity);

      const result = await service.getTokenByCode('USDT');

      expect(result).toEqual(mockToken);
      expect(mockCacheService.get).toHaveBeenCalledWith('token:USDT');
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          code: 'USDT',
          status: TokenStatus.ACTIVE,
        },
      });
      expect(mockCacheService.set).toHaveBeenCalledWith('token:USDT', mockToken, {
        ttl: CacheConfigs.TOKEN.ttl,
      });
    });

    it('应该将小写代币代码转换为大写', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(mockToken as TokenEntity);

      await service.getTokenByCode('usdt');

      expect(mockCacheService.get).toHaveBeenCalledWith('token:USDT');
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          code: 'USDT',
          status: TokenStatus.ACTIVE,
        },
      });
    });

    it('应该在代币不存在时返回null', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getTokenByCode('UNKNOWN');

      expect(result).toBeNull();
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it('应该正确查询ETH代币', async () => {
      const ethToken: Partial<TokenEntity> = {
        id: 2,
        code: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        status: TokenStatus.ACTIVE,
      };

      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(ethToken as TokenEntity);

      const result = await service.getTokenByCode('ETH');

      expect(result).toEqual(ethToken);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          code: 'ETH',
          status: TokenStatus.ACTIVE,
        },
      });
    });
  });

  describe('getTokenById', () => {
    const mockToken: Partial<TokenEntity> = {
      id: 1,
      code: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      status: TokenStatus.ACTIVE,
    };

    it('应该从缓存获取代币信息', async () => {
      mockCacheService.get.mockResolvedValue(mockToken);

      const result = await service.getTokenById(1);

      expect(result).toEqual(mockToken);
      expect(mockCacheService.get).toHaveBeenCalledWith('token:id:1');
      expect(mockRepository.findOne).not.toHaveBeenCalled();
    });

    it('应该在缓存未命中时从数据库查询', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(mockToken as TokenEntity);

      const result = await service.getTokenById(1);

      expect(result).toEqual(mockToken);
      expect(mockCacheService.get).toHaveBeenCalledWith('token:id:1');
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: 1,
          status: TokenStatus.ACTIVE,
        },
      });
      expect(mockCacheService.set).toHaveBeenCalledWith('token:id:1', mockToken, {
        ttl: CacheConfigs.TOKEN.ttl,
      });
    });

    it('应该在代币不存在时返回null', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getTokenById(999);

      expect(result).toBeNull();
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it('应该只查询激活状态的代币', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(null); // 已暂停的代币

      const result = await service.getTokenById(10);

      expect(result).toBeNull();
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: 10,
          status: TokenStatus.ACTIVE,
        },
      });
    });
  });

  describe('getAllTokens', () => {
    const mockTokens: Partial<TokenEntity>[] = [
      {
        id: 1,
        code: 'BTC',
        name: 'Bitcoin',
        decimals: 8,
        status: TokenStatus.ACTIVE,
      },
      {
        id: 2,
        code: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        status: TokenStatus.ACTIVE,
      },
      {
        id: 3,
        code: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        status: TokenStatus.ACTIVE,
      },
    ];

    it('应该从缓存获取所有代币列表', async () => {
      mockCacheService.get.mockResolvedValue(mockTokens);

      const result = await service.getAllTokens();

      expect(result).toEqual(mockTokens);
      expect(mockCacheService.get).toHaveBeenCalledWith('token:all');
      expect(mockRepository.find).not.toHaveBeenCalled();
    });

    it('应该在缓存未命中时从数据库查询所有激活代币', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.find.mockResolvedValue(mockTokens as TokenEntity[]);

      const result = await service.getAllTokens();

      expect(result).toEqual(mockTokens);
      expect(mockCacheService.get).toHaveBeenCalledWith('token:all');
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: {
          status: TokenStatus.ACTIVE,
        },
        order: {
          id: 'ASC',
        },
      });
      expect(mockCacheService.set).toHaveBeenCalledWith('token:all', mockTokens, {
        ttl: CacheConfigs.TOKEN.ttl,
      });
    });

    it('应该返回空数组当没有激活代币时', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.find.mockResolvedValue([]);

      const result = await service.getAllTokens();

      expect(result).toEqual([]);
      expect(mockCacheService.set).toHaveBeenCalledWith('token:all', [], {
        ttl: CacheConfigs.TOKEN.ttl,
      });
    });

    it('应该按ID升序排列代币', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.find.mockResolvedValue(mockTokens as TokenEntity[]);

      await service.getAllTokens();

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: {
          status: TokenStatus.ACTIVE,
        },
        order: {
          id: 'ASC',
        },
      });
    });

    it('应该缓存数据库查询结果', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockRepository.find.mockResolvedValue(mockTokens as TokenEntity[]);

      await service.getAllTokens();

      expect(mockCacheService.set).toHaveBeenCalledTimes(1);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'token:all',
        mockTokens,
        expect.objectContaining({ ttl: CacheConfigs.TOKEN.ttl }),
      );
    });
  });
});
