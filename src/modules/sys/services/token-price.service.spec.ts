import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenPriceService } from './token-price.service';
import { TokenPriceEntity } from '@/entities/token-price.entity';

describe('TokenPriceService', () => {
  let service: TokenPriceService;
  let repository: Repository<TokenPriceEntity>;

  const mockQueryBuilder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orUpdate: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };

  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenPriceService,
        {
          provide: getRepositoryToken(TokenPriceEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TokenPriceService>(TokenPriceService);
    repository = module.get<Repository<TokenPriceEntity>>(getRepositoryToken(TokenPriceEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('batchUpsert', () => {
    it('应该批量插入或更新价格数据', async () => {
      const prices = [
        { symbol: 'BTCUSDT', token: 'BTC', quote: 'USDT', price: '45000.00' },
        { symbol: 'ETHUSDT', token: 'ETH', quote: 'USDT', price: '3000.00' },
        { symbol: 'BNBUSDT', token: 'BNB', quote: 'USDT', price: '350.00' },
      ];

      mockQueryBuilder.execute.mockResolvedValue({ affected: 1 });

      await service.batchUpsert(prices);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledTimes(3);
      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(3);
      expect(mockQueryBuilder.into).toHaveBeenCalledWith(TokenPriceEntity);
      expect(mockQueryBuilder.values).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTCUSDT',
          token: 'BTC',
          quote: 'USDT',
          price: '45000.00',
          priceAt: expect.any(Date),
        }),
      );
      expect(mockQueryBuilder.orUpdate).toHaveBeenCalledWith(['price', 'price_at'], ['symbol']);
    });

    it('应该在价格数组为空时直接返回', async () => {
      await service.batchUpsert([]);

      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('应该在价格数组为null时直接返回', async () => {
      await service.batchUpsert(null as any);

      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('应该为每个价格项设置相同的时间戳', async () => {
      const prices = [
        { symbol: 'BTCUSDT', token: 'BTC', quote: 'USDT', price: '45000.00' },
        { symbol: 'ETHUSDT', token: 'ETH', quote: 'USDT', price: '3000.00' },
      ];

      const dateSpy = jest.spyOn(global, 'Date');
      mockQueryBuilder.execute.mockResolvedValue({ affected: 1 });

      await service.batchUpsert(prices);

      // 验证两次调用使用的是同一个时间点
      expect(mockQueryBuilder.values).toHaveBeenCalledTimes(2);
    });

    it('应该正确处理单个价格更新', async () => {
      const prices = [{ symbol: 'BTCUSDT', token: 'BTC', quote: 'USDT', price: '50000.00' }];

      mockQueryBuilder.execute.mockResolvedValue({ affected: 1 });

      await service.batchUpsert(prices);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.orUpdate).toHaveBeenCalledWith(['price', 'price_at'], ['symbol']);
    });

    it('应该使用orUpdate实现价格更新', async () => {
      const prices = [{ symbol: 'BTCUSDT', token: 'BTC', quote: 'USDT', price: '45000.00' }];

      mockQueryBuilder.execute.mockResolvedValue({ affected: 1 });

      await service.batchUpsert(prices);

      // 验证使用了 orUpdate 来处理重复的 symbol
      expect(mockQueryBuilder.orUpdate).toHaveBeenCalledWith(['price', 'price_at'], ['symbol']);
    });
  });

  describe('getPrice', () => {
    it('应该通过交易对符号获取价格', async () => {
      const mockPrice: Partial<TokenPriceEntity> = {
        id: 1,
        symbol: 'BTCUSDT',
        token: 'BTC',
        quote: 'USDT',
        price: '45000.00',
        priceAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(mockPrice as TokenPriceEntity);

      const result = await service.getPrice('BTCUSDT');

      expect(result).toEqual(mockPrice);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { symbol: 'BTCUSDT' },
      });
    });

    it('应该将小写交易对转换为大写', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await service.getPrice('btcusdt');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { symbol: 'BTCUSDT' },
      });
    });

    it('应该在价格不存在时返回null', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getPrice('UNKNOWN');

      expect(result).toBeNull();
    });

    it('应该获取ETH/USDT价格', async () => {
      const ethPrice: Partial<TokenPriceEntity> = {
        id: 2,
        symbol: 'ETHUSDT',
        token: 'ETH',
        quote: 'USDT',
        price: '3000.00',
        priceAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(ethPrice as TokenPriceEntity);

      const result = await service.getPrice('ethusdt');

      expect(result).toEqual(ethPrice);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { symbol: 'ETHUSDT' },
      });
    });
  });

  describe('getAllPrices', () => {
    it('应该获取所有价格并按时间降序排列', async () => {
      const mockPrices: Partial<TokenPriceEntity>[] = [
        {
          id: 1,
          symbol: 'BTCUSDT',
          token: 'BTC',
          quote: 'USDT',
          price: '45000.00',
          priceAt: new Date('2024-01-03'),
        },
        {
          id: 2,
          symbol: 'ETHUSDT',
          token: 'ETH',
          quote: 'USDT',
          price: '3000.00',
          priceAt: new Date('2024-01-02'),
        },
      ];

      mockRepository.find.mockResolvedValue(mockPrices as TokenPriceEntity[]);

      const result = await service.getAllPrices();

      expect(result).toEqual(mockPrices);
      expect(mockRepository.find).toHaveBeenCalledWith({
        order: { priceAt: 'DESC' },
      });
    });

    it('应该在没有价格数据时返回空数组', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.getAllPrices();

      expect(result).toEqual([]);
    });
  });

  describe('getPricesByBase', () => {
    it('应该获取指定基础币种的所有交易对价格', async () => {
      const mockPrices: Partial<TokenPriceEntity>[] = [
        {
          id: 1,
          symbol: 'BTCUSDT',
          token: 'BTC',
          quote: 'USDT',
          price: '45000.00',
          priceAt: new Date(),
        },
        {
          id: 2,
          symbol: 'BTCETH',
          token: 'BTC',
          quote: 'ETH',
          price: '15.00',
          priceAt: new Date(),
        },
      ];

      mockRepository.find.mockResolvedValue(mockPrices as TokenPriceEntity[]);

      const result = await service.getPricesByBase('BTC');

      expect(result).toEqual(mockPrices);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { token: 'BTC' },
        order: { priceAt: 'DESC' },
      });
    });

    it('应该将小写币种代码转换为大写', async () => {
      mockRepository.find.mockResolvedValue([]);

      await service.getPricesByBase('btc');

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { token: 'BTC' },
        order: { priceAt: 'DESC' },
      });
    });

    it('应该在没有相关价格时返回空数组', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.getPricesByBase('UNKNOWN');

      expect(result).toEqual([]);
    });

    it('应该获取ETH的所有计价对', async () => {
      const ethPrices: Partial<TokenPriceEntity>[] = [
        {
          id: 3,
          symbol: 'ETHUSDT',
          token: 'ETH',
          quote: 'USDT',
          price: '3000.00',
          priceAt: new Date(),
        },
        {
          id: 4,
          symbol: 'ETHBTC',
          token: 'ETH',
          quote: 'BTC',
          price: '0.0667',
          priceAt: new Date(),
        },
      ];

      mockRepository.find.mockResolvedValue(ethPrices as TokenPriceEntity[]);

      const result = await service.getPricesByBase('eth');

      expect(result).toEqual(ethPrices);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { token: 'ETH' },
        order: { priceAt: 'DESC' },
      });
    });
  });

  describe('getPricesByQuote', () => {
    it('应该获取指定计价币种的所有交易对价格', async () => {
      const mockPrices: Partial<TokenPriceEntity>[] = [
        {
          id: 1,
          symbol: 'BTCUSDT',
          token: 'BTC',
          quote: 'USDT',
          price: '45000.00',
          priceAt: new Date(),
        },
        {
          id: 2,
          symbol: 'ETHUSDT',
          token: 'ETH',
          quote: 'USDT',
          price: '3000.00',
          priceAt: new Date(),
        },
      ];

      mockRepository.find.mockResolvedValue(mockPrices as TokenPriceEntity[]);

      const result = await service.getPricesByQuote('USDT');

      expect(result).toEqual(mockPrices);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { quote: 'USDT' },
        order: { priceAt: 'DESC' },
      });
    });

    it('应该将小写计价币种代码转换为大写', async () => {
      mockRepository.find.mockResolvedValue([]);

      await service.getPricesByQuote('usdt');

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { quote: 'USDT' },
        order: { priceAt: 'DESC' },
      });
    });

    it('应该在没有相关价格时返回空数组', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.getPricesByQuote('EUR');

      expect(result).toEqual([]);
    });

    it('应该获取BTC计价的所有交易对', async () => {
      const btcQuotedPrices: Partial<TokenPriceEntity>[] = [
        {
          id: 5,
          symbol: 'ETHBTC',
          token: 'ETH',
          quote: 'BTC',
          price: '0.0667',
          priceAt: new Date(),
        },
        {
          id: 6,
          symbol: 'BNBBTC',
          token: 'BNB',
          quote: 'BTC',
          price: '0.0078',
          priceAt: new Date(),
        },
      ];

      mockRepository.find.mockResolvedValue(btcQuotedPrices as TokenPriceEntity[]);

      const result = await service.getPricesByQuote('btc');

      expect(result).toEqual(btcQuotedPrices);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { quote: 'BTC' },
        order: { priceAt: 'DESC' },
      });
    });

    it('应该按价格时间降序排列', async () => {
      mockRepository.find.mockResolvedValue([]);

      await service.getPricesByQuote('USDT');

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { quote: 'USDT' },
        order: { priceAt: 'DESC' },
      });
    });
  });
});
