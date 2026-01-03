import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { WalletService } from './wallet.service';
import { UserWalletEntity } from '@/entities/user-wallet.entity';
import { UserWalletLogEntity } from '@/entities/user-wallet-log.entity';
import { TokenService } from '@/modules/sys/services/token.service';
import { WalletLogType, WalletStatus, ErrorCode } from '@/constants';
import { BusinessException } from '@/common/exceptions/biz.exception';

describe('WalletService', () => {
  let service: WalletService;
  let userWalletRepository: Repository<UserWalletEntity>;
  let tokenService: TokenService;

  const mockQueryRunner = {
    manager: {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    },
  };

  const mockUserWalletRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTokenService = {
    getAllTokens: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: getRepositoryToken(UserWalletEntity),
          useValue: mockUserWalletRepository,
        },
        {
          provide: TokenService,
          useValue: mockTokenService,
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    userWalletRepository = module.get<Repository<UserWalletEntity>>(
      getRepositoryToken(UserWalletEntity),
    );
    tokenService = module.get<TokenService>(TokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addBalance', () => {
    const params = {
      userId: 1,
      tokenId: 1,
      amount: '1000',
      decimals: 6,
      type: WalletLogType.DEPOSIT,
      orderId: 123,
      remark: '充值',
    };

    it('应该成功增加现有钱包余额', async () => {
      const mockUpdateResult = { affected: 1 };
      const mockWallet = {
        userId: 1,
        tokenId: 1,
        balance: '2000',
        frozenBalance: '0',
      } as UserWalletEntity;

      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(mockUpdateResult),
      });
      mockQueryRunner.manager.findOne.mockResolvedValue(mockWallet);
      mockQueryRunner.manager.create.mockReturnValue({} as UserWalletLogEntity);
      mockQueryRunner.manager.save.mockResolvedValue({} as UserWalletLogEntity);

      const result = await service.addBalance(mockQueryRunner as any, params);

      expect(result).toEqual(mockWallet);
      expect(mockQueryRunner.manager.createQueryBuilder).toHaveBeenCalled();
    });

    it('应该为不存在的钱包创建新记录', async () => {
      const mockUpdateResult = { affected: 0 };
      const mockNewWallet = {
        userId: 1,
        tokenId: 1,
        balance: '1000',
        frozenBalance: '0',
        status: WalletStatus.ACTIVE,
      } as UserWalletEntity;

      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(mockUpdateResult),
      });
      mockQueryRunner.manager.create.mockReturnValue(mockNewWallet);
      mockQueryRunner.manager.save.mockResolvedValue(mockNewWallet);

      const result = await service.addBalance(mockQueryRunner as any, params);

      expect(result).toEqual(mockNewWallet);
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        UserWalletEntity,
        expect.objectContaining({
          userId: 1,
          tokenId: 1,
          balance: '1000',
          decimals: 6,
        }),
      );
    });

    it('应该拒绝无效金额', async () => {
      const invalidParams = { ...params, amount: 'invalid' };

      await expect(service.addBalance(mockQueryRunner as any, invalidParams)).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('subBalance', () => {
    const params = {
      userId: 1,
      tokenId: 1,
      amount: '500',
      decimals: 6,
      type: WalletLogType.WITHDRAWAL,
      orderId: 456,
      remark: '提现',
    };

    it('应该成功减少钱包余额', async () => {
      const mockUpdateResult = { affected: 1 };
      const mockWallet = {
        userId: 1,
        tokenId: 1,
        balance: '1500',
        frozenBalance: '0',
      } as UserWalletEntity;

      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(mockUpdateResult),
      });
      mockQueryRunner.manager.findOne.mockResolvedValue(mockWallet);
      mockQueryRunner.manager.create.mockReturnValue({} as UserWalletLogEntity);
      mockQueryRunner.manager.save.mockResolvedValue({} as UserWalletLogEntity);

      const result = await service.subBalance(mockQueryRunner as any, params);

      expect(result).toEqual(mockWallet);
    });

    it('应该在余额不足时抛出错误', async () => {
      const mockUpdateResult = { affected: 0 };
      const mockWallet = {
        userId: 1,
        tokenId: 1,
        balance: '100',
      } as UserWalletEntity;

      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(mockUpdateResult),
      });
      mockQueryRunner.manager.findOne.mockResolvedValue(mockWallet);

      await expect(service.subBalance(mockQueryRunner as any, params)).rejects.toThrow(
        BusinessException,
      );
    });

    it('应该在钱包不存在时抛出错误', async () => {
      const mockUpdateResult = { affected: 0 };

      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(mockUpdateResult),
      });
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      await expect(service.subBalance(mockQueryRunner as any, params)).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('freezeBalance', () => {
    const params = {
      userId: 1,
      tokenId: 1,
      amount: '500',
      decimals: 6,
      type: WalletLogType.FREEZE,
      orderId: 789,
      remark: '冻结',
    };

    it('应该成功冻结钱包余额', async () => {
      const mockUpdateResult = { affected: 1 };
      const mockWallet = {
        userId: 1,
        tokenId: 1,
        balance: '1000',
        frozenBalance: '500',
      } as UserWalletEntity;

      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(mockUpdateResult),
      });
      mockQueryRunner.manager.findOne.mockResolvedValue(mockWallet);

      const result = await service.freezeBalance(mockQueryRunner as any, params);

      expect(result).toEqual(mockWallet);
    });

    it('应该在可用余额不足时抛出错误', async () => {
      const mockUpdateResult = { affected: 0 };
      const mockWallet = {
        userId: 1,
        tokenId: 1,
        balance: '100',
      } as UserWalletEntity;

      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(mockUpdateResult),
      });
      mockQueryRunner.manager.findOne.mockResolvedValue(mockWallet);

      await expect(service.freezeBalance(mockQueryRunner as any, params)).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('unfreezeBalance', () => {
    const params = {
      userId: 1,
      tokenId: 1,
      amount: '300',
      decimals: 6,
      type: WalletLogType.UNFREEZE,
      orderId: 890,
      remark: '解冻',
    };

    it('应该成功解冻钱包余额', async () => {
      const mockUpdateResult = { affected: 1 };
      const mockWallet = {
        userId: 1,
        tokenId: 1,
        balance: '800',
        frozenBalance: '200',
      } as UserWalletEntity;

      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(mockUpdateResult),
      });
      mockQueryRunner.manager.findOne.mockResolvedValue(mockWallet);

      const result = await service.unfreezeBalance(mockQueryRunner as any, params);

      expect(result).toEqual(mockWallet);
    });

    it('应该在冻结余额不足时抛出错误', async () => {
      const mockUpdateResult = { affected: 0 };
      const mockWallet = {
        userId: 1,
        tokenId: 1,
        frozenBalance: '100',
      } as UserWalletEntity;

      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(mockUpdateResult),
      });
      mockQueryRunner.manager.findOne.mockResolvedValue(mockWallet);

      await expect(service.unfreezeBalance(mockQueryRunner as any, params)).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('subFrozenBalance', () => {
    const params = {
      userId: 1,
      tokenId: 1,
      amount: '200',
      decimals: 6,
      type: WalletLogType.WITHDRAWAL,
      orderId: 999,
      remark: '扣减冻结',
    };

    it('应该成功扣减冻结余额', async () => {
      const mockUpdateResult = { affected: 1 };
      const mockWallet = {
        userId: 1,
        tokenId: 1,
        balance: '1000',
        frozenBalance: '300',
      } as UserWalletEntity;

      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(mockUpdateResult),
      });
      mockQueryRunner.manager.findOne.mockResolvedValue(mockWallet);
      mockQueryRunner.manager.create.mockReturnValue({} as UserWalletLogEntity);
      mockQueryRunner.manager.save.mockResolvedValue({} as UserWalletLogEntity);

      const result = await service.subFrozenBalance(mockQueryRunner as any, params);

      expect(result).toEqual(mockWallet);
    });

    it('应该在冻结余额不足时抛出错误', async () => {
      const mockUpdateResult = { affected: 0 };
      const mockWallet = {
        userId: 1,
        tokenId: 1,
        frozenBalance: '100',
      } as UserWalletEntity;

      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(mockUpdateResult),
      });
      mockQueryRunner.manager.findOne.mockResolvedValue(mockWallet);

      await expect(service.subFrozenBalance(mockQueryRunner as any, params)).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('getUserBalance', () => {
    it('应该返回用户指定代币的钱包余额', async () => {
      const mockWallet = {
        userId: 1,
        tokenId: 1,
        balance: '5000',
        frozenBalance: '1000',
      } as UserWalletEntity;

      mockUserWalletRepository.findOne.mockResolvedValue(mockWallet);

      const result = await service.getUserBalance(1, 1);

      expect(result).toEqual(mockWallet);
      expect(mockUserWalletRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 1, tokenId: 1 },
      });
    });

    it('应该返回null当钱包不存在时', async () => {
      mockUserWalletRepository.findOne.mockResolvedValue(null);

      const result = await service.getUserBalance(1, 999);

      expect(result).toBeNull();
    });
  });

  describe('getAll', () => {
    it('应该返回用户所有钱包', async () => {
      const mockWallets = [
        { userId: 1, tokenId: 1, balance: '1000' },
        { userId: 1, tokenId: 2, balance: '2000' },
      ] as UserWalletEntity[];

      mockUserWalletRepository.find.mockResolvedValue(mockWallets);

      const result = await service.getAll(1);

      expect(result).toEqual(mockWallets);
      expect(mockUserWalletRepository.find).toHaveBeenCalledWith({
        where: { userId: 1 },
        order: { tokenId: 'ASC' },
      });
    });

    it('应该返回空数组当用户没有钱包时', async () => {
      mockUserWalletRepository.find.mockResolvedValue([]);

      const result = await service.getAll(1);

      expect(result).toEqual([]);
    });
  });

  describe('getUserWalletsWithToken', () => {
    it('应该返回带代币信息的钱包列表', async () => {
      const mockWallets = [
        { userId: 1, tokenId: 1, balance: '1000000', frozenBalance: '0', decimals: 6 },
      ] as UserWalletEntity[];

      const mockTokens = [
        { id: 1, code: 'USDT', name: 'Tether USD', logo: 'https://example.com/usdt.png' },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockWallets),
      };

      mockUserWalletRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockTokenService.getAllTokens.mockResolvedValue(mockTokens);

      const result = await service.getUserWalletsWithToken(1);

      expect(result).toHaveLength(1);
      expect(result[0].token.code).toBe('USDT');
      // WalletResponse 构造函数会调用 formatTokenAmount 格式化金额
      // balance '1000000' 和 decimals 6 会格式化为 '1'
      expect(result[0].balance).toBe('1');
      expect(mockTokenService.getAllTokens).toHaveBeenCalled();
    });

    it('应该返回空数组当用户没有钱包时', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockUserWalletRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getUserWalletsWithToken(1);

      expect(result).toEqual([]);
      expect(mockTokenService.getAllTokens).not.toHaveBeenCalled();
    });

    it('应该正确处理代币信息不存在的情况', async () => {
      const mockWallets = [
        { userId: 1, tokenId: 999, balance: '1000', frozenBalance: '0', decimals: 6 },
      ] as UserWalletEntity[];

      const mockTokens = [
        { id: 1, code: 'USDT', name: 'Tether USD', logo: 'https://example.com/usdt.png' },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockWallets),
      };

      mockUserWalletRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockTokenService.getAllTokens.mockResolvedValue(mockTokens);

      const result = await service.getUserWalletsWithToken(1);

      expect(result).toHaveLength(1);
      expect(result[0].token.code).toBe('');
      expect(result[0].token.name).toBe('');
    });
  });
});
