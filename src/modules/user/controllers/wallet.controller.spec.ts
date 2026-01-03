import { Test, TestingModule } from '@nestjs/testing';
import { WalletController } from './wallet.controller';
import { ChainAddressService } from '../services/chain-address.service';
import { WalletService } from '../services/wallet.service';
import { ChainType } from '@/constants';
import { WalletResponse, ChainAddressResponse, WalletTokenInfo } from '../vo';

describe('WalletController', () => {
  let controller: WalletController;
  let chainAddressService: ChainAddressService;
  let walletService: WalletService;

  const mockWalletService = {
    getUserWalletsWithToken: jest.fn(),
  };

  const mockChainAddressService = {
    getChainAddresses: jest.fn(),
    createAndGet: jest.fn(),
  };

  const mockUser: IAuthUser = {
    uid: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        {
          provide: WalletService,
          useValue: mockWalletService,
        },
        {
          provide: ChainAddressService,
          useValue: mockChainAddressService,
        },
      ],
    }).compile();

    controller = module.get<WalletController>(WalletController);
    walletService = module.get<WalletService>(WalletService);
    chainAddressService = module.get<ChainAddressService>(ChainAddressService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMyWallets', () => {
    it('应该返回用户钱包列表', async () => {
      const mockWallets: WalletResponse[] = [
        new WalletResponse({
          token: new WalletTokenInfo({
            code: 'USDT',
            name: 'Tether USD',
            logo: 'https://example.com/usdt.png',
          }),
          balance: '10000000',
          frozenBalance: '0',
          decimals: 6,
        }),
      ];

      mockWalletService.getUserWalletsWithToken.mockResolvedValue(mockWallets);

      const result = await controller.getMyWallets(mockUser);

      expect(result).toEqual(mockWallets);
      expect(mockWalletService.getUserWalletsWithToken).toHaveBeenCalledWith(mockUser.uid);
    });

    it('应该返回空数组当用户没有钱包时', async () => {
      mockWalletService.getUserWalletsWithToken.mockResolvedValue([]);

      const result = await controller.getMyWallets(mockUser);

      expect(result).toEqual([]);
      expect(mockWalletService.getUserWalletsWithToken).toHaveBeenCalledWith(mockUser.uid);
    });
  });

  describe('getAddresses', () => {
    it('应该返回用户所有区块链地址', async () => {
      const mockAddresses: ChainAddressResponse[] = [
        new ChainAddressResponse({
          id: 1,
          chainType: ChainType.ETH,
          address: '0x1234567890123456789012345678901234567890',
          createdAt: new Date(),
        }),
      ];

      mockChainAddressService.getChainAddresses.mockResolvedValue(mockAddresses);

      const result = await controller.getAddresses(mockUser);

      expect(result).toEqual(mockAddresses);
      expect(mockChainAddressService.getChainAddresses).toHaveBeenCalledWith(mockUser.uid);
    });

    it('应该返回空数组当用户没有区块链地址时', async () => {
      mockChainAddressService.getChainAddresses.mockResolvedValue([]);

      const result = await controller.getAddresses(mockUser);

      expect(result).toEqual([]);
      expect(mockChainAddressService.getChainAddresses).toHaveBeenCalledWith(mockUser.uid);
    });
  });

  describe('getOrCreateAddress', () => {
    it('应该返回已存在的区块链地址', async () => {
      const mockAddress = new ChainAddressResponse({
        id: 1,
        chainType: ChainType.ETH,
        address: '0x1234567890123456789012345678901234567890',
        createdAt: new Date(),
      });

      mockChainAddressService.createAndGet.mockResolvedValue(mockAddress);

      const result = await controller.getOrCreateAddress(mockUser, ChainType.ETH);

      expect(result).toEqual(mockAddress);
      expect(mockChainAddressService.createAndGet).toHaveBeenCalledWith(
        mockUser.uid,
        ChainType.ETH,
      );
    });

    it('应该创建新的TRON链地址', async () => {
      const newAddress = new ChainAddressResponse({
        id: 2,
        chainType: ChainType.TRON,
        address: 'TRXAddress123456789012345678901234',
        createdAt: new Date(),
      });

      mockChainAddressService.createAndGet.mockResolvedValue(newAddress);

      const result = await controller.getOrCreateAddress(mockUser, ChainType.TRON);

      expect(result).toEqual(newAddress);
      expect(mockChainAddressService.createAndGet).toHaveBeenCalledWith(
        mockUser.uid,
        ChainType.TRON,
      );
    });
  });
});
