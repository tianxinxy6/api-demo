import { Test, TestingModule } from '@nestjs/testing';
import { MarketController } from './market.controller';
import { MarketService } from '../services/market.service';
import { TokenPriceService } from '@/modules/sys/services/token-price.service';
import { TokenPriceResponse } from '../vo';
import { BusinessException } from '@/common/exceptions/biz.exception';

describe('MarketController', () => {
  let controller: MarketController;
  let marketService: MarketService;
  let priceService: TokenPriceService;

  const mockMarketService = {
    getPrice: jest.fn(),
  };

  const mockPriceService = {
    getAllPrices: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketController],
      providers: [
        {
          provide: MarketService,
          useValue: mockMarketService,
        },
        {
          provide: TokenPriceService,
          useValue: mockPriceService,
        },
      ],
    }).compile();

    controller = module.get<MarketController>(MarketController);
    marketService = module.get<MarketService>(MarketService);
    priceService = module.get<TokenPriceService>(TokenPriceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllPrices', () => {
    it('应该返回所有代币价格列表', async () => {
      const mockPrices = [
        {
          symbol: 'BTCUSDT',
          token: 'BTC',
          quote: 'USDT',
          price: '43250.50',
          priceAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          symbol: 'ETHUSDT',
          token: 'ETH',
          quote: 'USDT',
          price: '2250.75',
          priceAt: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      mockPriceService.getAllPrices.mockResolvedValue(mockPrices);

      const result = await controller.getAllPrices();

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(TokenPriceResponse);
      expect(result[0].symbol).toBe('BTCUSDT');
      expect(result[0].token).toBe('BTC');
      expect(result[0].price).toBe('43250.50');
      expect(result[1].symbol).toBe('ETHUSDT');
      expect(mockPriceService.getAllPrices).toHaveBeenCalled();
    });

    it('应该返回空数组当没有价格数据时', async () => {
      mockPriceService.getAllPrices.mockResolvedValue([]);

      const result = await controller.getAllPrices();

      expect(result).toEqual([]);
      expect(mockPriceService.getAllPrices).toHaveBeenCalled();
    });

    it('应该正确格式化时间字段', async () => {
      const mockPrices = [
        {
          symbol: 'BTCUSDT',
          token: 'BTC',
          quote: 'USDT',
          price: '43250.50',
          priceAt: new Date('2024-12-25T15:30:45Z'),
        },
      ];

      mockPriceService.getAllPrices.mockResolvedValue(mockPrices);

      const result = await controller.getAllPrices();

      expect(result[0].priceAt).toBeTruthy();
      expect(typeof result[0].priceAt).toBe('string');
    });
  });

  describe('getPrice', () => {
    it('应该返回指定交易对的价格', async () => {
      const symbol = 'BTCUSDT';
      const mockPrice: IPriceData = {
        symbol: 'BTCUSDT',
        price: '43250.50',
      };

      mockMarketService.getPrice.mockResolvedValue(mockPrice);

      const result = await controller.getPrice(symbol);

      expect(result).toEqual(mockPrice);
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.price).toBe('43250.50');
      expect(mockMarketService.getPrice).toHaveBeenCalledWith(symbol);
    });

    it('应该自动trim交易对符号', async () => {
      const symbol = '  ETHUSDT  ';
      const mockPrice: IPriceData = {
        symbol: 'ETHUSDT',
        price: '2250.75',
      };

      mockMarketService.getPrice.mockResolvedValue(mockPrice);

      const result = await controller.getPrice(symbol);

      expect(result).toEqual(mockPrice);
      expect(mockMarketService.getPrice).toHaveBeenCalledWith('ETHUSDT');
    });

    it('应该在交易对符号为空时抛出错误', async () => {
      await expect(controller.getPrice('')).rejects.toThrow(BusinessException);
      await expect(controller.getPrice('   ')).rejects.toThrow(BusinessException);
      expect(mockMarketService.getPrice).not.toHaveBeenCalled();
    });

    it('应该在交易对符号为null或undefined时抛出错误', async () => {
      await expect(controller.getPrice(null as any)).rejects.toThrow(BusinessException);
      await expect(controller.getPrice(undefined as any)).rejects.toThrow(BusinessException);
      expect(mockMarketService.getPrice).not.toHaveBeenCalled();
    });

    it('应该在价格不存在时抛出错误', async () => {
      const symbol = 'UNKNOWNUSDT';

      mockMarketService.getPrice.mockResolvedValue(null);

      await expect(controller.getPrice(symbol)).rejects.toThrow(BusinessException);
      expect(mockMarketService.getPrice).toHaveBeenCalledWith(symbol);
    });

    it('应该支持不同的交易对', async () => {
      const testCases = [
        { symbol: 'BTCUSDT', price: '43250.50' },
        { symbol: 'ETHUSDT', price: '2250.75' },
        { symbol: 'BNBUSDT', price: '320.15' },
      ];

      for (const testCase of testCases) {
        const mockPrice: IPriceData = {
          symbol: testCase.symbol,
          price: testCase.price,
        };

        mockMarketService.getPrice.mockResolvedValue(mockPrice);

        const result = await controller.getPrice(testCase.symbol);

        expect(result.symbol).toBe(testCase.symbol);
        expect(result.price).toBe(testCase.price);
      }
    });
  });
});
