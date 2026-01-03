import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { ChainTokenService } from './token.service';
import { ChainTokenEntity } from '@/entities/chain-token.entity';
import { CacheService } from '@/shared/cache/cache.service';
import { TokenStatus, ChainType } from '@/constants';

describe('ChainTokenService', () => {
  let service: ChainTokenService;
  let tokenRepository: Repository<ChainTokenEntity>;
  let cacheService: CacheService;

  const mockTokenRepository = {
    find: jest.fn(),
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
        ChainTokenService,
        {
          provide: getRepositoryToken(ChainTokenEntity),
          useValue: mockTokenRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<ChainTokenService>(ChainTokenService);
    tokenRepository = module.get<Repository<ChainTokenEntity>>(
      getRepositoryToken(ChainTokenEntity),
    );
    cacheService = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAddressByCode', () => {
    it('应该根据代币代码返回合约信息', async () => {
      const chainId = 1;
      const code = 'USDT';
      const mockTokenData = [
        {
          code: 'ETH',
          chainType: ChainType.ETH,
          contractAddress: '0x0000000000000000000000000000000000000000',
          decimals: 18,
        },
        {
          code: 'USDT',
          chainType: ChainType.ETH,
          contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          decimals: 6,
        },
      ];

      const mockTokens = [
        {
          code: 'ETH',
          chainType: ChainType.ETH,
          contract: '0x0000000000000000000000000000000000000000',
          decimals: 18,
          status: TokenStatus.ACTIVE,
        },
        {
          code: 'USDT',
          chainType: ChainType.ETH,
          contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          decimals: 6,
          status: TokenStatus.ACTIVE,
        },
      ] as ChainTokenEntity[];

      mockCacheService.get.mockResolvedValue(null);
      mockTokenRepository.find.mockResolvedValue(mockTokens);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getAddressByCode(chainId, code);

      expect(result).toEqual({
        code: 'USDT',
        chainType: ChainType.ETH,
        contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        decimals: 6,
      });
    });

    it('应该返回null当代币代码不存在时', async () => {
      const chainId = 1;
      const mockTokens = [
        {
          code: 'ETH',
          chainType: ChainType.ETH,
          contract: '0x0000000000000000000000000000000000000000',
          decimals: 18,
        },
      ] as ChainTokenEntity[];

      mockCacheService.get.mockResolvedValue(null);
      mockTokenRepository.find.mockResolvedValue(mockTokens);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getAddressByCode(chainId, 'UNKNOWN');

      expect(result).toBeNull();
    });

    it('应该返回null当代码为空时', async () => {
      const result1 = await service.getAddressByCode(1, '');
      const result2 = await service.getAddressByCode(1, '   ');
      const result3 = await service.getAddressByCode(1, null as any);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });

    it('应该自动trim代币代码', async () => {
      const chainId = 1;
      const mockTokens = [
        {
          code: 'USDT',
          chainType: ChainType.ETH,
          contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          decimals: 6,
        },
      ] as ChainTokenEntity[];

      mockCacheService.get.mockResolvedValue(null);
      mockTokenRepository.find.mockResolvedValue(mockTokens);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getAddressByCode(chainId, '  USDT  ');

      expect(result).not.toBeNull();
      expect(result?.code).toBe('USDT');
    });
  });

  describe('getCodeByAddress', () => {
    it('应该根据合约地址返回代币信息', async () => {
      const chainId = 1;
      const contractAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
      const mockTokens = [
        {
          code: 'USDT',
          chainType: ChainType.ETH,
          contract: contractAddress,
          decimals: 6,
        },
      ] as ChainTokenEntity[];

      mockCacheService.get.mockResolvedValue(null);
      mockTokenRepository.find.mockResolvedValue(mockTokens);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getCodeByAddress(chainId, contractAddress);

      expect(result).toEqual({
        code: 'USDT',
        chainType: ChainType.ETH,
        contractAddress,
        decimals: 6,
      });
    });

    it('应该返回null当合约地址不存在时', async () => {
      const chainId = 1;
      const mockTokens = [
        {
          code: 'ETH',
          chainType: ChainType.ETH,
          contract: '0x0000000000000000000000000000000000000000',
          decimals: 18,
        },
      ] as ChainTokenEntity[];

      mockCacheService.get.mockResolvedValue(null);
      mockTokenRepository.find.mockResolvedValue(mockTokens);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getCodeByAddress(chainId, '0xunknown');

      expect(result).toBeNull();
    });

    it('应该返回null当地址为空时', async () => {
      const result1 = await service.getCodeByAddress(1, '');
      const result2 = await service.getCodeByAddress(1, '   ');
      const result3 = await service.getCodeByAddress(1, null as any);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });

    it('应该自动trim合约地址', async () => {
      const chainId = 1;
      const contractAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
      const mockTokens = [
        {
          code: 'USDT',
          chainType: ChainType.ETH,
          contract: contractAddress,
          decimals: 6,
        },
      ] as ChainTokenEntity[];

      mockCacheService.get.mockResolvedValue(null);
      mockTokenRepository.find.mockResolvedValue(mockTokens);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getCodeByAddress(chainId, `  ${contractAddress}  `);

      expect(result).not.toBeNull();
      expect(result?.code).toBe('USDT');
    });
  });

  describe('getChainTokens', () => {
    it('应该返回链上所有代币的合约地址数组', async () => {
      const chainId = 1;
      const mockTokens = [
        {
          code: 'ETH',
          chainType: ChainType.ETH,
          contract: '0x0000000000000000000000000000000000000000',
          decimals: 18,
        },
        {
          code: 'USDT',
          chainType: ChainType.ETH,
          contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          decimals: 6,
        },
      ] as ChainTokenEntity[];

      mockCacheService.get.mockResolvedValue(null);
      mockTokenRepository.find.mockResolvedValue(mockTokens);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getChainTokens(chainId);

      expect(result).toEqual([
        '0x0000000000000000000000000000000000000000',
        '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      ]);
    });

    it('应该返回空数组当链上没有代币时', async () => {
      const chainId = 1;

      mockCacheService.get.mockResolvedValue(null);
      mockTokenRepository.find.mockResolvedValue([]);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getChainTokens(chainId);

      expect(result).toEqual([]);
    });
  });

  describe('getChainTokenList', () => {
    it('应该从缓存返回代币列表', async () => {
      const chainId = 1;
      const cachedTokens = [
        {
          id: 1,
          code: 'ETH',
          name: 'Ethereum',
          logo: 'https://example.com/eth.png',
          contract: null,
          decimals: 18,
        },
      ];

      mockCacheService.get.mockResolvedValue(cachedTokens);

      const result = await service.getChainTokenList(chainId);

      expect(result).toEqual(cachedTokens);
      expect(mockCacheService.get).toHaveBeenCalledWith('chain_token:list:1');
      expect(mockTokenRepository.find).not.toHaveBeenCalled();
    });

    it('应该从数据库查询并缓存代币列表', async () => {
      const chainId = 1;
      const mockTokens = [
        {
          id: 1,
          code: 'ETH',
          name: 'Ethereum',
          logo: 'https://example.com/eth.png',
          contract: null,
          decimals: 18,
          status: TokenStatus.ACTIVE,
        },
        {
          id: 2,
          code: 'USDT',
          name: 'Tether USD',
          logo: 'https://example.com/usdt.png',
          contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          decimals: 6,
          status: TokenStatus.ACTIVE,
        },
      ] as ChainTokenEntity[];

      mockCacheService.get.mockResolvedValue(null);
      mockTokenRepository.find.mockResolvedValue(mockTokens);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getChainTokenList(chainId);

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('ETH');
      expect(result[0].contract).toBeNull();
      expect(result[1].code).toBe('USDT');
      expect(result[1].contract).toBe('0xdAC17F958D2ee523a2206206994597C13D831ec7');
      expect(mockTokenRepository.find).toHaveBeenCalledWith({
        where: {
          chainId,
          status: TokenStatus.ACTIVE,
        },
        select: ['id', 'code', 'name', 'logo', 'contract', 'decimals'],
        order: { id: 'ASC' },
      });
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('应该返回空数组当链上没有激活的代币时', async () => {
      const chainId = 1;

      mockCacheService.get.mockResolvedValue(null);
      mockTokenRepository.find.mockResolvedValue([]);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getChainTokenList(chainId);

      expect(result).toEqual([]);
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('应该正确处理原生代币的null合约地址', async () => {
      const chainId = 1;
      const mockTokens = [
        {
          id: 1,
          code: 'ETH',
          name: 'Ethereum',
          logo: 'https://example.com/eth.png',
          contract: null,
          decimals: 18,
        },
      ] as ChainTokenEntity[];

      mockCacheService.get.mockResolvedValue(null);
      mockTokenRepository.find.mockResolvedValue(mockTokens);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getChainTokenList(chainId);

      expect(result[0].contract).toBeNull();
    });
  });

  describe('缓存使用', () => {
    it('应该在多次调用时使用缓存的数据', async () => {
      const chainId = 1;
      const mockTokenData = [
        {
          code: 'ETH',
          chainType: ChainType.ETH,
          contractAddress: '0x0000000000000000000000000000000000000000',
          decimals: 18,
        },
      ];

      mockCacheService.get.mockResolvedValue(mockTokenData);

      await service.getAddressByCode(chainId, 'ETH');
      await service.getChainTokens(chainId);

      expect(mockCacheService.get).toHaveBeenCalledTimes(2);
      expect(mockTokenRepository.find).not.toHaveBeenCalled();
    });
  });
});
