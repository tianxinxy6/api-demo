import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OrderTransferEntity } from '@/entities/order-transfer.entity';
import { UserEntity } from '@/entities/user.entity';
import { WalletService } from '@/modules/user/services/wallet.service';
import { UserService } from '@/modules/user/services/user.service';
import { TokenService } from '@/modules/sys/services/token.service';
import { CreateTransferDto, QueryTransferDto } from '../dto/transfer.dto';
import { TransferOrder } from '../model/transfer.model';
import { TransferStatus, WalletLogType, ErrorCode } from '@/constants';
import { generateOrderNo } from '@/utils';
import { BusinessException } from '@/common/exceptions/biz.exception';

/**
 * 转账订单服务
 * 职责：
 * 1. 创建用户间转账订单
 * 2. 查询转账记录
 */
@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);

  constructor(
    @InjectRepository(OrderTransferEntity)
    private readonly transferRepository: Repository<OrderTransferEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly walletService: WalletService,
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 创建转账订单
   */
  async create(userId: number, dto: CreateTransferDto): Promise<string> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 验证交易密码
      await this.userService.verifyTransferPassword(userId, dto.transPassword);

      // 2. 查找转入用户
      const toUser = await this.userService.findUserByUserName(dto.toUser);
      if (!toUser) {
        throw new BusinessException(ErrorCode.ErrTransferUserNotFound);
      }

      if (toUser.id === userId) {
        throw new BusinessException(ErrorCode.ErrTransferSelfForbidden);
      }

      // 获取转出用户信息
      const user = await this.userService.findUserById(userId);
      if (!user) {
        throw new BusinessException(ErrorCode.ErrTransferFromUserNotFound);
      }

      // 3. 获取代币信息
      const token = await this.tokenService.getTokenById(dto.tokenId);
      if (!token) {
        throw new BusinessException(ErrorCode.ErrTransferTokenNotSupported);
      }

      // 4. 验证金额
      const amount = BigInt(dto.amount * 10 ** token.decimals);
      if (amount <= 0) {
        throw new BusinessException(ErrorCode.ErrTransferAmountInvalid);
      }

      // 5. 扣减转出方余额
      await this.walletService.subBalance(queryRunner, {
        userId,
        tokenId: token.id,
        amount: amount.toString(),
        decimals: token.decimals,
        type: WalletLogType.TRANSFER_OUT,
        remark: dto.remark || `转账给 ${toUser.username}`,
      });

      // 6. 增加转入方余额
      await this.walletService.addBalance(queryRunner, {
        userId: toUser.id,
        tokenId: token.id,
        amount: amount.toString(),
        decimals: token.decimals,
        type: WalletLogType.TRANSFER_IN,
        remark: dto.remark || '',
      });

      // 7. 创建转账订单
      const order = queryRunner.manager.create(OrderTransferEntity, {
        userId,
        toUserId: toUser.id,
        orderNo: generateOrderNo(),
        tokenId: token.id,
        token: token.code,
        decimals: token.decimals,
        amount: amount.toString(),
        status: TransferStatus.SUCCESS,
        remark: dto.remark ?? '',
        finishedAt: new Date(),
      });

      await queryRunner.manager.save(OrderTransferEntity, order);

      await queryRunner.commitTransaction();

      return order.orderNo;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Create transfer failed: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 查询用户的转账记录
   */
  async getUserOrders(userId: number, dto: QueryTransferDto): Promise<IListRespData> {
    const queryBuilder = this.transferRepository
      .createQueryBuilder('transfer')
      .where('transfer.userId = :userId', { userId });

    // 按代币筛选
    if (dto.tokenId) {
      queryBuilder.andWhere('transfer.tokenId = :tokenId', { tokenId: dto.tokenId });
    }

    // 按时间范围筛选
    if (dto.startDate) {
      queryBuilder.andWhere('transfer.createdAt >= :startDate', {
        startDate: dto.startDate,
      });
    }
    if (dto.endDate) {
      queryBuilder.andWhere('transfer.createdAt <= :endDate', {
        endDate: dto.endDate,
      });
    }

    // 游标分页
    if (dto.cursor) {
      queryBuilder.andWhere('transfer.id < :cursor', { cursor: dto.cursor });
    }

    const limit = dto.limit || 20;

    // 排序和限制
    queryBuilder
      .orderBy('transfer.id', 'DESC')
      .limit(limit);

    const transfers = await queryBuilder.getMany();

    // 计算下一个游标
    const nextCursor = transfers.length === limit ? transfers[transfers.length - 1].id : null;

    return {
      items: transfers.map(transfer => this.mapToModel(transfer)),
      nextCursor,
    };
  }

  /**
   * 将实体转换为响应模型
   */
  private mapToModel(transfer: OrderTransferEntity): TransferOrder {
    return new TransferOrder({
      id: transfer.id,
      userId: transfer.userId,
      toUserId: transfer.toUserId,
      orderNo: transfer.orderNo,
      tokenId: transfer.tokenId,
      token: transfer.token,
      decimals: transfer.decimals,
      amount: transfer.amount,
      status: transfer.status,
      remark: transfer.remark,
      createdAt: transfer.createdAt,
    });
  }
}
