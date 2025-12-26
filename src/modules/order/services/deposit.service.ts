import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { OrderDepositEntity } from '@/entities/order-deposit.entity';
import { WalletService } from '@/modules/user/services/wallet.service';
import { QueryDepositDto } from '../dto/deposit.dto';
import { DepositOrder } from '../model/deposit.model';
import { DepositStatus, WalletLogType } from '@/constants';
import { BaseTransactionEntity } from '@/common/entities/base-transaction.entity';
import { TokenService } from '@/modules/sys/services/token.service';

@Injectable()
export class DepositService {
  constructor(
    @InjectRepository(OrderDepositEntity)
    private readonly depositRepository: Repository<OrderDepositEntity>,
    private readonly walletService: WalletService,
    private readonly tokenService: TokenService,
  ) { }

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
      throw new BadRequestException(`Deposit order not found for transaction: ${transaction.hash}`);
    }

    if (depositOrder.status !== DepositStatus.PENDING) {
      // 已经处理过，直接返回
      return;
    }
    
    if (success) {
      // 1. 先更新充值订单状态为成功
      const updateResult = await queryRunner.manager.update(OrderDepositEntity, { id: depositOrder.id }, {
        status: DepositStatus.SETTLED,
        confirmBlock: confirmBlock,
        updatedAt: new Date(),
      });

      // 2. 状态更新成功后，增加用户钱包余额
      if (updateResult.affected && updateResult.affected > 0) {
        const token = await this.tokenService.getTokenByCode(depositOrder.token);
        if (!token) {
          return;
        }
        await this.walletService.addBalance(
          queryRunner,
          {
            userId: depositOrder.userId,
            tokenId: token.id, // TODO: 需要根据token符号获取对应的tokenId
            amount: depositOrder.amount, // 直接使用字符串，避免精度丢失
            decimals: token.decimals,
            type: WalletLogType.DEPOSIT,
            orderId: depositOrder.id,
          }
        );
      }
    } else {
      // 更新充值订单状态为失败
      await queryRunner.manager.update(OrderDepositEntity, { id: depositOrder.id }, {
        status: DepositStatus.FAILED,
        failureReason: failureReason || 'Transaction failed',
        updatedAt: new Date(),
      });
    }
  }

  /**
   * 获取用户充值记录
   */
  async getUserDepositOrders(userId: number, queryDto: QueryDepositDto): Promise<IListRespData> {
    const queryBuilder = this.depositRepository.createQueryBuilder('deposit');

    // 强制过滤当前用户
    queryBuilder.andWhere('deposit.userId = :userId', { userId });

    // 应用其他过滤条件
    if (queryDto.chainId) {
      queryBuilder.andWhere('deposit.chainId = :chainId', { chainId: queryDto.chainId });
    }

    if (queryDto.token) {
      queryBuilder.andWhere('deposit.token = :token', { token: queryDto.token });
    }

    if (queryDto.status !== undefined) {
      queryBuilder.andWhere('deposit.status = :status', { status: queryDto.status });
    }

    if (queryDto.startDate) {
      queryBuilder.andWhere('deposit.createdAt >= :startDate', { startDate: queryDto.startDate });
    }

    if (queryDto.endDate) {
      queryBuilder.andWhere('deposit.createdAt <= :endDate', { endDate: queryDto.endDate });
    }

    // 游标分页
    if (queryDto.cursor) {
      queryBuilder.andWhere('deposit.id < :cursor', { cursor: queryDto.cursor });
    }

    // 排序和限制
    queryBuilder
      .orderBy('deposit.id', 'DESC')
      .limit(queryDto.limit || 20);

    const deposits = await queryBuilder.getMany();

    // 计算下一个游标
    const nextCursor = deposits.length > 0 ? deposits[deposits.length - 1].id : null;

    return {
      items: deposits.map(deposit => this.mapToModel(deposit)),
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
      throw new NotFoundException('充值订单不存在');
    }

    return this.mapToModel(deposit);
  }

  /**
   * 将实体转换为响应模型
   */
  private mapToModel(deposit: OrderDepositEntity): DepositOrder {
    return {
      id: deposit.id,
      userId: deposit.userId,
      chainId: deposit.chainId,
      token: deposit.token,
      amount: deposit.amount,
      hash: deposit.hash,
      confirmBlock: deposit.confirmBlock,
      status: deposit.status,
      from: deposit.from,
      to: deposit.to,
      blockNumber: deposit.blockNumber,
      failureReason: deposit.failureReason,
      createdAt: deposit.createdAt,
    };
  }
}