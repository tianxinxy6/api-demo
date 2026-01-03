import { Test, TestingModule } from '@nestjs/testing';
import { WithdrawController } from './withdraw.controller';
import { WithdrawService } from '../services/withdraw.service';
import { CreateWithdrawDto, QueryWithdrawDto } from '../dto/withdraw.dto';
import { WithdrawalStatus, ChainType } from '@/constants';

describe('WithdrawController', () => {
  let controller: WithdrawController;
  let withdrawService: WithdrawService;

  const mockWithdrawService = {
    create: jest.fn(),
    cancel: jest.fn(),
    getUserOrders: jest.fn(),
    getOrderById: jest.fn(),
  };

  const mockUser: IAuthUser = {
    uid: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WithdrawController],
      providers: [
        {
          provide: WithdrawService,
          useValue: mockWithdrawService,
        },
      ],
    }).compile();

    controller = module.get<WithdrawController>(WithdrawController);
    withdrawService = module.get<WithdrawService>(WithdrawService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('应该成功创建提现订单并返回订单号', async () => {
      const dto: CreateWithdrawDto = {
        chainId: ChainType.ETH,
        tokenId: 1,
        amount: 100,
        toAddress: '0x1234567890abcdef1234567890abcdef12345678',
        transPassword: '123456',
      };

      const mockOrderNo = 'WD202501010001';
      mockWithdrawService.create.mockResolvedValue(mockOrderNo);

      const result = await controller.create(mockUser, dto);

      expect(result).toBe(mockOrderNo);
      expect(mockWithdrawService.create).toHaveBeenCalledWith(mockUser.uid, dto);
    });
  });

  describe('cancel', () => {
    it('应该成功取消提现订单', async () => {
      const orderNo = 'WD202501010001';

      mockWithdrawService.cancel.mockResolvedValue(undefined);

      await controller.cancel(mockUser, orderNo);

      expect(mockWithdrawService.cancel).toHaveBeenCalledWith(mockUser.uid, orderNo);
    });
  });

  describe('getMyOrders', () => {
    it('应该返回用户的提现订单列表', async () => {
      const queryDto: QueryWithdrawDto = {
        limit: 20,
      };

      const mockResult: IListRespData = {
        items: [
          {
            id: 1,
            userId: 1,
            orderNo: 'WD202501010001',
            token: 'USDT',
            amount: 100,
            status: WithdrawalStatus.PENDING,
          },
        ],
        nextCursor: null,
      };

      mockWithdrawService.getUserOrders.mockResolvedValue(mockResult);

      const result = await controller.getMyOrders(mockUser, queryDto);

      expect(result).toEqual(mockResult);
      expect(result.items).toHaveLength(1);
      expect(mockWithdrawService.getUserOrders).toHaveBeenCalledWith(mockUser.uid, queryDto);
    });

    it('应该支持按链ID过滤', async () => {
      const queryDto: QueryWithdrawDto = {
        chainId: ChainType.ETH,
        limit: 20,
      };

      const mockResult: IListRespData = {
        items: [],
        nextCursor: null,
      };

      mockWithdrawService.getUserOrders.mockResolvedValue(mockResult);

      await controller.getMyOrders(mockUser, queryDto);

      expect(mockWithdrawService.getUserOrders).toHaveBeenCalledWith(
        mockUser.uid,
        expect.objectContaining({ chainId: ChainType.ETH }),
      );
    });

    it('应该支持按状态过滤', async () => {
      const queryDto: QueryWithdrawDto = {
        status: WithdrawalStatus.SETTLED,
        limit: 20,
      };

      const mockResult: IListRespData = {
        items: [],
        nextCursor: null,
      };

      mockWithdrawService.getUserOrders.mockResolvedValue(mockResult);

      await controller.getMyOrders(mockUser, queryDto);

      expect(mockWithdrawService.getUserOrders).toHaveBeenCalledWith(
        mockUser.uid,
        expect.objectContaining({ status: WithdrawalStatus.SETTLED }),
      );
    });

    it('应该返回空列表当没有订单时', async () => {
      const queryDto: QueryWithdrawDto = {
        limit: 20,
      };

      const mockResult: IListRespData = {
        items: [],
        nextCursor: null,
      };

      mockWithdrawService.getUserOrders.mockResolvedValue(mockResult);

      const result = await controller.getMyOrders(mockUser, queryDto);

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('getOrder', () => {
    it('应该返回指定ID的提现订单', async () => {
      const orderId = 1;

      const mockOrder = {
        id: 1,
        userId: 1,
        orderNo: 'WD202501010001',
        token: 'USDT',
        amount: 100,
        status: WithdrawalStatus.SETTLED,
      };

      mockWithdrawService.getOrderById.mockResolvedValue(mockOrder);

      const result = await controller.getOrder(mockUser, orderId);

      expect(result).toEqual(mockOrder);
      expect(mockWithdrawService.getOrderById).toHaveBeenCalledWith(orderId, mockUser.uid);
    });
  });
});
