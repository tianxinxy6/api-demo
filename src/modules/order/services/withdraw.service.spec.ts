import { Test, TestingModule } from '@nestjs/testing';
import { WithdrawService } from './withdraw.service';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrderWithdrawEntity } from '@/entities/order-withdraw.entity';
import { TokenEntity } from '@/entities/token.entity';
import { WalletService } from '@/modules/user/services/wallet.service';
import { UserService } from '@/modules/user/services/user.service';
import { TokenService } from '@/modules/sys/services/token.service';
import { ChainTokenService } from '@/modules/chain/services/token.service';
import { AddressMgrService } from '@/shared/services/wallet.service';
import { WithdrawalStatus, WalletLogType, Status, ChainType, TokenStatus } from '@/constants';
import { CreateWithdrawDto, QueryWithdrawDto } from '../dto/withdraw.dto';
import { BusinessException } from '@/common/exceptions/biz.exception';
import { Logger } from '@nestjs/common';

describe('WithdrawService', () => {
  let service: WithdrawService;
  let withdrawRepository: Repository<OrderWithdrawEntity>;
  let walletService: WalletService;
  let userService: UserService;
  let tokenService: TokenService;
  let chainTokenService: ChainTokenService;
  let addressMgrService: AddressMgrService;
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
      update: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  const mockWithdrawRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };

  const mockWalletService = {
    freezeBalance: jest.fn(),
    unfreezeBalance: jest.fn(),
    subFrozenBalance: jest.fn(),
  };

  const mockUserService = {
    verifyTransferPassword: jest.fn(),
  };

  const mockTokenService = {
    getTokenById: jest.fn(),
    getTokenByCode: jest.fn(),
  };

  const mockChainTokenService = {
    getAddressByCode: jest.fn(),
  };

  const mockAddressMgrService = {
    validateAddress: jest.fn(),
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawService,
        {
          provide: getRepositoryToken(OrderWithdrawEntity),
          useValue: mockWithdrawRepository,
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
          provide: ChainTokenService,
          useValue: mockChainTokenService,
        },
        {
          provide: AddressMgrService,
          useValue: mockAddressMgrService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<WithdrawService>(WithdrawService);
    withdrawRepository = module.get<Repository<OrderWithdrawEntity>>(
      getRepositoryToken(OrderWithdrawEntity),
    );
    walletService = module.get<WalletService>(WalletService);
    userService = module.get<UserService>(UserService);
    tokenService = module.get<TokenService>(TokenService);
    chainTokenService = module.get<ChainTokenService>(ChainTokenService);
    addressMgrService = module.get<AddressMgrService>(AddressMgrService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('create', () => {
    const mockToken: Partial<TokenEntity> = {
      id: 1,
      code: 'USDT',
      name: 'Tether',
      decimals: 6,
      status: TokenStatus.ACTIVE,
      withdrawFee: { rate: 100, min: 1000000, max: 10000000 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockChainToken = {
      id: 1,
      chainId: ChainType.ETH,
      chainType: ChainType.ETH,
      token: 'USDT',
      decimals: 6,
      contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    };

    it('应该成功创建提现订单', async () => {
      const userId = 1;
      const dto: CreateWithdrawDto = {
        chainId: ChainType.ETH,
        tokenId: 1,
        amount: 100,
        to: '0x1234567890abcdef1234567890abcdef12345678',
        transPassword: '123456',
      };

      mockUserService.verifyTransferPassword.mockResolvedValue(undefined);
      mockWithdrawRepository.findOne.mockResolvedValue(null);
      mockTokenService.getTokenById.mockResolvedValue(mockToken);
      mockChainTokenService.getAddressByCode.mockResolvedValue(mockChainToken);
      mockAddressMgrService.validateAddress.mockReturnValue(true);

      const mockOrder = { id: 1, orderNo: 'WD202501010001' };
      mockQueryRunner.manager.create.mockReturnValue(mockOrder);
      mockQueryRunner.manager.save.mockResolvedValue(mockOrder);
      mockWalletService.freezeBalance.mockResolvedValue(undefined);

      const result = await service.create(userId, dto);

      expect(result).toBe('WD202501010001');
      expect(mockUserService.verifyTransferPassword).toHaveBeenCalledWith(
        userId,
        dto.transPassword,
      );
      expect(mockTokenService.getTokenById).toHaveBeenCalledWith(dto.tokenId);
      expect(mockChainTokenService.getAddressByCode).toHaveBeenCalledWith(
        dto.chainId,
        mockToken.code,
      );
      expect(mockAddressMgrService.validateAddress).toHaveBeenCalledWith(
        ChainType.ETH,
        dto.toAddress,
      );
      expect(mockWalletService.freezeBalance).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('应该在交易密码错误时抛出异常', async () => {
      const userId = 1;
      const dto: CreateWithdrawDto = {
        chainId: ChainType.ETH,
        tokenId: 1,
        amount: 100,
        to: '0x1234567890abcdef1234567890abcdef12345678',
        transPassword: 'wrong',
      };

      mockUserService.verifyTransferPassword.mockRejectedValue(
        new BusinessException('10016:密码错误'),
      );

      await expect(service.create(userId, dto)).rejects.toThrow(BusinessException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('应该在已有待处理订单时抛出异常', async () => {
      const userId = 1;
      const dto: CreateWithdrawDto = {
        chainId: ChainType.ETH,
        tokenId: 1,
        amount: 100,
        to: '0x1234567890abcdef1234567890abcdef12345678',
        transPassword: '123456',
      };

      mockUserService.verifyTransferPassword.mockResolvedValue(undefined);
      mockWithdrawRepository.findOne.mockResolvedValue({ id: 1, status: WithdrawalStatus.PENDING });

      await expect(service.create(userId, dto)).rejects.toThrow(BusinessException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('应该在代币不支持时抛出异常', async () => {
      const userId = 1;
      const dto: CreateWithdrawDto = {
        chainId: ChainType.ETH,
        tokenId: 999,
        amount: 100,
        to: '0x1234567890abcdef1234567890abcdef12345678',
        transPassword: '123456',
      };

      mockUserService.verifyTransferPassword.mockResolvedValue(undefined);
      mockWithdrawRepository.findOne.mockResolvedValue(null);
      mockTokenService.getTokenById.mockResolvedValue(null);

      await expect(service.create(userId, dto)).rejects.toThrow(BusinessException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('应该在地址无效时抛出异常', async () => {
      const userId = 1;
      const dto: CreateWithdrawDto = {
        chainId: ChainType.ETH,
        tokenId: 1,
        amount: 100,
        to: 'invalid-address',
        transPassword: '123456',
      };

      mockUserService.verifyTransferPassword.mockResolvedValue(undefined);
      mockWithdrawRepository.findOne.mockResolvedValue(null);
      mockTokenService.getTokenById.mockResolvedValue(mockToken);
      mockChainTokenService.getAddressByCode.mockResolvedValue(mockChainToken);
      mockAddressMgrService.validateAddress.mockReturnValue(false);

      await expect(service.create(userId, dto)).rejects.toThrow(BusinessException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('应该在金额为0时抛出异常', async () => {
      const userId = 1;
      const dto: CreateWithdrawDto = {
        chainId: ChainType.ETH,
        tokenId: 1,
        amount: 0,
        to: '0x1234567890abcdef1234567890abcdef12345678',
        transPassword: '123456',
      };

      mockUserService.verifyTransferPassword.mockResolvedValue(undefined);
      mockWithdrawRepository.findOne.mockResolvedValue(null);
      mockTokenService.getTokenById.mockResolvedValue(mockToken);
      mockChainTokenService.getAddressByCode.mockResolvedValue(mockChainToken);
      mockAddressMgrService.validateAddress.mockReturnValue(true);

      await expect(service.create(userId, dto)).rejects.toThrow(BusinessException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('应该成功取消提现订单', async () => {
      const userId = 1;
      const orderNo = 'WD202501010001';

      const mockOrder: OrderWithdrawEntity = {
        id: 1,
        userId: 1,
        orderNo: 'WD202501010001',
        chainId: ChainType.ETH,
        token: 'USDT',
        decimals: 6,
        contract: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        to: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '100000000' as any,
        fee: '1000000' as any,
        actualAmount: '99000000' as any,
        to: '0x1234567890abcdef1234567890abcdef12345678',
        status: WithdrawalStatus.PENDING,
        hash: null,
        remark: null,
        failureReason: null,
        finishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockToken: TokenEntity = {
        id: 1,
        code: 'USDT',
        name: 'Tether',
        decimals: 6,
        status: TokenStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(mockOrder);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 });
      mockTokenService.getTokenByCode.mockResolvedValue(mockToken);
      mockWalletService.unfreezeBalance.mockResolvedValue(undefined);

      await service.cancel(userId, orderNo);

      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        OrderWithdrawEntity,
        { id: mockOrder.id },
        expect.objectContaining({
          status: WithdrawalStatus.CANCELLED,
          remark: '用户取消',
        }),
      );
      expect(mockWalletService.unfreezeBalance).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('应该在订单不存在时抛出异常', async () => {
      const userId = 1;
      const orderNo = 'WD999999999';

      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      await expect(service.cancel(userId, orderNo)).rejects.toThrow(BusinessException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('应该在订单状态不是PENDING时抛出异常', async () => {
      const userId = 1;
      const orderNo = 'WD202501010001';

      const mockOrder = {
        id: 1,
        userId: 1,
        orderNo: 'WD202501010001',
        status: WithdrawalStatus.SETTLED,
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(mockOrder);

      await expect(service.cancel(userId, orderNo)).rejects.toThrow(BusinessException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('settle', () => {
    it('应该成功完成提现订单', async () => {
      const orderId = 1;
      const hash = '0xabc123';

      const mockOrder: OrderWithdrawEntity = {
        id: 1,
        userId: 1,
        orderNo: 'WD202501010001',
        chainId: ChainType.ETH,
        token: 'USDT',
        decimals: 6,
        contract: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        to: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '100000000' as any,
        fee: '1000000' as any,
        actualAmount: '99000000' as any,
        to: '0x1234567890abcdef1234567890abcdef12345678',
        status: WithdrawalStatus.PROCESSING,
        hash: null,
        remark: null,
        failureReason: null,
        finishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockToken: TokenEntity = {
        id: 1,
        code: 'USDT',
        name: 'Tether',
        decimals: 6,
        status: TokenStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(mockOrder);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 });
      mockTokenService.getTokenByCode.mockResolvedValue(mockToken);
      mockWalletService.subFrozenBalance.mockResolvedValue(undefined);

      await service.settle(mockQueryRunner as unknown as QueryRunner, orderId, hash);

      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        OrderWithdrawEntity,
        { id: orderId },
        expect.objectContaining({
          status: WithdrawalStatus.SETTLED,
          hash,
        }),
      );
      expect(mockWalletService.subFrozenBalance).toHaveBeenCalledWith(
        mockQueryRunner,
        expect.objectContaining({
          userId: mockOrder.userId,
          tokenId: mockToken.id,
          amount: mockOrder.amount,
          type: WalletLogType.WITHDRAWAL,
        }),
      );
    });

    it('应该在订单不存在时抛出异常', async () => {
      const orderId = 999;
      const hash = '0xabc123';

      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      await expect(
        service.settle(mockQueryRunner as unknown as QueryRunner, orderId, hash),
      ).rejects.toThrow(BusinessException);
    });

    it('应该在订单状态无效时抛出异常', async () => {
      const orderId = 1;
      const hash = '0xabc123';

      const mockOrder = {
        id: 1,
        status: WithdrawalStatus.PENDING,
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(mockOrder);

      await expect(
        service.settle(mockQueryRunner as unknown as QueryRunner, orderId, hash),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('fail', () => {
    it('应该成功标记提现失败', async () => {
      const orderId = 1;
      const failureReason = 'Insufficient gas';

      const mockOrder: OrderWithdrawEntity = {
        id: 1,
        userId: 1,
        orderNo: 'WD202501010001',
        chainId: ChainType.ETH,
        token: 'USDT',
        decimals: 6,
        contract: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        to: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '100000000' as any,
        fee: '1000000' as any,
        actualAmount: '99000000' as any,
        to: '0x1234567890abcdef1234567890abcdef12345678',
        status: WithdrawalStatus.PROCESSING,
        hash: null,
        remark: null,
        failureReason: null,
        finishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockToken: TokenEntity = {
        id: 1,
        code: 'USDT',
        name: 'Tether',
        decimals: 6,
        status: TokenStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockQueryRunner.manager.findOne.mockResolvedValue(mockOrder);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 });
      mockTokenService.getTokenByCode.mockResolvedValue(mockToken);
      mockWalletService.unfreezeBalance.mockResolvedValue(undefined);

      await service.fail(mockQueryRunner as unknown as QueryRunner, orderId, failureReason);

      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        OrderWithdrawEntity,
        { id: orderId },
        expect.objectContaining({
          status: WithdrawalStatus.FAILED,
          failureReason,
        }),
      );
      expect(mockWalletService.unfreezeBalance).toHaveBeenCalledWith(
        mockQueryRunner,
        expect.objectContaining({
          userId: mockOrder.userId,
          tokenId: mockToken.id,
          amount: mockOrder.amount,
          type: WalletLogType.WITHDRAWAL,
        }),
      );
    });

    it('应该在订单不存在时抛出异常', async () => {
      const orderId = 999;
      const failureReason = 'Test failure';

      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      await expect(
        service.fail(mockQueryRunner as unknown as QueryRunner, orderId, failureReason),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('getUserOrders', () => {
    it('应该返回用户的提现订单列表', async () => {
      const userId = 1;
      const dto: QueryWithdrawDto = {
        limit: 20,
      };

      const mockOrders: OrderWithdrawEntity[] = [
        {
          id: 1,
          userId: 1,
          orderNo: 'WD202501010001',
          chainId: ChainType.ETH,
          token: 'USDT',
          decimals: 6,
          contract: '0xdac17f958d2ee523a2206206994597c13d831ec7',
          to: '0x1234567890abcdef1234567890abcdef12345678',
          amount: '100000000' as any,
          fee: '1000000' as any,
          actualAmount: '99000000' as any,
          to: '0x1234567890abcdef1234567890abcdef12345678',
          status: WithdrawalStatus.SETTLED,
          hash: '0xabc123',
          remark: null,
          failureReason: null,
          finishedAt: new Date(),
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

      mockWithdrawRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getUserOrders(userId, dto);

      expect(result.items).toHaveLength(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('withdraw.userId = :userId', {
        userId,
      });
    });

    it('应该支持按链ID过滤', async () => {
      const userId = 1;
      const dto: QueryWithdrawDto = {
        chainId: ChainType.ETH,
        limit: 20,
      };

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockWithdrawRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getUserOrders(userId, dto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('withdraw.chainId = :chainId', {
        chainId: ChainType.ETH,
      });
    });

    it('应该支持按状态过滤', async () => {
      const userId = 1;
      const dto: QueryWithdrawDto = {
        status: WithdrawalStatus.SETTLED,
        limit: 20,
      };

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockWithdrawRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getUserOrders(userId, dto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('withdraw.status = :status', {
        status: WithdrawalStatus.SETTLED,
      });
    });

    it('应该返回空列表当没有订单时', async () => {
      const userId = 1;
      const dto: QueryWithdrawDto = {
        limit: 20,
      };

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockWithdrawRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getUserOrders(userId, dto);

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('getOrderById', () => {
    it('应该返回指定ID的提现订单', async () => {
      const orderId = 1;
      const userId = 1;

      const mockOrder: OrderWithdrawEntity = {
        id: 1,
        userId: 1,
        orderNo: 'WD202501010001',
        chainId: ChainType.ETH,
        token: 'USDT',
        decimals: 6,
        contract: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        to: '0x1234567890abcdef1234567890abcdef12345678',
        amount: '100000000' as any,
        fee: '1000000' as any,
        actualAmount: '99000000' as any,
        to: '0x1234567890abcdef1234567890abcdef12345678',
        status: WithdrawalStatus.SETTLED,
        hash: '0xabc123',
        remark: null,
        failureReason: null,
        finishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockWithdrawRepository.findOne.mockResolvedValue(mockOrder);

      const result = await service.getOrderById(orderId, userId);

      expect(result).toMatchObject({
        id: 1,
        userId: 1,
        orderNo: 'WD202501010001',
      });
      expect(mockWithdrawRepository.findOne).toHaveBeenCalledWith({
        where: { id: orderId, userId },
      });
    });

    it('应该在订单不存在时抛出异常', async () => {
      const orderId = 999;
      const userId = 1;

      mockWithdrawRepository.findOne.mockResolvedValue(null);

      await expect(service.getOrderById(orderId, userId)).rejects.toThrow(BusinessException);
    });
  });

  describe('getPendingWithdraws', () => {
    it('应该返回待处理的提现订单列表', async () => {
      const chainId = ChainType.ETH;
      const limit = 10;

      const mockOrders: OrderWithdrawEntity[] = [
        {
          id: 1,
          userId: 1,
          orderNo: 'WD202501010001',
          chainId: ChainType.ETH,
          token: 'USDT',
          decimals: 6,
          contract: '0xdac17f958d2ee523a2206206994597c13d831ec7',
          to: '0x1234567890abcdef1234567890abcdef12345678',
          amount: '100000000' as any,
          fee: '1000000' as any,
          actualAmount: '99000000' as any,
          to: '0x1234567890abcdef1234567890abcdef12345678',
          status: WithdrawalStatus.APPROVED,
          hash: null,
          remark: null,
          failureReason: null,
          finishedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockWithdrawRepository.find.mockResolvedValue(mockOrders);

      const result = await service.getPendingWithdraws(chainId, limit);

      expect(result).toEqual(mockOrders);
      expect(mockWithdrawRepository.find).toHaveBeenCalledWith({
        where: {
          chainId,
          status: WithdrawalStatus.APPROVED,
        },
        take: limit,
        order: { id: 'ASC' },
      });
    });
  });

  describe('editStatus', () => {
    it('应该成功更新订单状态', async () => {
      const orderId = 1;
      const status = WithdrawalStatus.PROCESSING;

      mockWithdrawRepository.update.mockResolvedValue({ affected: 1 });

      await service.editStatus(orderId, status);

      expect(mockWithdrawRepository.update).toHaveBeenCalledWith({ id: orderId }, { status });
    });
  });
});
