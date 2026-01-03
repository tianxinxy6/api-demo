import { Test, TestingModule } from '@nestjs/testing';
import { SwapService } from './swap.service';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrderSwapEntity } from '@/entities/order-swap.entity';
import { TokenEntity } from '@/entities/token.entity';
import { WalletService } from '@/modules/user/services/wallet.service';
import { UserService } from '@/modules/user/services/user.service';
import { TokenService } from '@/modules/sys/services/token.service';
import { MarketService } from '@/modules/market/services/market.service';
import { Status, WalletLogType, ErrorCode, TokenStatus } from '@/constants';
import { CreateSwapDto, QuerySwapDto } from '../dto/swap.dto';
import { BusinessException } from '@/common/exceptions/biz.exception';
import { Logger } from '@nestjs/common';

describe('SwapService', () => {
  let service: SwapService;
  let swapRepository: Repository<OrderSwapEntity>;
  let walletService: WalletService;
  let userService: UserService;
  let tokenService: TokenService;
  let marketService: MarketService;
  let dataSource: DataSource;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  const mockSwapRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockWalletService = {
    addBalance: jest.fn(),
    subBalance: jest.fn(),
  };

  const mockUserService = {
    verifyTransferPassword: jest.fn(),
  };

  const mockTokenService = {
    getTokenById: jest.fn(),
  };

  const mockMarketService = {
    getPrice: jest.fn(),
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SwapService,
        {
          provide: getRepositoryToken(OrderSwapEntity),
          useValue: mockSwapRepository,
        },
        {
          provide: WalletService,
          useValue: mockWalletService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: TokenService,
          useValue: mockTokenService,
        },
        {
          provide: MarketService,
          useValue: mockMarketService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<SwapService>(SwapService);
    swapRepository = module.get<Repository<OrderSwapEntity>>(getRepositoryToken(OrderSwapEntity));
    walletService = module.get<WalletService>(WalletService);
    userService = module.get<UserService>(UserService);
    tokenService = module.get<TokenService>(TokenService);
    marketService = module.get<MarketService>(MarketService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('create', () => {
    const mockFromToken: Partial<TokenEntity> = {
      id: 1,
      code: 'BTC',
      name: 'Bitcoin',
      decimals: 8,
      status: TokenStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockToToken: Partial<TokenEntity> = {
      id: 2,
      code: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      status: TokenStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('应该成功创建闪兑订单', async () => {
      const userId = 1;
      const dto: CreateSwapDto = {
        fromTokenId: 1,
        toTokenId: 2,
        fromAmount: 0.01,
        transPassword: '123456',
      };

      mockUserService.verifyTransferPassword.mockResolvedValue(undefined);
      mockTokenService.getTokenById
        .mockResolvedValueOnce(mockFromToken)
        .mockResolvedValueOnce(mockToToken);
      mockMarketService.getPrice
        .mockResolvedValueOnce({ price: '50000.00', symbol: 'BTCUSDT' })
        .mockResolvedValueOnce({ price: '3000.00', symbol: 'ETHUSDT' });

      const mockOrder = { id: 1 };
      mockQueryRunner.manager.create.mockReturnValue(mockOrder);
      mockQueryRunner.manager.save.mockResolvedValue(mockOrder);
      mockWalletService.subBalance.mockResolvedValue(undefined);
      mockWalletService.addBalance.mockResolvedValue(undefined);

      await service.create(userId, dto);

      expect(mockUserService.verifyTransferPassword).toHaveBeenCalledWith(
        userId,
        dto.transPassword,
      );
      expect(mockTokenService.getTokenById).toHaveBeenCalledWith(dto.fromTokenId);
      expect(mockTokenService.getTokenById).toHaveBeenCalledWith(dto.toTokenId);
      expect(mockMarketService.getPrice).toHaveBeenCalledWith('BTCUSDT');
      expect(mockMarketService.getPrice).toHaveBeenCalledWith('ETHUSDT');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('应该在交易密码错误时抛出异常', async () => {
      const userId = 1;
      const dto: CreateSwapDto = {
        fromTokenId: 1,
        toTokenId: 2,
        fromAmount: 0.01,
        transPassword: 'wrong',
      };

      mockUserService.verifyTransferPassword.mockRejectedValue(
        new BusinessException('10016:密码错误'),
      );

      await expect(service.create(userId, dto)).rejects.toThrow(BusinessException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('应该在相同代币兑换时抛出异常', async () => {
      const userId = 1;
      const dto: CreateSwapDto = {
        fromTokenId: 1,
        toTokenId: 1,
        fromAmount: 0.01,
        transPassword: '123456',
      };

      mockUserService.verifyTransferPassword.mockResolvedValue(undefined);
      mockTokenService.getTokenById.mockResolvedValue(mockFromToken);

      await expect(service.create(userId, dto)).rejects.toThrow(BusinessException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('应该在源代币不支持时抛出异常', async () => {
      const userId = 1;
      const dto: CreateSwapDto = {
        fromTokenId: 999,
        toTokenId: 2,
        fromAmount: 0.01,
        transPassword: '123456',
      };

      mockUserService.verifyTransferPassword.mockResolvedValue(undefined);
      mockTokenService.getTokenById.mockResolvedValueOnce(null).mockResolvedValueOnce(mockToToken);

      await expect(service.create(userId, dto)).rejects.toThrow(BusinessException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('应该在目标代币不支持时抛出异常', async () => {
      const userId = 1;
      const dto: CreateSwapDto = {
        fromTokenId: 1,
        toTokenId: 999,
        fromAmount: 0.01,
        transPassword: '123456',
      };

      mockUserService.verifyTransferPassword.mockResolvedValue(undefined);
      mockTokenService.getTokenById
        .mockResolvedValueOnce(mockFromToken)
        .mockResolvedValueOnce(null);

      await expect(service.create(userId, dto)).rejects.toThrow(BusinessException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('应该在金额为0时抛出异常', async () => {
      const userId = 1;
      const dto: CreateSwapDto = {
        fromTokenId: 1,
        toTokenId: 2,
        fromAmount: 0,
        transPassword: '123456',
      };

      mockUserService.verifyTransferPassword.mockResolvedValue(undefined);
      mockTokenService.getTokenById
        .mockResolvedValueOnce(mockFromToken)
        .mockResolvedValueOnce(mockToToken);

      await expect(service.create(userId, dto)).rejects.toThrow(BusinessException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('应该正确执行钱包扣减和增加操作', async () => {
      const userId = 1;
      const dto: CreateSwapDto = {
        fromTokenId: 1,
        toTokenId: 2,
        fromAmount: 0.01,
        transPassword: '123456',
      };

      mockUserService.verifyTransferPassword.mockResolvedValue(undefined);
      mockTokenService.getTokenById
        .mockResolvedValueOnce(mockFromToken)
        .mockResolvedValueOnce(mockToToken);
      mockMarketService.getPrice
        .mockResolvedValueOnce({ price: '50000.00', symbol: 'BTCUSDT' })
        .mockResolvedValueOnce({ price: '3000.00', symbol: 'ETHUSDT' });

      const mockOrder = { id: 1 };
      mockQueryRunner.manager.create.mockReturnValue(mockOrder);
      mockQueryRunner.manager.save.mockResolvedValue(mockOrder);
      mockWalletService.subBalance.mockResolvedValue(undefined);
      mockWalletService.addBalance.mockResolvedValue(undefined);

      await service.create(userId, dto);

      expect(mockWalletService.subBalance).toHaveBeenCalledWith(
        mockQueryRunner,
        expect.objectContaining({
          userId,
          tokenId: mockFromToken.id,
          type: WalletLogType.SWAP_OUT,
        }),
      );

      expect(mockWalletService.addBalance).toHaveBeenCalledWith(
        mockQueryRunner,
        expect.objectContaining({
          userId,
          tokenId: mockToToken.id,
          type: WalletLogType.SWAP_IN,
        }),
      );
    });

    it('应该在钱包余额不足时回滚事务', async () => {
      const userId = 1;
      const dto: CreateSwapDto = {
        fromTokenId: 1,
        toTokenId: 2,
        fromAmount: 10,
        transPassword: '123456',
      };

      mockUserService.verifyTransferPassword.mockResolvedValue(undefined);
      mockTokenService.getTokenById
        .mockResolvedValueOnce(mockFromToken)
        .mockResolvedValueOnce(mockToToken);
      mockMarketService.getPrice
        .mockResolvedValueOnce({ price: '50000.00', symbol: 'BTCUSDT' })
        .mockResolvedValueOnce({ price: '3000.00', symbol: 'ETHUSDT' });

      const mockOrder = { id: 1 };
      mockQueryRunner.manager.create.mockReturnValue(mockOrder);
      mockQueryRunner.manager.save.mockResolvedValue(mockOrder);
      mockWalletService.subBalance.mockRejectedValue(new BusinessException('10035:钱包余额不足'));

      await expect(service.create(userId, dto)).rejects.toThrow(BusinessException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('getUserOrders', () => {
    it('应该返回用户的闪兑订单列表', async () => {
      const userId = 1;
      const queryDto: QuerySwapDto = {
        limit: 20,
      };

      const mockOrders: Partial<OrderSwapEntity>[] = [
        {
          id: 1,
          userId: 1,
          orderNo: 'SW202501010001',
          fromTokenId: 1,
          fromToken: 'BTC',
          fromAmount: '1000000' as any,
          toTokenId: 2,
          toToken: 'ETH',
          toAmount: '166666666666666666' as any,
          rate: '16.66666667',
          fromPrice: '50000.00',
          toPrice: '3000.00',
          quote: 'USDT',
          status: Status.Enabled,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockOrders),
      };

      mockSwapRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getUserOrders(userId, queryDto);

      expect(result.items).toHaveLength(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('swap.userId = :userId', { userId });
    });

    it('应该支持按源代币过滤', async () => {
      const userId = 1;
      const queryDto: QuerySwapDto = {
        fromToken: 'BTC',
        limit: 20,
      };

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockSwapRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getUserOrders(userId, queryDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('swap.fromToken = :fromToken', {
        fromToken: 'BTC',
      });
    });

    it('应该支持按目标代币过滤', async () => {
      const userId = 1;
      const queryDto: QuerySwapDto = {
        toToken: 'ETH',
        limit: 20,
      };

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockSwapRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getUserOrders(userId, queryDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('swap.toToken = :toToken', {
        toToken: 'ETH',
      });
    });

    it('应该支持按状态过滤', async () => {
      const userId = 1;
      const queryDto: QuerySwapDto = {
        status: Status.Enabled,
        limit: 20,
      };

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockSwapRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getUserOrders(userId, queryDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('swap.status = :status', {
        status: Status.Enabled,
      });
    });

    it('应该支持游标分页', async () => {
      const userId = 1;
      const queryDto: QuerySwapDto = {
        cursor: 100,
        limit: 10,
      };

      const mockOrders = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: 100 - i,
          userId: 1,
          orderNo: `SW20250101000${i}`,
          fromTokenId: 1,
          fromToken: 'BTC',
          fromAmount: '1000000' as any,
          toTokenId: 2,
          toToken: 'ETH',
          toAmount: '166666666666666666' as any,
          rate: '16.66666667',
          fromPrice: '50000.00',
          toPrice: '3000.00',
          quote: 'USDT',
          status: Status.Enabled,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockOrders),
      };

      mockSwapRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getUserOrders(userId, queryDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('swap.id < :cursor', {
        cursor: 100,
      });
      expect(result.items).toHaveLength(10);
      expect(result.nextCursor).toBe(91);
    });

    it('应该返回空列表当没有订单时', async () => {
      const userId = 1;
      const queryDto: QuerySwapDto = {
        limit: 20,
      };

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockSwapRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getUserOrders(userId, queryDto);

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });

    it('应该按ID降序排列', async () => {
      const userId = 1;
      const queryDto: QuerySwapDto = {
        limit: 20,
      };

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockSwapRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getUserOrders(userId, queryDto);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('swap.id', 'DESC');
    });
  });
});
