import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, DataSource } from 'typeorm';
import { OrderWithdrawEntity } from '@/entities/order-withdraw.entity';
import { WalletService } from '@/modules/user/services/wallet.service';
import { UserService } from '@/modules/user/services/user.service';
import { TokenService } from '@/modules/sys/services/token.service';
import { TokenService as ChainTokenService } from '@/modules/chain/services/token.service';
import { CreateWithdrawDto, QueryWithdrawDto } from '../dto/withdraw.dto';
import { WithdrawOrder } from '../model/withdraw.model';
import { WithdrawalStatus, WalletLogType } from '@/constants';
import { generateOrderNo } from '@/utils';

@Injectable()
export class WithdrawService {
    constructor(
        @InjectRepository(OrderWithdrawEntity)
        private readonly withdrawRepository: Repository<OrderWithdrawEntity>,
        private readonly walletService: WalletService,
        private readonly userService: UserService,
        private readonly tokenService: TokenService,
        private readonly chainTokenService: ChainTokenService,
        private readonly dataSource: DataSource,
    ) { }

    /**
     * 创建提现订单
     */
    async create(userId: number, dto: CreateWithdrawDto): Promise<string> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // 0. 验证交易密码
            await this.userService.verifyTransferPassword(userId, dto.transPassword);

            // 需要重复提现判断
            const exist = await this.withdrawRepository.findOne({
                where: {
                    userId,
                    status: WithdrawalStatus.PENDING,
                },
            })
            if (exist) {
                throw new BadRequestException('已经有提现订单在处理中，请勿重复提交');
            }

            // 1. 获取代币信息
            const token = await this.tokenService.getTokenById(dto.tokenId);
            if (!token) {
                throw new BadRequestException('代币不支持');
            }
            // 获取链上代币信息
            const chainToken = await this.chainTokenService.getAddressByCode(dto.chainId, token.code);
            if (!chainToken) {
                throw new BadRequestException('代币不存在');
            }

            // 2. 验证金额
            const amount = BigInt(dto.amount * 10 ** chainToken.decimals);
            if (amount <= 0) {
                throw new BadRequestException('提现金额必须大于0');
            }

            // 3. 计算手续费和实际到账金额
            // TODO: 从配置或token表获取手续费率
            const feeRate = BigInt(token.withdrawFee?.rate || 0); // 0% 手续费，可根据需求调整
            let fee = (amount * feeRate) / BigInt(10000);
            // 应用最小和最大手续费限制
            const minFee = BigInt(token.withdrawFee?.min || 0);
            const maxFee = BigInt(token.withdrawFee?.max || 0);
            if (fee < minFee) {
                fee = minFee;
            } else if (fee > maxFee) {
                fee = maxFee;
            }
            const actualAmount = amount - fee;

            // 4. 冻结用户余额
            await this.walletService.freezeBalance(queryRunner, {
                userId,
                tokenId: token.id,
                amount: amount.toString(),
                decimals: token.decimals,
                type: WalletLogType.WITHDRAWAL,
                remark: '提现冻结',
            });

            // 5. 创建提现订单
            const order = queryRunner.manager.create(OrderWithdrawEntity, {
                userId,
                orderNo: generateOrderNo(),
                chainId: dto.chainId,
                token: token.code,
                decimals: token.decimals,
                contract: chainToken.contractAddress,
                to: dto.toAddress,
                amount: amount.toString(),
                fee: fee.toString(),
                actualAmount: actualAmount.toString(),
                toAddress: dto.toAddress,
                status: WithdrawalStatus.PENDING,
            });

            await queryRunner.manager.save(OrderWithdrawEntity, order);

            await queryRunner.commitTransaction();

            return order.orderNo;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * 获取待处理的提现订单
     * 供定时任务调用，查询已审核待转账的订单
     */
    async getPendingWithdraws(chainId: number, limit: number = 10): Promise<OrderWithdrawEntity[]> {
        return await this.withdrawRepository.find({
            where: {
                chainId,
                status: WithdrawalStatus.APPROVED,
            },
            take: limit,
            order: {
                id: 'ASC',
            },
        });
    }

    /**
     * 更新提现订单状态为处理中
     */
    async editStatus(orderId: number, status: WithdrawalStatus): Promise<void> {
        await this.withdrawRepository.update(
            { id: orderId },
            { status },
        );
    }

    /**
     * 取消提现订单
     */
    async cancel(userId: number, orderNo: string): Promise<void> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // 1. 查找订单
            const order = await queryRunner.manager.findOne(OrderWithdrawEntity, {
                where: { orderNo, userId },
            });
            if (!order) {
                throw new NotFoundException('提现订单不存在');
            }

            if (order.status !== WithdrawalStatus.PENDING) {
                throw new BadRequestException('只能取消待审核状态的订单');
            }

            // 2. 更新订单状态
            await queryRunner.manager.update(OrderWithdrawEntity, { id: order.id }, {
                status: WithdrawalStatus.CANCELLED,
                remark: '用户取消',
                updatedAt: new Date(),
            });

            // 3. 解冻用户余额
            const token = await this.tokenService.getTokenByCode(order.token);
            if (token) {
                await this.walletService.unfreezeBalance(queryRunner, {
                    userId,
                    tokenId: token.id,
                    amount: order.amount,
                    decimals: token.decimals,
                    type: WalletLogType.WITHDRAWAL,
                    remark: '提现取消',
                });
            }

            await queryRunner.commitTransaction();
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * 提现完成（链上确认后调用）
     */
    async settle(
        queryRunner: QueryRunner,
        orderId: number,
        hash: string,
    ): Promise<void> {
        // 1. 查找订单
        const order = await queryRunner.manager.findOne(OrderWithdrawEntity, {
            where: { id: orderId },
        });
        if (!order) {
            throw new NotFoundException('提现订单不存在');
        }

        if (order.status !== WithdrawalStatus.PROCESSING && order.status !== WithdrawalStatus.CONFIRMED) {
            throw new BadRequestException('订单状态不正确');
        }

        // 2. 更新订单状态
        await queryRunner.manager.update(OrderWithdrawEntity, { id: orderId }, {
            status: WithdrawalStatus.SETTLED,
            hash,
            finishedAt: new Date(),
        });

        // 3. 扣减冻结余额
        const token = await this.tokenService.getTokenByCode(order.token);
        if (token) {
            await this.walletService.subFrozenBalance(queryRunner, {
                userId: order.userId,
                tokenId: token.id,
                amount: order.amount,
                decimals: token.decimals,
                type: WalletLogType.WITHDRAWAL,
                orderId: order.id,
                remark: '提现成功',
            });
        }
    }

    /**
     * 提现失败
     */
    async fail(queryRunner: QueryRunner, orderId: number, failureReason: string): Promise<void> {
        // 1. 查找订单
        const order = await queryRunner.manager.findOne(OrderWithdrawEntity, {
            where: { id: orderId },
        });
        if (!order) {
            throw new NotFoundException('提现订单不存在');
        }

        // 2. 更新订单状态
        await queryRunner.manager.update(OrderWithdrawEntity, { id: orderId }, {
            status: WithdrawalStatus.FAILED,
            failureReason,
            finishedAt: new Date(),
            updatedAt: new Date(),
        });

        // 3. 解冻用户余额
        const token = await this.tokenService.getTokenByCode(order.token);
        if (token) {
            await this.walletService.unfreezeBalance(queryRunner, {
                userId: order.userId,
                tokenId: token.id,
                amount: order.amount,
                decimals: token.decimals,
                type: WalletLogType.WITHDRAWAL,
                remark: '提现失败',
            });
        }
    }

    /**
     * 获取用户提现记录
     */
    async getUserOrders(userId: number, queryDto: QueryWithdrawDto): Promise<IListRespData> {
        const queryBuilder = this.withdrawRepository.createQueryBuilder('withdraw');

        // 强制过滤当前用户
        queryBuilder.andWhere('withdraw.userId = :userId', { userId });

        // 应用其他过滤条件
        if (queryDto.chainId) {
            queryBuilder.andWhere('withdraw.chainId = :chainId', { chainId: queryDto.chainId });
        }

        if (queryDto.token) {
            queryBuilder.andWhere('withdraw.token = :token', { token: queryDto.token });
        }

        if (queryDto.status !== undefined) {
            queryBuilder.andWhere('withdraw.status = :status', { status: queryDto.status });
        }

        if (queryDto.startDate) {
            queryBuilder.andWhere('withdraw.createdAt >= :startDate', { startDate: queryDto.startDate });
        }

        if (queryDto.endDate) {
            queryBuilder.andWhere('withdraw.createdAt <= :endDate', { endDate: queryDto.endDate });
        }

        // 游标分页
        if (queryDto.cursor) {
            queryBuilder.andWhere('withdraw.id < :cursor', { cursor: queryDto.cursor });
        }

        const limit = queryDto.limit || 20;

        // 排序和限制
        queryBuilder
            .orderBy('withdraw.id', 'DESC')
            .limit(limit);

        const withdraws = await queryBuilder.getMany();

        // 计算下一个游标
        const nextCursor = withdraws.length == limit ? withdraws[withdraws.length - 1].id : null;

        return {
            items: withdraws.map(withdraw => this.mapToModel(withdraw)),
            nextCursor,
        };
    }

    /**
     * 根据ID获取提现订单详情
     */
    async getOrderById(id: number, userId: number): Promise<WithdrawOrder> {
        const where: any = { id, userId };

        const withdraw = await this.withdrawRepository.findOne({ where });
        if (!withdraw) {
            throw new NotFoundException('提现订单不存在');
        }

        return this.mapToModel(withdraw);
    }

    /**
     * 将实体转换为响应模型
     */
    private mapToModel(withdraw: OrderWithdrawEntity): WithdrawOrder {
        return new WithdrawOrder({
            id: withdraw.id,
            userId: withdraw.userId,
            orderNo: withdraw.orderNo,
            chainId: withdraw.chainId,
            token: withdraw.token,
            decimals: withdraw.decimals,
            amount: withdraw.amount,
            fee: withdraw.fee,
            actualAmount: withdraw.actualAmount,
            toAddress: withdraw.to,
            status: withdraw.status,
            hash: withdraw.hash,
            failureReason: withdraw.failureReason,
            createdAt: withdraw.createdAt,
            finishedAt: withdraw.finishedAt,
        });
    }
}
