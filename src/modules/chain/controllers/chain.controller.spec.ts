import { Test, TestingModule } from '@nestjs/testing';
import { ChainController } from './chain.controller';
import { ChainService } from '../services/chain.service';
import { ChainTokenService } from '../services/token.service';
import { SupportedChainResponse, ChainTokenResponse } from '../vo';
import { BusinessException } from '@/common/exceptions/biz.exception';
import { ErrorCode, ChainType } from '@/constants';
import { ChainEntity } from '@/entities/chain.entity';

describe('ChainController', () => {
  let controller: ChainController;
  let chainService: ChainService;
  let tokenService: ChainTokenService;

  const mockChainService = {
    getSupportedChains: jest.fn(),
    getChainById: jest.fn(),
  };

  const mockTokenService = {
    getChainTokenList: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChainController],
      providers: [
        {
          provide: ChainService,
          useValue: mockChainService,
        },
        {
          provide: ChainTokenService,
          useValue: mockTokenService,
        },
      ],
    }).compile();

    controller = module.get<ChainController>(ChainController);
    chainService = module.get<ChainService>(ChainService);
    tokenService = module.get<ChainTokenService>(ChainTokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSupportedChains', () => {
    it('应该返回支持的区块链列表', async () => {
      const mockChains: SupportedChainResponse[] = [
        new SupportedChainResponse({
          id: 1,
          code: 'ETH',
          name: 'Ethereum',
          logo: 'https://example.com/eth.png',
          type: ChainType.ETH,
        }),
        new SupportedChainResponse({
          id: 2,
          code: 'TRON',
          name: 'Tron',
          logo: 'https://example.com/tron.png',
          type: ChainType.TRON,
        }),
      ];

      mockChainService.getSupportedChains.mockResolvedValue(mockChains);

      const result = await controller.getSupportedChains();

      expect(result).toEqual(mockChains);
      expect(result).toHaveLength(2);
      expect(mockChainService.getSupportedChains).toHaveBeenCalled();
    });

    it('应该返回空数组当没有激活的链时', async () => {
      mockChainService.getSupportedChains.mockResolvedValue([]);

      const result = await controller.getSupportedChains();

      expect(result).toEqual([]);
      expect(mockChainService.getSupportedChains).toHaveBeenCalled();
    });
  });

  describe('getChainTokens', () => {
    it('应该返回指定链上的代币列表', async () => {
      const chainId = 1;
      const mockChain = { id: chainId, code: 'ETH', name: 'Ethereum' } as ChainEntity;
      const mockTokens: ChainTokenResponse[] = [
        new ChainTokenResponse({
          id: 1,
          code: 'ETH',
          name: 'Ethereum',
          logo: 'https://example.com/eth.png',
          contract: null,
          decimals: 18,
        }),
        new ChainTokenResponse({
          id: 2,
          code: 'USDT',
          name: 'Tether USD',
          logo: 'https://example.com/usdt.png',
          contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          decimals: 6,
        }),
      ];

      mockChainService.getChainById.mockResolvedValue(mockChain);
      mockTokenService.getChainTokenList.mockResolvedValue(mockTokens);

      const result = await controller.getChainTokens(chainId);

      expect(result).toEqual(mockTokens);
      expect(result).toHaveLength(2);
      expect(mockChainService.getChainById).toHaveBeenCalledWith(chainId);
      expect(mockTokenService.getChainTokenList).toHaveBeenCalledWith(chainId);
    });

    it('应该在链不存在时抛出错误', async () => {
      const chainId = 999;

      mockChainService.getChainById.mockResolvedValue(null);

      await expect(controller.getChainTokens(chainId)).rejects.toThrow(BusinessException);
      expect(mockChainService.getChainById).toHaveBeenCalledWith(chainId);
      expect(mockTokenService.getChainTokenList).not.toHaveBeenCalled();
    });

    it('应该返回空数组当链上没有激活的代币时', async () => {
      const chainId = 1;
      const mockChain = { id: chainId, code: 'ETH', name: 'Ethereum' } as ChainEntity;

      mockChainService.getChainById.mockResolvedValue(mockChain);
      mockTokenService.getChainTokenList.mockResolvedValue([]);

      const result = await controller.getChainTokens(chainId);

      expect(result).toEqual([]);
      expect(mockChainService.getChainById).toHaveBeenCalledWith(chainId);
      expect(mockTokenService.getChainTokenList).toHaveBeenCalledWith(chainId);
    });
  });
});
