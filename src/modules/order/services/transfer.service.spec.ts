import { Test, TestingModule } from '@nestjs/testing';
import { TransferService } from './transfer.service';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrderTransferEntity } from '@/entities/order-transfer.entity';
import { UserEntity } from '@/entities/user.entity';
import { TokenEntity } from '@/entities/token.entity';
import { WalletService } from '@/modules/user/services/wallet.service';
import { UserService } from '@/modules/user/services/user.service';
import { TokenService } from '@/modules/sys/services/token.service';
import { TransferStatus, WalletLogType, Status, TokenStatus } from '@/constants';
import { CreateTransferDto, QueryTransferDto } from '../dto/transfer.dto';
import { BusinessException } from '@/common/exceptions/biz.exception';
import { Logger } from '@nestjs/common';

describe('TransferService', () => {
  let service: TransferService;
  let transferRepository: Repository<OrderTransferEntity>;
  let userRepository: Repository<UserEntity>;
  let walletService: WalletService;
  let userService: UserService;
  let tokenService: TokenService;
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

  const mockTransferRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockUserRepository = {};

  const mockWalletService = {
    addBalance: jest.fn(),
    subBalance: jest.fn(),
  };

  const mockUserService = {
    verifyTransferPassword: jest.fn(),
    findUserByUserName: jest.fn(),
    findUserById: jest.fn(),
  };

  const mockTokenService = {
    getTokenById: jest.fn(),
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferService,
        {
          provide: getRepositoryToken(OrderTransferEntity),
          useValue: mockTransferRepository,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUserRepository,
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
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<TransferService>(TransferService);
    transferRepository = module.get<Repository<OrderTransferEntity>>(
      getRepositoryToken(OrderTransferEntity),
    );
    userRepository = module.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));
    walletService = module.get<WalletService>(WalletService);
    userService = module.get<UserService>(UserService);
    tokenService = module.get<TokenService>(TokenService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('create', () => {
    const mockFromUser: Partial<UserEntity> = {
      id: 1,
      username: 'alice',
      email: 'alice@example.com',
      password: 'hashed',
      transPassword: null,
      avatar: '',
      nickname: '',
      status: Status.Enabled,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockToUser: Partial<UserEntity> = {
      id: 2,
      username: 'bob',
      email: 'bob@example.com',
      password: 'hashed',
      transPassword: null,
      avatar: '',
      nickname: '',
      status: Status.Enabled,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockToken: Partial<TokenEntity> = {
      id: 1,
      code: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      status: TokenStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('应该成功创建转账订单', async () => {
      const userId = 1;
      const dto: CreateTransferDto = {
        toUser: 'bob',
        tokenId: 1,
        amount: 100,
        transPassword: '123456',
      };

      mockUserService.verifyTransferPassword.mockResolvedValue(undefined);
      mockUserService.findUserByUserName.mockResolvedValue(mockToUser);
      mockUserService.findUserById.mockResolvedValue(mockFromUser);
      mockTokenService.getTokenById.mockResolvedValue(mockToken);

      const mockOrder = { id: 1, orderNo: 'TR202501010001' };
      mockQueryRunner.manager.create.mockReturnValue(mockOrder);
      mockQueryRunner.manager.save.mockResolvedValue(mockOrder);
      mockWalletService.subBalance.mockResolvedValue(undefined);
      mockWalletService.addBalance.mockResolvedValue(undefined);

      const result = await service.create(userId, dto);

      expect(result).toBe('TR202501010001');
      expect(mockUserService.verifyTransferPassword).toHaveBeenCalledWith(
        userId,
        dto.transPassword,
      );
      expect(mockUserService.findUserByUserName).toHaveBeenCalledWith(dto.toUser);
      expect(mockTokenService.getTokenById).toHaveBeenCalledWith(dto.tokenId);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('应该在交易密码错误时抛出异常', async () => {
      const userId = 1;
      const dto: CreateTransferDto = {
        toUser: 'bob',
        tokenId: 1,
        amount: 100,
        transPassword: 'wrong',
      };

      mockUserService.verifyTransferPassword.mockRejectedValue(
        new BusinessException('10016:密码错误'),
      );

      await expect(service.create(userId, dto)).rejects.toThrow(BusinessException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('应该在转入用户不存在时抛出异常', async () => {
      const userId = 1;
      const dto: CreateTransferDto = {
        toUser: 'nonexist',
        tokenId: 1,
        amount: 100,
        transPassword: '123456',
      };

      mockUserService.verifyTransferPassword.mockResolvedValue(undefined);
      mockUserService.findUserByUserName.mockResolvedValue(null);

      await expect(service.create(userId, dto)).rejects.toThrow(BusinessException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('应该在转账给自己时抛出异常', async () => {
      const userId = 1;
      const dto: CreateTransferDto = {
        toUser: 'alice',
        tokenId: 1,
        amount: 100,
        transPassword: '123456',
      };

      mockUserService.verifyTransferPassword.mockResolvedValue(undefined);
      mockUserService.findUserByUserName.mockResolvedValue(mockFromUser);

      await expect(service.create(userId, dto)).rejects.toThrow(BusinessException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('应该在代币不支持时抛出异常', async () => {
      const userId = 1;
      const dto: CreateTransferDto = {
        toUser: 'bob',
        tokenId: 999,
        amount: 100,
        transPassword: '123456',
      };

      mockUserService.verifyTransferPassword.mockResolvedValue(undefined);
      mockUserService.findUserByUserName.mockResolvedValue(mockToUser);
      mockUserService.findUserById.mockResolvedValue(mockFromUser);
      mockTokenService.getTokenById.mockResolvedValue(null);

      await expect(service.create(userId, dto)).rejects.toThrow(BusinessException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('应该在金额为0时抛出异常', async () => {
      const userId = 1;
      const dto: CreateTransferDto = {
        toUser: 'bob',
        tokenId: 1,
        amount: 0,
        transPassword: '123456',
      };

      mockUserService.verifyTransferPassword.mockResolvedValue(undefined);
      mockUserService.findUserByUserName.mockResolvedValue(mockToUser);
      mockUserService.findUserById.mockResolvedValue(mockFromUser);
      mockTokenService.getTokenById.mockResolvedValue(mockToken);

      await expect(service.create(userId, dto)).rejects.toThrow(BusinessException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('应该正确执行钱包扣减和增加操作', async () => {
      const userId = 1;
      const dto: CreateTransferDto = {
        toUser: 'bob',
        tokenId: 1,
        amount: 50,
        transPassword: '123456',
        remark: '借款',
      };

      mockUserService.verifyTransferPassword.mockResolvedValue(undefined);
      mockUserService.findUserByUserName.mockResolvedValue(mockToUser);
      mockUserService.findUserById.mockResolvedValue(mockFromUser);
      mockTokenService.getTokenById.mockResolvedValue(mockToken);

      const mockOrder = { id: 1, orderNo: 'TR202501010001' };
      mockQueryRunner.manager.create.mockReturnValue(mockOrder);
      mockQueryRunner.manager.save.mockResolvedValue(mockOrder);
      mockWalletService.subBalance.mockResolvedValue(undefined);
      mockWalletService.addBalance.mockResolvedValue(undefined);

      await service.create(userId, dto);

      expect(mockWalletService.subBalance).toHaveBeenCalledWith(
        mockQueryRunner,
        expect.objectContaining({
          userId,
          tokenId: mockToken.id,
          type: WalletLogType.TRANSFER_OUT,
        }),
      );

      expect(mockWalletService.addBalance).toHaveBeenCalledWith(
        mockQueryRunner,
        expect.objectContaining({
          userId: mockToUser.id,
          tokenId: mockToken.id,
          type: WalletLogType.TRANSFER_IN,
        }),
      );
    });

    it('应该在余额不足时回滚事务', async () => {
      const userId = 1;
      const dto: CreateTransferDto = {
        toUser: 'bob',
        tokenId: 1,
        amount: 1000,
        transPassword: '123456',
      };

      mockUserService.verifyTransferPassword.mockResolvedValue(undefined);
      mockUserService.findUserByUserName.mockResolvedValue(mockToUser);
      mockUserService.findUserById.mockResolvedValue(mockFromUser);
      mockTokenService.getTokenById.mockResolvedValue(mockToken);

      const mockOrder = { id: 1, orderNo: 'TR202501010001' };
      mockQueryRunner.manager.create.mockReturnValue(mockOrder);
      mockWalletService.subBalance.mockRejectedValue(new BusinessException('10035:钱包余额不足'));

      await expect(service.create(userId, dto)).rejects.toThrow(BusinessException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('getUserOrders', () => {
    it('应该返回用户的转账订单列表', async () => {
      const userId = 1;
      const dto: QueryTransferDto = {
        limit: 20,
      };

      const mockOrders: Partial<OrderTransferEntity>[] = [
        {
          id: 1,
          userId: 1,
          toUserId: 2,
          orderNo: 'TR202501010001',
          tokenId: 1,
          token: 'USDT',
          decimals: 6,
          amount: '100000000' as any,
          status: TransferStatus.SUCCESS,
          remark: '',
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

      mockTransferRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getUserOrders(userId, dto);

      expect(result.items).toHaveLength(1);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('transfer.userId = :userId', { userId });
    });

    it('应该支持按代币ID过滤', async () => {
      const userId = 1;
      const dto: QueryTransferDto = {
        tokenId: 1,
        limit: 20,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockTransferRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getUserOrders(userId, dto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('transfer.tokenId = :tokenId', {
        tokenId: 1,
      });
    });

    it('应该支持游标分页', async () => {
      const userId = 1;
      const dto: QueryTransferDto = {
        cursor: 100,
        limit: 10,
      };

      const mockOrders = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: 100 - i,
          userId: 1,
          toUserId: 2,
          orderNo: `TR20250101000${i}`,
          tokenId: 1,
          token: 'USDT',
          decimals: 6,
          amount: '50000000' as any,
          status: TransferStatus.SUCCESS,
          remark: '',
          finishedAt: new Date(),
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

      mockTransferRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getUserOrders(userId, dto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('transfer.id < :cursor', {
        cursor: 100,
      });
      expect(result.items).toHaveLength(10);
      expect(result.nextCursor).toBe(91);
    });

    it('应该返回空列表当没有订单时', async () => {
      const userId = 1;
      const dto: QueryTransferDto = {
        limit: 20,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockTransferRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getUserOrders(userId, dto);

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });

    it('应该按ID降序排列', async () => {
      const userId = 1;
      const dto: QueryTransferDto = {
        limit: 20,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockTransferRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getUserOrders(userId, dto);

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('transfer.id', 'DESC');
    });
  });
});
