import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { OrderDepositEntity } from '@/entities/order-deposit.entity';
import { WalletService } from '@/modules/user/services/wallet.service';
import { QueryDepositDto } from '../dto/deposit.dto';
import { DepositOrder } from '../vo/deposit.model';
import { DepositStatus, WalletLogType, ErrorCode } from '@/constants';
import { BaseTransactionEntity } from '@/entities/txs/base.entity';
import { TokenService } from '@/modules/sys/services/token.service';
import { BusinessException } from '@/common/exceptions/biz.exception';

/**
 * 充值订单服务
 * 职责：
 * 1. 创建充值订单（由交易扫描服务调用）
 * 2. 确认充值订单（链上确认后更新状态）
 * 3. 查询用户充值记录
 */
@Injectable()
export class DepositService {
  private readonly logger = new Logger(DepositService.name);

  constructor(
    @InjectRepository(OrderDepositEntity)
    private readonly depositRepository: Repository<OrderDepositEntity>,
    private readonly walletService: WalletService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * 创建充值订单并更新用户钱包 - 使用外部事务
   * 此方法供其他服务在事务中调用，确保整体事务一致性
   */
  async create(
    queryRunner: QueryRunner,
    chainId: number,
    transaction: BaseTransactionEntity,
  ): Promise<OrderDepositEntity> {
    // 检查交易哈希是否已存在
    const exists = await queryRunner.manager.findOne(OrderDepositEntity, {
      where: { hash: transaction.hash },
    });
    if (exists) {
      return exists;
    }

    // 1. 创建充值订单
    const order = queryRunner.manager.create(OrderDepositEntity, {
      userId: transaction.userId,
      chainId,
      token: transaction.token,
      decimals: transaction.decimals,
      amount: transaction.amount,
      hash: transaction.hash,
      from: transaction.from,
      to: transaction.to,
      status: DepositStatus.PENDING,
      blockNumber: transaction.blockNumber || 0,
    });
    return await queryRunner.manager.save(OrderDepositEntity, order);
  }

  /**
   * 确认充值订单
   */
  async confirm(
    queryRunner: QueryRunner,
    transaction: BaseTransactionEntity,
    success?: boolean,
    confirmBlock?: number,
    failureReason?: string,
  ): Promise<void> {
    // 查找对应的充值订单
    const depositOrder = await queryRunner.manager.findOne(OrderDepositEntity, {
      where: { hash: transaction.hash },
    });

    if (!depositOrder) {
      this.logger.warn(`Deposit order not found for transaction: ${transaction.hash}`);
      throw new BusinessException(ErrorCode.ErrDepositTransactionNotFound);
    }

    if (depositOrder.status !== DepositStatus.PENDING) {
      this.logger.debug(`Deposit order already processed: ${depositOrder.id}`);
      return;
    }

    if (success) {
      // 1. 先更新充值订单状态为成功
      const updateResult = await queryRunner.manager.update(
        OrderDepositEntity,
        { id: depositOrder.id },
        {
          status: DepositStatus.SETTLED,
          confirmBlock: confirmBlock,
          updatedAt: new Date(),
        },
      );

      // 2. 状态更新成功后，增加用户钱包余额
      if (updateResult.affected && updateResult.affected > 0) {
        const token = await this.tokenService.getTokenByCode(depositOrder.token);
        if (!token) {
          this.logger.error(`Token not found: ${depositOrder.token}`);
          return;
        }

        await this.walletService.addBalance(queryRunner, {
          userId: depositOrder.userId,
          tokenId: token.id,
          amount: depositOrder.amount,
          decimals: token.decimals,
          type: WalletLogType.DEPOSIT,
          orderId: depositOrder.id,
        });
      }
    } else {
      // 更新充值订单状态为失败
      await queryRunner.manager.update(
        OrderDepositEntity,
        { id: depositOrder.id },
        {
          status: DepositStatus.FAILED,
          failureReason: failureReason || 'Transaction failed',
          updatedAt: new Date(),
        },
      );

      this.logger.warn(`Deposit failed: order=${depositOrder.id}, reason=${failureReason}`);
    }
  }

  /**
   * 获取用户充值记录
   */
  async getUserOrders(userId: number, queryDto: QueryDepositDto): Promise<IListRespData> {
    const queryBuilder = this.depositRepository.createQueryBuilder('deposit');

    // 强制过滤当前用户
    queryBuilder.andWhere('deposit.userId = :userId', { userId });

    // 应用其他过滤条件
    if (queryDto.chainId) {
      queryBuilder.andWhere('deposit.chainId = :chainId', {
        chainId: queryDto.chainId,
      });
    }

    if (queryDto.token) {
      queryBuilder.andWhere('deposit.token = :token', {
        token: queryDto.token,
      });
    }

    if (queryDto.status !== undefined) {
      queryBuilder.andWhere('deposit.status = :status', {
        status: queryDto.status,
      });
    }

    if (queryDto.startDate) {
      queryBuilder.andWhere('deposit.createdAt >= :startDate', {
        startDate: queryDto.startDate,
      });
    }

    if (queryDto.endDate) {
      queryBuilder.andWhere('deposit.createdAt <= :endDate', {
        endDate: queryDto.endDate,
      });
    }

    // 游标分页
    if (queryDto.cursor) {
      queryBuilder.andWhere('deposit.id < :cursor', {
        cursor: queryDto.cursor,
      });
    }

    const limit = queryDto.limit || 20;

    // 排序和限制
    queryBuilder.orderBy('deposit.id', 'DESC').limit(limit);

    const deposits = await queryBuilder.getMany();

    // 计算下一个游标
    const nextCursor = deposits.length == limit ? deposits[deposits.length - 1].id : null;

    return {
      items: deposits.map((deposit) => this.mapToModel(deposit)),
      nextCursor,
    };
  }

  /**
   * 根据ID获取充值订单详情
   */
  async getDepositOrderById(id: number): Promise<DepositOrder> {
    const deposit = await this.depositRepository.findOne({
      where: { id },
    });

    if (!deposit) {
      throw new BusinessException(ErrorCode.ErrDepositNotFound);
    }

    return this.mapToModel(deposit);
  }

  /**
   * 将实体转换为响应模型
   */
  private mapToModel(deposit: OrderDepositEntity): DepositOrder {
    return new DepositOrder({
      id: deposit.id,
      userId: deposit.userId,
      chainId: deposit.chainId,
      token: deposit.token,
      decimals: deposit.decimals,
      amount: deposit.amount,
      hash: deposit.hash,
      confirmBlock: deposit.confirmBlock,
      status: deposit.status,
      from: deposit.from,
      to: deposit.to,
      blockNumber: deposit.blockNumber,
      failureReason: deposit.failureReason,
      createdAt: deposit.createdAt,
    });
  }
}
