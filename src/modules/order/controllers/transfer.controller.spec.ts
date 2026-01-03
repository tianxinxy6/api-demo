import { Test, TestingModule } from '@nestjs/testing';
import { TransferController } from './transfer.controller';
import { TransferService } from '../services/transfer.service';
import { CreateTransferDto, QueryTransferDto } from '../dto/transfer.dto';

describe('TransferController', () => {
  let controller: TransferController;
  let transferService: TransferService;

  const mockTransferService = {
    create: jest.fn(),
    getUserOrders: jest.fn(),
  };

  const mockUser: IAuthUser = {
    uid: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransferController],
      providers: [
        {
          provide: TransferService,
          useValue: mockTransferService,
        },
      ],
    }).compile();

    controller = module.get<TransferController>(TransferController);
    transferService = module.get<TransferService>(TransferService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('应该成功创建转账订单并返回订单号', async () => {
      const dto: CreateTransferDto = {
        toUser: 'alice',
        tokenId: 1,
        amount: 100,
        transPassword: '123456',
      };

      const mockOrderNo = 'TR202501010001';
      mockTransferService.create.mockResolvedValue(mockOrderNo);

      const result = await controller.create(mockUser, dto);

      expect(result).toBe(mockOrderNo);
      expect(mockTransferService.create).toHaveBeenCalledWith(mockUser.uid, dto);
    });

    it('应该处理带备注的转账', async () => {
      const dto: CreateTransferDto = {
        toUser: 'bob',
        tokenId: 1,
        amount: 50,
        transPassword: '123456',
        remark: '借款',
      };

      const mockOrderNo = 'TR202501010002';
      mockTransferService.create.mockResolvedValue(mockOrderNo);

      const result = await controller.create(mockUser, dto);

      expect(result).toBe(mockOrderNo);
      expect(mockTransferService.create).toHaveBeenCalledWith(mockUser.uid, dto);
    });
  });

  describe('getMyOrders', () => {
    it('应该返回用户的转账订单列表', async () => {
      const queryDto: QueryTransferDto = {
        limit: 20,
      };

      const mockResult: IListRespData = {
        items: [
          {
            id: 1,
            userId: 1,
            toUserId: 2,
            orderNo: 'TR202501010001',
            token: 'USDT',
            amount: 100,
          },
        ],
        nextCursor: null,
      };

      mockTransferService.getUserOrders.mockResolvedValue(mockResult);

      const result = await controller.getMyOrders(mockUser, queryDto);

      expect(result).toEqual(mockResult);
      expect(result.items).toHaveLength(1);
      expect(mockTransferService.getUserOrders).toHaveBeenCalledWith(mockUser.uid, queryDto);
    });

    it('应该支持按代币ID过滤', async () => {
      const queryDto: QueryTransferDto = {
        tokenId: 1,
        limit: 20,
      };

      const mockResult: IListRespData = {
        items: [],
        nextCursor: null,
      };

      mockTransferService.getUserOrders.mockResolvedValue(mockResult);

      await controller.getMyOrders(mockUser, queryDto);

      expect(mockTransferService.getUserOrders).toHaveBeenCalledWith(
        mockUser.uid,
        expect.objectContaining({ tokenId: 1 }),
      );
    });

    it('应该支持游标分页', async () => {
      const queryDto: QueryTransferDto = {
        cursor: 100,
        limit: 10,
      };

      const mockResult: IListRespData = {
        items: Array(10).fill({ id: 1 }),
        nextCursor: 90,
      };

      mockTransferService.getUserOrders.mockResolvedValue(mockResult);

      const result = await controller.getMyOrders(mockUser, queryDto);

      expect(result.nextCursor).toBe(90);
      expect(mockTransferService.getUserOrders).toHaveBeenCalledWith(mockUser.uid, queryDto);
    });

    it('应该返回空列表当没有订单时', async () => {
      const queryDto: QueryTransferDto = {
        limit: 20,
      };

      const mockResult: IListRespData = {
        items: [],
        nextCursor: null,
      };

      mockTransferService.getUserOrders.mockResolvedValue(mockResult);

      const result = await controller.getMyOrders(mockUser, queryDto);

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });
  });
});
