import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { ChainAddressService } from './chain-address.service';
import { UserWalletAddressEntity } from '@/entities/user-wallet-address.entity';
import { CacheService } from '@/shared/cache/cache.service';
import { AddressMgrService } from '@/shared/services/wallet.service';
import { ChainType, Status, ErrorCode } from '@/constants';
import { BusinessException } from '@/common/exceptions/biz.exception';

describe('ChainAddressService', () => {
  let service: ChainAddressService;
  let walletAddressRepository: Repository<UserWalletAddressEntity>;
  let cacheService: CacheService;
  let addressMgrService: AddressMgrService;

  const mockWalletAddressRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockAddressMgrService = {
    generateWallet: jest.fn(),
    storePrivateKey: jest.fn(),
    getPrivateKey: jest.fn(),
  };

  beforeEach(async () => {
    // Mock Logger to suppress error logs in tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChainAddressService,
        {
          provide: getRepositoryToken(UserWalletAddressEntity),
          useValue: mockWalletAddressRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: AddressMgrService,
          useValue: mockAddressMgrService,
        },
      ],
    }).compile();

    service = module.get<ChainAddressService>(ChainAddressService);
    walletAddressRepository = module.get<Repository<UserWalletAddressEntity>>(
      getRepositoryToken(UserWalletAddressEntity),
    );
    cacheService = module.get<CacheService>(CacheService);
    addressMgrService = module.get<AddressMgrService>(AddressMgrService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAndGet', () => {
    it('应该返回已存在的地址', async () => {
      const mockAddress = {
        id: 1,
        userId: 1,
        chainType: ChainType.ETH,
        address: '0x1234567890123456789012345678901234567890',
        status: Status.Enabled,
        createdAt: new Date(),
      } as UserWalletAddressEntity;

      mockWalletAddressRepository.findOne.mockResolvedValue(mockAddress);

      const result = await service.createAndGet(1, ChainType.ETH);

      expect(result.address).toBe(mockAddress.address);
      expect(result.chainType).toBe(ChainType.ETH);
      expect(mockWalletAddressRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 1, chainType: ChainType.ETH },
      });
      expect(mockAddressMgrService.generateWallet).not.toHaveBeenCalled();
    });

    it('应该为用户创建新的区块链地址', async () => {
      const mockAddressInfo = {
        address: '0xnewaddress',
        secKey: 'encrypted_private_key',
      };

      const mockNewAddress = {
        id: 2,
        userId: 1,
        chainType: ChainType.TRON,
        address: mockAddressInfo.address,
        key: mockAddressInfo.secKey,
        status: Status.Enabled,
        createdAt: new Date(),
      } as UserWalletAddressEntity;

      mockWalletAddressRepository.findOne.mockResolvedValue(null);
      mockAddressMgrService.generateWallet.mockResolvedValue(mockAddressInfo);
      mockWalletAddressRepository.create.mockReturnValue(mockNewAddress);
      mockWalletAddressRepository.save.mockResolvedValue(mockNewAddress);
      mockAddressMgrService.storePrivateKey.mockResolvedValue(undefined);
      mockCacheService.del.mockResolvedValue(undefined);

      const result = await service.createAndGet(1, ChainType.TRON);

      expect(result.address).toBe(mockAddressInfo.address);
      expect(mockAddressMgrService.generateWallet).toHaveBeenCalledWith(ChainType.TRON);
      expect(mockAddressMgrService.storePrivateKey).toHaveBeenCalledWith(
        mockNewAddress.id,
        1,
        mockAddressInfo,
      );
      expect(mockCacheService.del).toHaveBeenCalledWith('user_addresses:1');
    });

    it('应该在生成地址失败时抛出错误', async () => {
      mockWalletAddressRepository.findOne.mockResolvedValue(null);
      mockAddressMgrService.generateWallet.mockRejectedValue(new Error('生成失败'));

      await expect(service.createAndGet(1, ChainType.ETH)).rejects.toThrow();
    });
  });

  describe('findByUserAndChain', () => {
    it('应该根据用户和链类型查找地址', async () => {
      const mockAddress = {
        userId: 1,
        chainType: ChainType.ETH,
        address: '0x1234567890123456789012345678901234567890',
      } as UserWalletAddressEntity;

      mockWalletAddressRepository.findOne.mockResolvedValue(mockAddress);

      const result = await service.findByUserAndChain(1, ChainType.ETH);

      expect(result).toEqual(mockAddress);
      expect(mockWalletAddressRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 1, chainType: ChainType.ETH },
      });
    });

    it('应该返回null当地址不存在时', async () => {
      mockWalletAddressRepository.findOne.mockResolvedValue(null);

      const result = await service.findByUserAndChain(999, ChainType.ETH);

      expect(result).toBeNull();
    });
  });

  describe('findByAddress', () => {
    it('应该根据链类型和地址查找记录', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const mockAddress = {
        chainType: ChainType.ETH,
        address,
        userId: 1,
      } as UserWalletAddressEntity;

      mockWalletAddressRepository.findOne.mockResolvedValue(mockAddress);

      const result = await service.findByAddress(ChainType.ETH, address);

      expect(result).toEqual(mockAddress);
      expect(mockWalletAddressRepository.findOne).toHaveBeenCalledWith({
        where: { chainType: ChainType.ETH, address },
      });
    });

    it('应该返回null当地址不存在时', async () => {
      mockWalletAddressRepository.findOne.mockResolvedValue(null);

      const result = await service.findByAddress(ChainType.ETH, '0xnonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getChainAddresses', () => {
    it('应该从缓存返回用户地址列表', async () => {
      const cachedAddresses = [
        {
          id: 1,
          chainType: ChainType.ETH,
          address: '0xaddress1',
          createdAt: new Date(),
        },
      ];

      mockCacheService.get.mockResolvedValue(cachedAddresses);

      const result = await service.getChainAddresses(1);

      expect(result).toEqual(cachedAddresses);
      expect(mockCacheService.get).toHaveBeenCalledWith('user_addresses:1');
      expect(mockWalletAddressRepository.find).not.toHaveBeenCalled();
    });

    it('应该从数据库查询并缓存地址列表', async () => {
      const mockAddresses = [
        {
          id: 1,
          chainType: ChainType.ETH,
          address: '0xaddress1',
          status: Status.Enabled,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 2,
          chainType: ChainType.TRON,
          address: 'TRXaddress2',
          status: Status.Enabled,
          createdAt: new Date('2024-01-02'),
        },
      ] as UserWalletAddressEntity[];

      mockCacheService.get.mockResolvedValue(null);
      mockWalletAddressRepository.find.mockResolvedValue(mockAddresses);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getChainAddresses(1);

      expect(result).toHaveLength(2);
      expect(result[0].chainType).toBe(ChainType.ETH);
      expect(result[1].chainType).toBe(ChainType.TRON);
      expect(mockWalletAddressRepository.find).toHaveBeenCalledWith({
        where: { userId: 1 },
        order: { createdAt: 'DESC' },
        select: ['id', 'chainType', 'address', 'status', 'createdAt'],
      });
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('应该返回空数组当用户没有地址时', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockWalletAddressRepository.find.mockResolvedValue([]);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getChainAddresses(1);

      expect(result).toEqual([]);
      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  describe('getPrivateKey', () => {
    it('应该成功获取私钥', async () => {
      const mockAddress = {
        id: 1,
        userId: 1,
        chainType: ChainType.ETH,
        address: '0x1234567890123456789012345678901234567890',
        key: 'encrypted_key',
      } as UserWalletAddressEntity;

      const decryptedKey = 'decrypted_private_key';

      mockWalletAddressRepository.findOne.mockResolvedValue(mockAddress);
      mockAddressMgrService.getPrivateKey.mockResolvedValue(decryptedKey);

      const result = await service.getPrivateKey(ChainType.ETH, mockAddress.address);

      expect(result).toBe(decryptedKey);
      expect(mockAddressMgrService.getPrivateKey).toHaveBeenCalledWith(
        mockAddress.id,
        mockAddress.userId,
        mockAddress.key,
      );
    });

    it('应该在地址不存在时抛出错误', async () => {
      mockWalletAddressRepository.findOne.mockResolvedValue(null);

      await expect(service.getPrivateKey(ChainType.ETH, '0xnonexistent')).rejects.toThrow(
        BusinessException,
      );
    });

    it('应该在获取私钥失败时抛出错误', async () => {
      const mockAddress = {
        id: 1,
        userId: 1,
        chainType: ChainType.ETH,
        address: '0x1234567890123456789012345678901234567890',
        key: 'encrypted_key',
      } as UserWalletAddressEntity;

      mockWalletAddressRepository.findOne.mockResolvedValue(mockAddress);
      mockAddressMgrService.getPrivateKey.mockRejectedValue(new Error('解密失败'));

      await expect(service.getPrivateKey(ChainType.ETH, mockAddress.address)).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('getAddressesByChain', () => {
    it('应该返回指定链上的地址列表', async () => {
      const addresses = ['0xaddress1', '0xaddress2', '0xaddress3'];
      const mockAddresses = [
        { address: '0xaddress1' },
        { address: '0xaddress2' },
      ] as UserWalletAddressEntity[];

      mockWalletAddressRepository.find.mockResolvedValue(mockAddresses);

      const result = await service.getAddressesByChain(ChainType.ETH, addresses);

      expect(result).toEqual(['0xaddress1', '0xaddress2']);
      expect(mockWalletAddressRepository.find).toHaveBeenCalledWith({
        where: { chainType: ChainType.ETH, address: expect.anything() },
        select: ['address'],
      });
    });

    it('应该返回空数组当没有匹配的地址时', async () => {
      mockWalletAddressRepository.find.mockResolvedValue([]);

      const result = await service.getAddressesByChain(ChainType.ETH, ['0xnonexistent']);

      expect(result).toEqual([]);
    });
  });

  describe('getUserIdByAddress', () => {
    it('应该根据地址返回用户ID', async () => {
      const mockAddress = {
        userId: 123,
        address: '0x1234567890123456789012345678901234567890',
      } as UserWalletAddressEntity;

      mockWalletAddressRepository.findOne.mockResolvedValue(mockAddress);

      const result = await service.getUserIdByAddress(mockAddress.address);

      expect(result).toBe(123);
      expect(mockWalletAddressRepository.findOne).toHaveBeenCalledWith({
        where: { address: mockAddress.address.toLowerCase() },
        select: ['userId'],
      });
    });

    it('应该返回undefined当地址不存在时', async () => {
      mockWalletAddressRepository.findOne.mockResolvedValue(null);

      const result = await service.getUserIdByAddress('0xnonexistent');

      expect(result).toBeUndefined();
    });

    it('应该处理查询错误并返回undefined', async () => {
      mockWalletAddressRepository.findOne.mockRejectedValue(new Error('数据库错误'));

      const result = await service.getUserIdByAddress('0xaddress');

      expect(result).toBeUndefined();
    });

    it('应该将地址转为小写进行查询', async () => {
      const mockAddress = {
        userId: 456,
      } as UserWalletAddressEntity;

      mockWalletAddressRepository.findOne.mockResolvedValue(mockAddress);

      await service.getUserIdByAddress('0xABCDEF');

      expect(mockWalletAddressRepository.findOne).toHaveBeenCalledWith({
        where: { address: '0xabcdef' },
        select: ['userId'],
      });
    });
  });
});
