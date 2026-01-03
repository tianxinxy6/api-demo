import { Test, TestingModule } from '@nestjs/testing';
import { SwapController } from './swap.controller';
import { SwapService } from '../services/swap.service';
import { CreateSwapDto, QuerySwapDto } from '../dto/swap.dto';
import { Status } from '@/constants';

describe('SwapController', () => {
  let controller: SwapController;
  let swapService: SwapService;

  const mockSwapService = {
    create: jest.fn(),
    getUserOrders: jest.fn(),
  };

  const mockUser: IAuthUser = {
    uid: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SwapController],
      providers: [
        {
          provide: SwapService,
          useValue: mockSwapService,
        },
      ],
    }).compile();

    controller = module.get<SwapController>(SwapController);
    swapService = module.get<SwapService>(SwapService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('应该成功创建闪兑订单', async () => {
      const dto: CreateSwapDto = {
        fromTokenId: 1,
        toTokenId: 2,
        fromAmount: 100,
        transPassword: '123456',
      };

      mockSwapService.create.mockResolvedValue(undefined);

      await controller.create(mockUser, dto);

      expect(mockSwapService.create).toHaveBeenCalledWith(mockUser.uid, dto);
    });

    it('应该处理不同的代币兑换', async () => {
      const dto: CreateSwapDto = {
        fromTokenId: 2,
        toTokenId: 3,
        fromAmount: 50.5,
        transPassword: '123456',
      };

      mockSwapService.create.mockResolvedValue(undefined);

      await controller.create(mockUser, dto);

      expect(mockSwapService.create).toHaveBeenCalledWith(mockUser.uid, dto);
    });
  });

  describe('getMyOrders', () => {
    it('应该返回用户的闪兑订单列表', async () => {
      const queryDto: QuerySwapDto = {
        limit: 20,
      };

      const mockResult: IListRespData = {
        items: [
          {
            id: 1,
            userId: 1,
            orderNo: 'SW202501010001',
            fromToken: 'BTC',
            toToken: 'ETH',
            rate: '15.5',
          },
        ],
        nextCursor: null,
      };

      mockSwapService.getUserOrders.mockResolvedValue(mockResult);

      const result = await controller.getMyOrders(mockUser, queryDto);

      expect(result).toEqual(mockResult);
      expect(result.items).toHaveLength(1);
      expect(mockSwapService.getUserOrders).toHaveBeenCalledWith(mockUser.uid, queryDto);
    });

    it('应该支持按源代币过滤', async () => {
      const queryDto: QuerySwapDto = {
        fromToken: 'BTC',
        limit: 20,
      };

      const mockResult: IListRespData = {
        items: [],
        nextCursor: null,
      };

      mockSwapService.getUserOrders.mockResolvedValue(mockResult);

      await controller.getMyOrders(mockUser, queryDto);

      expect(mockSwapService.getUserOrders).toHaveBeenCalledWith(
        mockUser.uid,
        expect.objectContaining({ fromToken: 'BTC' }),
      );
    });

    it('应该支持按目标代币过滤', async () => {
      const queryDto: QuerySwapDto = {
        toToken: 'USDT',
        limit: 20,
      };

      const mockResult: IListRespData = {
        items: [],
        nextCursor: null,
      };

      mockSwapService.getUserOrders.mockResolvedValue(mockResult);

      await controller.getMyOrders(mockUser, queryDto);

      expect(mockSwapService.getUserOrders).toHaveBeenCalledWith(
        mockUser.uid,
        expect.objectContaining({ toToken: 'USDT' }),
      );
    });

    it('应该支持按状态过滤', async () => {
      const queryDto: QuerySwapDto = {
        status: Status.Enabled,
        limit: 20,
      };

      const mockResult: IListRespData = {
        items: [],
        nextCursor: null,
      };

      mockSwapService.getUserOrders.mockResolvedValue(mockResult);

      await controller.getMyOrders(mockUser, queryDto);

      expect(mockSwapService.getUserOrders).toHaveBeenCalledWith(
        mockUser.uid,
        expect.objectContaining({ status: Status.Enabled }),
      );
    });

    it('应该支持游标分页', async () => {
      const queryDto: QuerySwapDto = {
        cursor: 100,
        limit: 10,
      };

      const mockResult: IListRespData = {
        items: Array(10).fill({ id: 1 }),
        nextCursor: 90,
      };

      mockSwapService.getUserOrders.mockResolvedValue(mockResult);

      const result = await controller.getMyOrders(mockUser, queryDto);

      expect(result.nextCursor).toBe(90);
      expect(mockSwapService.getUserOrders).toHaveBeenCalledWith(mockUser.uid, queryDto);
    });

    it('应该返回空列表当没有订单时', async () => {
      const queryDto: QuerySwapDto = {
        limit: 20,
      };

      const mockResult: IListRespData = {
        items: [],
        nextCursor: null,
      };

      mockSwapService.getUserOrders.mockResolvedValue(mockResult);

      const result = await controller.getMyOrders(mockUser, queryDto);

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });
  });
});
