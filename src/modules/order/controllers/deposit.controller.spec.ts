import { Test, TestingModule } from '@nestjs/testing';
import { DepositController } from './deposit.controller';
import { DepositService } from '../services/deposit.service';
import { QueryDepositDto } from '../dto/deposit.dto';
import { DepositStatus } from '@/constants';

describe('DepositController', () => {
  let controller: DepositController;
  let depositService: DepositService;

  const mockDepositService = {
    getUserOrders: jest.fn(),
  };

  const mockUser: IAuthUser = {
    uid: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepositController],
      providers: [
        {
          provide: DepositService,
          useValue: mockDepositService,
        },
      ],
    }).compile();

    controller = module.get<DepositController>(DepositController);
    depositService = module.get<DepositService>(DepositService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMyOrders', () => {
    it('应该返回用户的充值订单列表', async () => {
      const queryDto: QueryDepositDto = {
        limit: 20,
      };

      const mockResult: IListRespData = {
        items: [
          {
            id: 1,
            userId: 1,
            chainId: 1,
            token: 'USDT',
            amount: 100.5,
            hash: '0xabc123',
            status: DepositStatus.SETTLED,
          },
        ],
        nextCursor: null,
      };

      mockDepositService.getUserOrders.mockResolvedValue(mockResult);

      const result = await controller.getMyOrders(mockUser, queryDto);

      expect(result).toEqual(mockResult);
      expect(result.items).toHaveLength(1);
      expect(mockDepositService.getUserOrders).toHaveBeenCalledWith(mockUser.uid, queryDto);
    });

    it('应该支持按链ID过滤', async () => {
      const queryDto: QueryDepositDto = {
        chainId: 1,
        limit: 20,
      };

      const mockResult: IListRespData = {
        items: [],
        nextCursor: null,
      };

      mockDepositService.getUserOrders.mockResolvedValue(mockResult);

      await controller.getMyOrders(mockUser, queryDto);

      expect(mockDepositService.getUserOrders).toHaveBeenCalledWith(
        mockUser.uid,
        expect.objectContaining({ chainId: 1 }),
      );
    });

    it('应该支持按代币过滤', async () => {
      const queryDto: QueryDepositDto = {
        token: 'USDT',
        limit: 20,
      };

      const mockResult: IListRespData = {
        items: [],
        nextCursor: null,
      };

      mockDepositService.getUserOrders.mockResolvedValue(mockResult);

      await controller.getMyOrders(mockUser, queryDto);

      expect(mockDepositService.getUserOrders).toHaveBeenCalledWith(
        mockUser.uid,
        expect.objectContaining({ token: 'USDT' }),
      );
    });

    it('应该支持按状态过滤', async () => {
      const queryDto: QueryDepositDto = {
        status: DepositStatus.PENDING,
        limit: 20,
      };

      const mockResult: IListRespData = {
        items: [],
        nextCursor: null,
      };

      mockDepositService.getUserOrders.mockResolvedValue(mockResult);

      await controller.getMyOrders(mockUser, queryDto);

      expect(mockDepositService.getUserOrders).toHaveBeenCalledWith(
        mockUser.uid,
        expect.objectContaining({ status: DepositStatus.PENDING }),
      );
    });

    it('应该支持游标分页', async () => {
      const queryDto: QueryDepositDto = {
        cursor: 100,
        limit: 10,
      };

      const mockResult: IListRespData = {
        items: Array(10).fill({ id: 1, userId: 1 }),
        nextCursor: 90,
      };

      mockDepositService.getUserOrders.mockResolvedValue(mockResult);

      const result = await controller.getMyOrders(mockUser, queryDto);

      expect(result.nextCursor).toBe(90);
      expect(mockDepositService.getUserOrders).toHaveBeenCalledWith(mockUser.uid, queryDto);
    });

    it('应该返回空列表当没有订单时', async () => {
      const queryDto: QueryDepositDto = {
        limit: 20,
      };

      const mockResult: IListRespData = {
        items: [],
        nextCursor: null,
      };

      mockDepositService.getUserOrders.mockResolvedValue(mockResult);

      const result = await controller.getMyOrders(mockUser, queryDto);

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });
  });
});
