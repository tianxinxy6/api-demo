import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SysWalletAddressService } from './sys-wallet.service';
import { SysWalletAddressEntity } from '@/entities/sys-wallet-address.entity';
import { AddressMgrService } from '@/shared/services/wallet.service';
import { AppConfigService } from '@/shared/services/config.service';
import { ChainType, Status, SysWalletType, ErrorCode } from '@/constants';
import { BusinessException } from '@/common/exceptions/biz.exception';

describe('SysWalletAddressService', () => {
  let service: SysWalletAddressService;
  let repository: Repository<SysWalletAddressEntity>;
  let addressMgrService: AddressMgrService;
  let configService: AppConfigService;

  const mockRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockAddressMgrService = {
    generateWallet: jest.fn(),
    storePrivateKey: jest.fn(),
    getPrivateKey: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SysWalletAddressService,
        {
          provide: getRepositoryToken(SysWalletAddressEntity),
          useValue: mockRepository,
        },
        {
          provide: AddressMgrService,
          useValue: mockAddressMgrService,
        },
        {
          provide: AppConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SysWalletAddressService>(SysWalletAddressService);
    repository = module.get<Repository<SysWalletAddressEntity>>(
      getRepositoryToken(SysWalletAddressEntity),
    );
    addressMgrService = module.get<AddressMgrService>(AddressMgrService);
    configService = module.get<AppConfigService>(AppConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('应该在钱包不存在时创建新的系统钱包', async () => {
      const addressInfo = {
        address: '0x1234567890abcdef',
        secKey: 'encrypted-private-key',
        publicKey: '0xpubkey',
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockAddressMgrService.generateWallet.mockResolvedValue(addressInfo);
      mockRepository.save.mockResolvedValue({
        id: 1,
        chainId: 0,
        type: SysWalletType.Fee,
        chainType: ChainType.ETH,
        name: 'wallet',
        address: addressInfo.address,
        key: addressInfo.secKey,
        status: Status.Enabled,
      } as SysWalletAddressEntity);
      mockAddressMgrService.storePrivateKey.mockResolvedValue(undefined);

      await service.create(ChainType.ETH, SysWalletType.Fee);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { chainType: ChainType.ETH, type: SysWalletType.Fee },
      });
      expect(mockAddressMgrService.generateWallet).toHaveBeenCalledWith(ChainType.ETH);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 0,
          type: SysWalletType.Fee,
          chainType: ChainType.ETH,
          name: 'wallet',
          address: addressInfo.address,
          key: addressInfo.secKey,
          status: Status.Enabled,
        }),
      );
      expect(mockAddressMgrService.storePrivateKey).toHaveBeenCalledWith(1, null, addressInfo);
    });

    it('应该在钱包已存在时直接返回', async () => {
      const existingWallet = {
        id: 1,
        chainType: ChainType.ETH,
        type: SysWalletType.Fee,
        address: '0xexisting',
      } as SysWalletAddressEntity;

      mockRepository.findOne.mockResolvedValue(existingWallet);

      await service.create(ChainType.ETH, SysWalletType.Fee);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { chainType: ChainType.ETH, type: SysWalletType.Fee },
      });
      expect(mockAddressMgrService.generateWallet).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('应该创建TRON链的提现钱包', async () => {
      const addressInfo = {
        address: 'TXyz123456789',
        secKey: 'encrypted-tron-key',
        publicKey: 'tron-pubkey',
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockAddressMgrService.generateWallet.mockResolvedValue(addressInfo);
      mockRepository.save.mockResolvedValue({
        id: 2,
        type: SysWalletType.Widthdraw,
        chainType: ChainType.TRON,
        address: addressInfo.address,
      } as SysWalletAddressEntity);
      mockAddressMgrService.storePrivateKey.mockResolvedValue(undefined);

      await service.create(ChainType.TRON, SysWalletType.Widthdraw);

      expect(mockAddressMgrService.generateWallet).toHaveBeenCalledWith(ChainType.TRON);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SysWalletType.Widthdraw,
          chainType: ChainType.TRON,
        }),
      );
    });

    it('应该在生成钱包失败时抛出异常', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockAddressMgrService.generateWallet.mockRejectedValue(
        new Error('Failed to generate wallet'),
      );

      await expect(service.create(ChainType.ETH, SysWalletType.Fee)).rejects.toThrow(
        'Failed to generate wallet',
      );
    });
  });

  describe('getFeeWallet', () => {
    it('应该获取手续费钱包地址的私钥', async () => {
      const mockWallet = {
        id: 1,
        chainType: ChainType.ETH,
        type: SysWalletType.Fee,
        address: '0xfee',
        key: 'encrypted-key',
        status: Status.Enabled,
      } as SysWalletAddressEntity;

      mockRepository.findOne.mockResolvedValue(mockWallet);
      mockAddressMgrService.getPrivateKey.mockResolvedValue('decrypted-private-key');

      const result = await service.getFeeWallet(ChainType.ETH);

      expect(result).toBe('decrypted-private-key');
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          chainType: ChainType.ETH,
          type: SysWalletType.Fee,
          status: Status.Enabled,
        },
      });
      expect(mockAddressMgrService.getPrivateKey).toHaveBeenCalledWith(1, null, 'encrypted-key');
    });
  });

  describe('getWithdrawWallet', () => {
    it('应该获取提现钱包地址的私钥', async () => {
      const mockWallet = {
        id: 2,
        chainType: ChainType.TRON,
        type: SysWalletType.Widthdraw,
        address: 'TWithdraw',
        key: 'encrypted-withdraw-key',
        status: Status.Enabled,
      } as SysWalletAddressEntity;

      mockRepository.findOne.mockResolvedValue(mockWallet);
      mockAddressMgrService.getPrivateKey.mockResolvedValue('tron-private-key');

      const result = await service.getWithdrawWallet(ChainType.TRON);

      expect(result).toBe('tron-private-key');
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          chainType: ChainType.TRON,
          type: SysWalletType.Widthdraw,
          status: Status.Enabled,
        },
      });
    });
  });

  describe('getWallet', () => {
    it('应该成功获取指定类型的系统钱包私钥', async () => {
      const mockWallet = {
        id: 3,
        chainType: ChainType.ETH,
        type: SysWalletType.Fee,
        address: '0xwallet',
        key: 'encrypted-key',
        status: Status.Enabled,
      } as SysWalletAddressEntity;

      mockRepository.findOne.mockResolvedValue(mockWallet);
      mockAddressMgrService.getPrivateKey.mockResolvedValue('private-key-value');

      const result = await service.getWallet(ChainType.ETH, SysWalletType.Fee);

      expect(result).toBe('private-key-value');
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          chainType: ChainType.ETH,
          type: SysWalletType.Fee,
          status: Status.Enabled,
        },
      });
      expect(mockAddressMgrService.getPrivateKey).toHaveBeenCalledWith(3, null, 'encrypted-key');
    });

    it('应该在钱包不存在时抛出异常', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getWallet(ChainType.ETH, SysWalletType.Fee)).rejects.toThrow(
        BusinessException,
      );

      try {
        await service.getWallet(ChainType.ETH, SysWalletType.Fee);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect(error.getErrorCode()).toBe(30101);
      }
    });
  });

  describe('getCollectWalletAddress', () => {
    it('应该从配置中获取归集钱包地址 - ETH', async () => {
      mockConfigService.get.mockResolvedValue('0xcollect-eth-address');

      const result = await service.getCollectWalletAddress('eth');

      expect(result).toBe('0xcollect-eth-address');
      expect(mockConfigService.get).toHaveBeenCalledWith('collect_wallet_address_eth');
    });

    it('应该从配置中获取归集钱包地址 - TRON', async () => {
      mockConfigService.get.mockResolvedValue('TCollectTronAddress');

      const result = await service.getCollectWalletAddress('tron');

      expect(result).toBe('TCollectTronAddress');
      expect(mockConfigService.get).toHaveBeenCalledWith('collect_wallet_address_tron');
    });

    it('应该在配置不存在时返回null', async () => {
      mockConfigService.get.mockResolvedValue(null);

      const result = await service.getCollectWalletAddress('btc');

      expect(result).toBeNull();
      expect(mockConfigService.get).toHaveBeenCalledWith('collect_wallet_address_btc');
    });

    it('应该处理大写链名称', async () => {
      mockConfigService.get.mockResolvedValue('0xaddress');

      const result = await service.getCollectWalletAddress('ETH');

      expect(result).toBe('0xaddress');
      expect(mockConfigService.get).toHaveBeenCalledWith('collect_wallet_address_eth');
    });
  });
});
