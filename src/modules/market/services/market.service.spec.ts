import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { MarketService } from './market.service';
import { TokenService } from '@/modules/sys/services/token.service';
import { TokenPriceService } from '@/modules/sys/services/token-price.service';
import { BusinessException } from '@/common/exceptions/biz.exception';

describe('MarketService', () => {
  let service: MarketService;
  let httpService: HttpService;
  let tokenService: TokenService;
  let priceService: TokenPriceService;

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockTokenService = {
    getAllTokens: jest.fn(),
  };

  const mockPriceService = {
    batchUpsert: jest.fn(),
  };

  beforeEach(async () => {
    // Mock Logger to suppress logs in tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: TokenService,
          useValue: mockTokenService,
        },
        {
          provide: TokenPriceService,
          useValue: mockPriceService,
        },
      ],
    }).compile();

    service = module.get<MarketService>(MarketService);
    httpService = module.get<HttpService>(HttpService);
    tokenService = module.get<TokenService>(TokenService);
    priceService = module.get<TokenPriceService>(TokenPriceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPrice', () => {
    it('应该成功获取单个交易对价格', async () => {
      const symbol = 'BTCUSDT';
      const mockPriceData: IPriceData = {
        symbol: 'BTCUSDT',
        price: '43250.50',
      };

      const mockResponse: AxiosResponse<IPriceData> = {
        data: mockPriceData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getPrice(symbol);

      expect(result).toEqual(mockPriceData);
      expect(mockHttpService.get).toHaveBeenCalledWith(
        'https://api.binance.com/api/v3/ticker/price',
        {
          params: { symbol: 'BTCUSDT' },
          timeout: 5000,
        },
      );
    });

    it('应该自动转换为大写', async () => {
      const symbol = 'btcusdt';
      const mockPriceData: IPriceData = {
        symbol: 'BTCUSDT',
        price: '43250.50',
      };

      const mockResponse: AxiosResponse<IPriceData> = {
        data: mockPriceData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      await service.getPrice(symbol);

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: { symbol: 'BTCUSDT' },
        }),
      );
    });

    it('应该在交易对符号为空时抛出错误', async () => {
      await expect(service.getPrice('')).rejects.toThrow(BusinessException);
      await expect(service.getPrice('   ')).rejects.toThrow(BusinessException);
      await expect(service.getPrice(null as any)).rejects.toThrow(BusinessException);
      expect(mockHttpService.get).not.toHaveBeenCalled();
    });

    it('应该在API返回空价格时抛出错误', async () => {
      const mockPriceData: IPriceData = {
        symbol: 'BTCUSDT',
        price: '',
      };

      const mockResponse: AxiosResponse<IPriceData> = {
        data: mockPriceData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      await expect(service.getPrice('BTCUSDT')).rejects.toThrow(BusinessException);
    });

    it('应该在API请求失败时抛出超时错误', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('Network timeout')));

      await expect(service.getPrice('BTCUSDT')).rejects.toThrow(BusinessException);
    });

    it('应该正确处理trim后的交易对', async () => {
      const symbol = '  ETHUSDT  ';
      const mockPriceData: IPriceData = {
        symbol: 'ETHUSDT',
        price: '2250.75',
      };

      const mockResponse: AxiosResponse<IPriceData> = {
        data: mockPriceData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getPrice(symbol);

      expect(result.symbol).toBe('ETHUSDT');
    });
  });

  describe('getPrices', () => {
    it('应该批量获取多个交易对的价格', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
      const mockPricesData: IPriceData[] = [
        { symbol: 'BTCUSDT', price: '43250.50' },
        { symbol: 'ETHUSDT', price: '2250.75' },
        { symbol: 'BNBUSDT', price: '320.15' },
        { symbol: 'ADAUSDT', price: '0.45' },
      ];

      const mockResponse: AxiosResponse<IPriceData[]> = {
        data: mockPricesData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getPrices(symbols);

      expect(result).toHaveLength(3);
      expect(result.map((p) => p.symbol)).toEqual(['BTCUSDT', 'ETHUSDT', 'BNBUSDT']);
      expect(mockHttpService.get).toHaveBeenCalledWith(
        'https://api.binance.com/api/v3/ticker/price',
        {
          params: undefined,
          timeout: 5000,
        },
      );
    });

    it('应该返回空数组当输入为空时', async () => {
      const result1 = await service.getPrices([]);
      const result2 = await service.getPrices(null as any);

      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
      expect(mockHttpService.get).not.toHaveBeenCalled();
    });

    it('应该正确过滤不存在的交易对', async () => {
      const symbols = ['BTCUSDT', 'UNKNOWNUSDT'];
      const mockPricesData: IPriceData[] = [
        { symbol: 'BTCUSDT', price: '43250.50' },
        { symbol: 'ETHUSDT', price: '2250.75' },
      ];

      const mockResponse: AxiosResponse<IPriceData[]> = {
        data: mockPricesData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getPrices(symbols);

      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('BTCUSDT');
    });

    it('应该在API请求失败时抛出错误', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('API Error')));

      await expect(service.getPrices(['BTCUSDT'])).rejects.toThrow(BusinessException);
    });

    it('应该将交易对符号转换为大写', async () => {
      const symbols = ['btcusdt', 'ethusdt'];
      const mockPricesData: IPriceData[] = [
        { symbol: 'BTCUSDT', price: '43250.50' },
        { symbol: 'ETHUSDT', price: '2250.75' },
      ];

      const mockResponse: AxiosResponse<IPriceData[]> = {
        data: mockPricesData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getPrices(symbols);

      expect(result).toHaveLength(2);
      expect(result.map((p) => p.symbol)).toEqual(['BTCUSDT', 'ETHUSDT']);
    });
  });

  describe('updatePrices', () => {
    it('应该成功更新系统代币价格', async () => {
      const mockTokens = [
        { id: 1, code: 'BTC', name: 'Bitcoin' },
        { id: 2, code: 'ETH', name: 'Ethereum' },
        { id: 3, code: 'USDT', name: 'Tether' },
      ];

      const mockPricesData: IPriceData[] = [
        { symbol: 'BTCUSDT', price: '43250.50' },
        { symbol: 'ETHUSDT', price: '2250.75' },
      ];

      const mockResponse: AxiosResponse<IPriceData[]> = {
        data: mockPricesData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockTokenService.getAllTokens.mockResolvedValue(mockTokens);
      mockHttpService.get.mockReturnValue(of(mockResponse));
      mockPriceService.batchUpsert.mockResolvedValue(undefined);

      await service.updatePrices('USDT');

      expect(mockTokenService.getAllTokens).toHaveBeenCalled();
      expect(mockPriceService.batchUpsert).toHaveBeenCalledWith([
        {
          symbol: 'BTCUSDT',
          token: 'BTC',
          quote: 'USDT',
          price: '43250.50',
        },
        {
          symbol: 'ETHUSDT',
          token: 'ETH',
          quote: 'USDT',
          price: '2250.75',
        },
      ]);
    });

    it('应该过滤掉计价币种本身', async () => {
      const mockTokens = [
        { id: 1, code: 'BTC', name: 'Bitcoin' },
        { id: 2, code: 'USDT', name: 'Tether' },
      ];

      const mockPricesData: IPriceData[] = [{ symbol: 'BTCUSDT', price: '43250.50' }];

      const mockResponse: AxiosResponse<IPriceData[]> = {
        data: mockPricesData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockTokenService.getAllTokens.mockResolvedValue(mockTokens);
      mockHttpService.get.mockReturnValue(of(mockResponse));
      mockPriceService.batchUpsert.mockResolvedValue(undefined);

      await service.updatePrices('USDT');

      expect(mockPriceService.batchUpsert).toHaveBeenCalledWith([
        {
          symbol: 'BTCUSDT',
          token: 'BTC',
          quote: 'USDT',
          price: '43250.50',
        },
      ]);
    });

    it('应该在没有代币配置时提前返回', async () => {
      mockTokenService.getAllTokens.mockResolvedValue([]);

      await service.updatePrices();

      expect(mockTokenService.getAllTokens).toHaveBeenCalled();
      expect(mockHttpService.get).not.toHaveBeenCalled();
      expect(mockPriceService.batchUpsert).not.toHaveBeenCalled();
    });

    it('应该在没有有效代币时不调用更新', async () => {
      const mockTokens = [{ id: 1, code: 'USDT', name: 'Tether' }];

      mockTokenService.getAllTokens.mockResolvedValue(mockTokens);

      await service.updatePrices('USDT');

      expect(mockHttpService.get).not.toHaveBeenCalled();
      expect(mockPriceService.batchUpsert).not.toHaveBeenCalled();
    });

    it('应该过滤掉没有价格的代币', async () => {
      const mockTokens = [
        { id: 1, code: 'BTC', name: 'Bitcoin' },
        { id: 2, code: 'UNKNOWN', name: 'Unknown Token' },
      ];

      const mockPricesData: IPriceData[] = [{ symbol: 'BTCUSDT', price: '43250.50' }];

      const mockResponse: AxiosResponse<IPriceData[]> = {
        data: mockPricesData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockTokenService.getAllTokens.mockResolvedValue(mockTokens);
      mockHttpService.get.mockReturnValue(of(mockResponse));
      mockPriceService.batchUpsert.mockResolvedValue(undefined);

      await service.updatePrices('USDT');

      expect(mockPriceService.batchUpsert).toHaveBeenCalledWith([
        {
          symbol: 'BTCUSDT',
          token: 'BTC',
          quote: 'USDT',
          price: '43250.50',
        },
      ]);
    });

    it('应该在API失败时捕获错误而不抛出', async () => {
      const mockTokens = [{ id: 1, code: 'BTC', name: 'Bitcoin' }];

      mockTokenService.getAllTokens.mockResolvedValue(mockTokens);
      mockHttpService.get.mockReturnValue(throwError(() => new Error('API Error')));

      await expect(service.updatePrices()).resolves.not.toThrow();
    });

    it('应该使用默认的USDT作为计价币种', async () => {
      const mockTokens = [{ id: 1, code: 'BTC', name: 'Bitcoin' }];

      const mockPricesData: IPriceData[] = [{ symbol: 'BTCUSDT', price: '43250.50' }];

      const mockResponse: AxiosResponse<IPriceData[]> = {
        data: mockPricesData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockTokenService.getAllTokens.mockResolvedValue(mockTokens);
      mockHttpService.get.mockReturnValue(of(mockResponse));
      mockPriceService.batchUpsert.mockResolvedValue(undefined);

      await service.updatePrices();

      expect(mockPriceService.batchUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          quote: 'USDT',
        }),
      ]);
    });

    it('应该正确构建交易对符号', async () => {
      const mockTokens = [{ id: 1, code: 'btc', name: 'Bitcoin' }];

      const mockPricesData: IPriceData[] = [{ symbol: 'BTCUSDT', price: '43250.50' }];

      const mockResponse: AxiosResponse<IPriceData[]> = {
        data: mockPricesData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockTokenService.getAllTokens.mockResolvedValue(mockTokens);
      mockHttpService.get.mockReturnValue(of(mockResponse));
      mockPriceService.batchUpsert.mockResolvedValue(undefined);

      await service.updatePrices('usdt');

      expect(mockPriceService.batchUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          symbol: 'BTCUSDT',
          token: 'BTC',
          quote: 'USDT',
        }),
      ]);
    });
  });
});
