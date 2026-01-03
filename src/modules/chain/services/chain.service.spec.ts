import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { ChainService } from './chain.service';
import { ChainEntity } from '@/entities/chain.entity';
import { CacheService } from '@/shared/cache/cache.service';
import { ChainStatus, ChainType } from '@/constants';

describe('ChainService', () => {
  let service: ChainService;
  let chainRepository: Repository<ChainEntity>;
  let cacheService: CacheService;

  const mockChainRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    // Mock Logger to suppress logs in tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChainService,
        {
          provide: getRepositoryToken(ChainEntity),
          useValue: mockChainRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<ChainService>(ChainService);
    chainRepository = module.get<Repository<ChainEntity>>(getRepositoryToken(ChainEntity));
    cacheService = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSupportedChains', () => {
    it('应该从缓存返回支持的区块链列表', async () => {
      const cachedChains = [
        {
          id: 1,
          code: 'ETH',
          name: 'Ethereum',
          logo: 'https://example.com/eth.png',
          type: ChainType.ETH,
        },
      ];

      mockCacheService.get.mockResolvedValue(cachedChains);

      const result = await service.getSupportedChains();

      expect(result).toEqual(cachedChains);
      expect(mockCacheService.get).toHaveBeenCalledWith('chain:supported');
      expect(mockChainRepository.find).not.toHaveBeenCalled();
    });

    it('应该从数据库查询并缓存区块链列表', async () => {
      const mockChains = [
        {
          id: 1,
          code: 'ETH',
          name: 'Ethereum',
          logo: 'https://example.com/eth.png',
          type: ChainType.ETH,
          status: ChainStatus.ACTIVE,
        },
        {
          id: 2,
          code: 'TRON',
          name: 'Tron',
          logo: 'https://example.com/tron.png',
          type: ChainType.TRON,
          status: ChainStatus.ACTIVE,
        },
      ] as ChainEntity[];

      mockCacheService.get.mockResolvedValue(null);
      mockChainRepository.find.mockResolvedValue(mockChains);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getSupportedChains();

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('ETH');
      expect(result[1].code).toBe('TRON');
      expect(mockChainRepository.find).toHaveBeenCalledWith({
        where: { status: ChainStatus.ACTIVE },
        select: ['id', 'code', 'name', 'logo', 'type'],
        order: { id: 'ASC' },
      });
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('应该返回空数组当没有激活的链时', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockChainRepository.find.mockResolvedValue([]);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getSupportedChains();

      expect(result).toEqual([]);
      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  describe('getChainConfig', () => {
    it('应该从缓存返回链配置', async () => {
      const code = 'ETH';
      const cachedChain = {
        id: 1,
        code: 'ETH',
        name: 'Ethereum',
        status: ChainStatus.ACTIVE,
      } as ChainEntity;

      mockCacheService.get.mockResolvedValue(cachedChain);

      const result = await service.getChainConfig(code);

      expect(result).toEqual(cachedChain);
      expect(mockCacheService.get).toHaveBeenCalledWith('chain:config:ETH');
      expect(mockChainRepository.findOne).not.toHaveBeenCalled();
    });

    it('应该从数据库查询并缓存链配置', async () => {
      const code = 'ETH';
      const mockChain = {
        id: 1,
        code: 'ETH',
        name: 'Ethereum',
        status: ChainStatus.ACTIVE,
      } as ChainEntity;

      mockCacheService.get.mockResolvedValue(null);
      mockChainRepository.findOne.mockResolvedValue(mockChain);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getChainConfig(code);

      expect(result).toEqual(mockChain);
      expect(mockChainRepository.findOne).toHaveBeenCalledWith({
        where: { code: 'ETH', status: ChainStatus.ACTIVE },
      });
      expect(mockCacheService.set).toHaveBeenCalledWith('chain:config:ETH', mockChain, {
        ttl: expect.any(Number),
      });
    });

    it('应该返回null当链不存在时', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockChainRepository.findOne.mockResolvedValue(null);

      const result = await service.getChainConfig('UNKNOWN');

      expect(result).toBeNull();
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it('应该返回null当代码为空时', async () => {
      const result1 = await service.getChainConfig('');
      const result2 = await service.getChainConfig('   ');
      const result3 = await service.getChainConfig(null as any);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
      expect(mockCacheService.get).not.toHaveBeenCalled();
      expect(mockChainRepository.findOne).not.toHaveBeenCalled();
    });

    it('应该自动trim链代码', async () => {
      const code = '  ETH  ';
      const mockChain = {
        id: 1,
        code: 'ETH',
        name: 'Ethereum',
      } as ChainEntity;

      mockCacheService.get.mockResolvedValue(null);
      mockChainRepository.findOne.mockResolvedValue(mockChain);
      mockCacheService.set.mockResolvedValue(undefined);

      await service.getChainConfig(code);

      expect(mockChainRepository.findOne).toHaveBeenCalledWith({
        where: { code: 'ETH', status: ChainStatus.ACTIVE },
      });
    });
  });

  describe('getChainById', () => {
    it('应该从缓存返回链信息', async () => {
      const chainId = 1;
      const cachedChain = {
        id: 1,
        code: 'ETH',
        name: 'Ethereum',
      } as ChainEntity;

      mockCacheService.get.mockResolvedValue(cachedChain);

      const result = await service.getChainById(chainId);

      expect(result).toEqual(cachedChain);
      expect(mockCacheService.get).toHaveBeenCalledWith('chain:id:1');
      expect(mockChainRepository.findOne).not.toHaveBeenCalled();
    });

    it('应该从数据库查询并缓存链信息', async () => {
      const chainId = 1;
      const mockChain = {
        id: 1,
        code: 'ETH',
        name: 'Ethereum',
        status: ChainStatus.ACTIVE,
      } as ChainEntity;

      mockCacheService.get.mockResolvedValue(null);
      mockChainRepository.findOne.mockResolvedValue(mockChain);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getChainById(chainId);

      expect(result).toEqual(mockChain);
      expect(mockChainRepository.findOne).toHaveBeenCalledWith({
        where: { id: chainId },
      });
      expect(mockCacheService.set).toHaveBeenCalledWith('chain:id:1', mockChain, {
        ttl: expect.any(Number),
      });
    });

    it('应该返回null当链ID不存在时', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockChainRepository.findOne.mockResolvedValue(null);

      const result = await service.getChainById(999);

      expect(result).toBeNull();
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });
  });
});
