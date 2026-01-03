import { Test, TestingModule } from '@nestjs/testing';
import { DepositService } from './deposit.service';
import { Repository, QueryRunner } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrderDepositEntity } from '@/entities/order-deposit.entity';
import { WalletService } from '@/modules/user/services/wallet.service';
import { TokenService } from '@/modules/sys/services/token.service';
import { DepositStatus, WalletLogType, ChainType } from '@/constants';
import { BaseTransactionEntity } from '@/entities/txs/base.entity';
import { BusinessException } from '@/common/exceptions/biz.exception';
import { QueryDepositDto } from '../dto/deposit.dto';
import { Logger } from '@nestjs/common';

describe('DepositService', () => {
  let service: DepositService;
  let depositRepository: Repository<OrderDepositEntity>;
  let walletService: WalletService;
  let tokenService: TokenService;

  const mockQueryRunner = {
    manager: {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    },
  };

  const mockDepositRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  };

  const mockWalletService = {
    addBalance: jest.fn(),
  };

  const mockTokenService = {
    getTokenByCode: jest.fn(),
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepositService,
        {
          provide: getRepositoryToken(OrderDepositEntity),
          useValue: mockDepositRepository,
        },
        {
          provide: WalletService,
          useValue: mockWalletService,
        },
        {
          provide: TokenService,
          useValue: mockTokenService,
        },
      ],
    }).compile();

    service = module.get<DepositService>(DepositService);
    depositRepository = module.get<Repository<OrderDepositEntity>>(
      getRepositoryToken(OrderDepositEntity),
    );
    walletService = module.get<WalletService>(WalletService);
    tokenService = module.get<TokenService>(TokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('应该创建新的充值订单', async () => {
      const transaction = {
        id: 1,
        hash: '0xabc123',
        from: '0xfrom',
        to: '0xto',
        token: 'USDT',
        decimals: 6,
        amount: '100500000',
        blockNumber: 1000,
        userId: 1,
        status: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BaseTransactionEntity;

      const mockOrder: Partial<OrderDepositEntity> = {
        id: 1,
        userId: 1,
        token: 'USDT',
        decimals: 6,
        amount: '100500000',
        hash: '0xabc123',
        from: '0xfrom',
        to: '0xto',
        status: DepositStatus.PENDING,
        blockNumber: 1000,
        confirmBlock: null,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.create.mockReturnValue(mockOrder);
      mockQueryRunner.manager.save.mockResolvedValue(mockOrder);

      const result = await service.create(
        mockQueryRunner as unknown as QueryRunner,
        ChainType.ETH,
        transaction,
      );

      expect(result).toEqual(mockOrder);
      expect(mockQueryRunner.manager.findOne).toHaveBeenCalledWith(OrderDepositEntity, {
        where: { hash: transaction.hash },
      });
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(OrderDepositEntity, mockOrder);
    });

    it('应该返回已存在的订单而不重复创建', async () => {
      const transaction = {
        id: 1,
        hash: '0xabc123',
        from: '0xfrom',
        to: '0xto',
        token: 'USDT',
        decimals: 6,
        amount: '100500000',
        blockNumber: 1000,
        userId: 1,
        status: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BaseTransactionEntity;

      const existingOrder: Partial<OrderDepositEntity> = {
        id: 1,
        userId: 1,
        token: 'USDT',
        decimals: 6,
        amount: '100500000',
        hash: '0xabc123',
        from: '0xfrom',
        to: '0xto',
        status: DepositStatus.SETTLED,
        blockNumber: 1000,
        confirmBlock: 1010,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(existingOrder);

      const result = await service.create(
        mockQueryRunner as unknown as QueryRunner,
        ChainType.ETH,
        transaction,
      );

      expect(result).toEqual(existingOrder);
      expect(mockQueryRunner.manager.create).not.toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
    });

    it('应该正确设置初始状态为PENDING', async () => {
      const transaction = {
        id: 1,
        hash: '0xtron123',
        from: 'TFromAddr',
        to: 'TToAddr',
        token: 'USDT',
        decimals: 6,
        amount: '50000000',
        blockNumber: 2000,
        userId: 2,
        status: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BaseTransactionEntity;

      mockQueryRunner.manager.findOne.mockResolvedValue(null);
      mockQueryRunner.manager.create.mockImplementation((entity, data) => data);
      mockQueryRunner.manager.save.mockImplementation((entity, data) => data);

      await service.create(mockQueryRunner as unknown as QueryRunner, ChainType.TRON, transaction);

      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        OrderDepositEntity,
        expect.objectContaining({
          status: DepositStatus.PENDING,
        }),
      );
    });
  });

  describe('confirm', () => {
    it('应该成功确认充值并更新钱包余额', async () => {
      const transaction = {
        id: 1,
        hash: '0xabc123',
        from: '0xfrom',
        to: '0xto',
        token: 'USDT',
        decimals: 6,
        amount: '100500000',
        blockNumber: 1000,
        userId: 1,
        status: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BaseTransactionEntity;

      const depositOrder: Partial<OrderDepositEntity> = {
        id: 1,
        userId: 1,
        token: 'USDT',
        decimals: 6,
        amount: '100500000',
        hash: '0xabc123',
        from: '0xfrom',
        to: '0xto',
        status: DepositStatus.PENDING,
        blockNumber: 1000,
        confirmBlock: null,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockToken = {
        id: 1,
        code: 'USDT',
        decimals: 6,
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(depositOrder);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 });
      mockTokenService.getTokenByCode.mockResolvedValue(mockToken);
      mockWalletService.addBalance.mockResolvedValue(undefined);

      await service.confirm(mockQueryRunner as unknown as QueryRunner, transaction, true, 1010);

      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        OrderDepositEntity,
        { id: depositOrder.id },
        expect.objectContaining({
          status: DepositStatus.SETTLED,
          confirmBlock: 1010,
        }),
      );

      expect(mockWalletService.addBalance).toHaveBeenCalledWith(
        mockQueryRunner,
        expect.objectContaining({
          userId: depositOrder.userId,
          tokenId: mockToken.id,
          amount: depositOrder.amount,
          decimals: mockToken.decimals,
          type: WalletLogType.DEPOSIT,
          orderId: depositOrder.id,
        }),
      );
    });

    it('应该失败时更新订单状态为FAILED', async () => {
      const transaction = {
        id: 1,
        hash: '0xfailed',
        from: '0xfrom',
        to: '0xto',
        token: 'USDT',
        decimals: 6,
        amount: '100500000',
        blockNumber: 1000,
        userId: 1,
        status: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BaseTransactionEntity;

      const depositOrder: Partial<OrderDepositEntity> = {
        id: 2,
        userId: 1,
        token: 'USDT',
        decimals: 6,
        amount: '100500000',
        hash: '0xfailed',
        from: '0xfrom',
        to: '0xto',
        status: DepositStatus.PENDING,
        blockNumber: 1000,
        confirmBlock: null,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(depositOrder);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 });

      await service.confirm(
        mockQueryRunner as unknown as QueryRunner,
        transaction,
        false,
        undefined,
        'Insufficient gas',
      );

      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        OrderDepositEntity,
        { id: depositOrder.id },
        expect.objectContaining({
          status: DepositStatus.FAILED,
          failureReason: 'Insufficient gas',
        }),
      );

      expect(mockWalletService.addBalance).not.toHaveBeenCalled();
    });

    it('应该在订单不存在时抛出异常', async () => {
      const transaction = {
        id: 1,
        hash: '0xnonexist',
        from: '0xfrom',
        to: '0xto',
        token: 'USDT',
        decimals: 6,
        amount: '100500000',
        blockNumber: 1000,
        userId: 1,
        status: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BaseTransactionEntity;

      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      await expect(
        service.confirm(mockQueryRunner as unknown as QueryRunner, transaction, true),
      ).rejects.toThrow(BusinessException);

      await expect(
        service.confirm(mockQueryRunner as unknown as QueryRunner, transaction, true),
      ).rejects.toThrow(BusinessException);
    });

    it('应该跳过已处理的订单', async () => {
      const transaction = {
        id: 1,
        hash: '0xprocessed',
        from: '0xfrom',
        to: '0xto',
        token: 'USDT',
        decimals: 6,
        amount: '100500000',
        blockNumber: 1000,
        userId: 1,
        status: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BaseTransactionEntity;

      const processedOrder: Partial<OrderDepositEntity> = {
        id: 3,
        userId: 1,
        token: 'USDT',
        decimals: 6,
        amount: '100500000',
        hash: '0xprocessed',
        from: '0xfrom',
        to: '0xto',
        status: DepositStatus.SETTLED,
        blockNumber: 1000,
        confirmBlock: 1010,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(processedOrder);

      await service.confirm(mockQueryRunner as unknown as QueryRunner, transaction, true);

      expect(mockQueryRunner.manager.update).not.toHaveBeenCalled();
      expect(mockWalletService.addBalance).not.toHaveBeenCalled();
    });

    it('应该在代币不存在时记录错误但不抛异常', async () => {
      const transaction = {
        id: 1,
        hash: '0xnotoken',
        from: '0xfrom',
        to: '0xto',
        token: 'UNKNOWN',
        decimals: 6,
        amount: '100500000',
        blockNumber: 1000,
        userId: 1,
        status: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BaseTransactionEntity;

      const depositOrder: Partial<OrderDepositEntity> = {
        id: 4,
        userId: 1,
        token: 'UNKNOWN',
        decimals: 6,
        amount: '100500000',
        hash: '0xnotoken',
        from: '0xfrom',
        to: '0xto',
        status: DepositStatus.PENDING,
        blockNumber: 1000,
        confirmBlock: null,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(depositOrder);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 });
      mockTokenService.getTokenByCode.mockResolvedValue(null);

      await service.confirm(mockQueryRunner as unknown as QueryRunner, transaction, true, 1010);

      expect(mockQueryRunner.manager.update).toHaveBeenCalled();
      expect(mockWalletService.addBalance).not.toHaveBeenCalled();
      const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error');
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Token not found'));
    });
  });

  describe('getUserOrders', () => {
    it('应该返回用户的充值订单列表', async () => {
      const userId = 1;
      const queryDto: QueryDepositDto = {
        limit: 20,
      };

      const mockOrders: Partial<OrderDepositEntity>[] = [
        {
          id: 1,
          userId: 1,
          token: 'USDT',
          decimals: 6,
          amount: '100500000' as any, // 100.5 USDT with 6 decimals as wei string
          hash: '0xabc123',
          from: '0xfrom',
          to: '0xto',
          status: DepositStatus.SETTLED,
          blockNumber: 1000,
          confirmBlock: 1010,
          failureReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockOrders),
      };

      mockDepositRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getUserOrders(userId, queryDto);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: 1,
        userId: 1,
        token: 'USDT',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('deposit.userId = :userId', {
        userId,
      });
    });

    it('应该支持按链ID过滤', async () => {
      const userId = 1;
      const queryDto: QueryDepositDto = {
        chainId: ChainType.ETH,
        limit: 20,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockDepositRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getUserOrders(userId, queryDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('deposit.chainId = :chainId', {
        chainId: ChainType.ETH,
      });
    });

    it('应该支持按代币过滤', async () => {
      const userId = 1;
      const queryDto: QueryDepositDto = {
        token: 'USDT',
        limit: 20,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockDepositRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getUserOrders(userId, queryDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('deposit.token = :token', {
        token: 'USDT',
      });
    });

    it('应该支持按状态过滤', async () => {
      const userId = 1;
      const queryDto: QueryDepositDto = {
        status: DepositStatus.PENDING,
        limit: 20,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockDepositRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getUserOrders(userId, queryDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('deposit.status = :status', {
        status: DepositStatus.PENDING,
      });
    });

    it('应该支持游标分页', async () => {
      const userId = 1;
      const queryDto: QueryDepositDto = {
        cursor: 100,
        limit: 10,
      };

      const mockOrders = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: 100 - i,
          userId: 1,
          token: 'USDT',
          decimals: 6,
          amount: '50000000' as any, // 50 USDT with 6 decimals
          hash: `0xhash${i}`,
          from: '0xfrom',
          to: '0xto',
          status: DepositStatus.SETTLED,
          blockNumber: 1000,
          confirmBlock: 1010,
          failureReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockOrders),
      };

      mockDepositRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getUserOrders(userId, queryDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('deposit.id < :cursor', {
        cursor: 100,
      });
      expect(result.items).toHaveLength(10);
      expect(result.nextCursor).toBe(91); // 100 - 9 = 91
    });

    it('应该返回空列表当没有订单时', async () => {
      const userId = 1;
      const queryDto: QueryDepositDto = {
        limit: 20,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockDepositRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getUserOrders(userId, queryDto);

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });

    it('应该按ID降序排列', async () => {
      const userId = 1;
      const queryDto: QueryDepositDto = {
        limit: 20,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockDepositRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getUserOrders(userId, queryDto);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('deposit.id', 'DESC');
    });
  });

  describe('getDepositOrderById', () => {
    it('应该返回指定ID的充值订单', async () => {
      const orderId = 1;

      const mockOrder: Partial<OrderDepositEntity> = {
        id: 1,
        userId: 1,
        token: 'USDT',
        decimals: 6,
        amount: '100500000',
        hash: '0xabc123',
        from: '0xfrom',
        to: '0xto',
        status: DepositStatus.SETTLED,
        blockNumber: 1000,
        confirmBlock: 1010,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDepositRepository.findOne.mockResolvedValue(mockOrder);

      const result = await service.getDepositOrderById(orderId);

      expect(result).toMatchObject({
        id: 1,
        userId: 1,
        token: 'USDT',
      });
      expect(mockDepositRepository.findOne).toHaveBeenCalledWith({ where: { id: orderId } });
    });

    it('应该在订单不存在时抛出异常', async () => {
      const orderId = 999;

      mockDepositRepository.findOne.mockResolvedValue(null);

      await expect(service.getDepositOrderById(orderId)).rejects.toThrow(BusinessException);
    });
  });
});
