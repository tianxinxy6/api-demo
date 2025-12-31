import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { OrderSwapEntity } from '@/entities/order-swap.entity';
import { TokenEntity } from '@/entities/token.entity';
import { WalletService } from '@/modules/user/services/wallet.service';
import { UserService } from '@/modules/user/services/user.service';
import { TokenService } from '@/modules/sys/services/token.service';
import { MarketService } from '@/modules/market/market.service';
import { CreateSwapDto, QuerySwapDto } from '../dto/swap.dto';
import { SwapOrder } from '../model/swap.model';
import { Status, WalletLogType, ErrorCode } from '@/constants';
import { generateOrderNo } from '@/utils';
import { BusinessException } from '@/common/exceptions/biz.exception';

/**
 * 闪兑计算结果
 */
interface SwapCalculation {
  fromAmount: bigint;
  toAmount: bigint;
  rate: string;
  fromPrice: string;
  toPrice: string;
}

/**
 * 闪兑服务
 * 职责：代币间实时兑换
 */
@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);
  private readonly DEFAULT_QUOTE = 'USDT';

  constructor(
    @InjectRepository(OrderSwapEntity)
    private readonly swapRepository: Repository<OrderSwapEntity>,
    private readonly walletService: WalletService,
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
    private readonly marketService: MarketService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 验证代币有效性
   */
  private async validateTokens(
    fromTokenId: number,
    toTokenId: number,
  ): Promise<[TokenEntity, TokenEntity]> {
    if (fromTokenId === toTokenId) {
      throw new BusinessException(ErrorCode.ErrSwapSameToken);
    }

    const [fromToken, toToken] = await Promise.all([
      this.tokenService.getTokenById(fromTokenId),
      this.tokenService.getTokenById(toTokenId),
    ]);

    if (!fromToken) {
      throw new BusinessException(ErrorCode.ErrSwapFromTokenNotSupported);
    }
    if (!toToken) {
      throw new BusinessException(ErrorCode.ErrSwapToTokenNotSupported);
    }

    return [fromToken, toToken];
  }

  /**
   * 计算兑换金额和比例
   */
  private async calculateSwap(
    fromToken: TokenEntity,
    toToken: TokenEntity,
    amount: number,
    quote: string = this.DEFAULT_QUOTE,
  ): Promise<SwapCalculation> {
    // 转换为最小单位
    const fromAmount = BigInt(Math.floor(amount * 10 ** fromToken.decimals));
    
    if (fromAmount <= 0n) {
      throw new BusinessException(ErrorCode.ErrSwapAmountInvalid);
    }

    // 获取实时价格
    const [fromPriceData, toPriceData] = await Promise.all([
      this.marketService.getPrice(`${fromToken.code}${quote}`),
      this.marketService.getPrice(`${toToken.code}${quote}`),
    ]);

    // 计算兑换比例和目标金额
    const fromPrice = parseFloat(fromPriceData.price);
    const toPrice = parseFloat(toPriceData.price);
    const rate = fromPrice / toPrice;

    // 计算目标代币数量（保持精度）
    const toAmountFloat = amount * rate;
    const toAmount = BigInt(Math.floor(toAmountFloat * 10 ** toToken.decimals));

    if (toAmount <= 0n) {
      throw new BusinessException(ErrorCode.ErrSwapAmountTooSmall);
    }

    return {
      fromAmount,
      toAmount,
      rate: rate.toFixed(8),
      fromPrice: fromPriceData.price,
      toPrice: toPriceData.price,
    };
  }

  /**
   * 执行钱包操作
   */
  private async executeWalletOperations(
    queryRunner: QueryRunner,
    userId: number,
    fromToken: TokenEntity,
    toToken: TokenEntity,
    calculation: SwapCalculation,
  ): Promise<void> {
    const remark = `闪兑 ${fromToken.code} -> ${toToken.code}`;

    // 扣减源代币余额
    await this.walletService.subBalance(queryRunner, {
      userId,
      tokenId: fromToken.id,
      amount: calculation.fromAmount.toString(),
      decimals: fromToken.decimals,
      type: WalletLogType.SWAP_OUT,
      remark,
    });

    // 增加目标代币余额
    await this.walletService.addBalance(queryRunner, {
      userId,
      tokenId: toToken.id,
      amount: calculation.toAmount.toString(),
      decimals: toToken.decimals,
      type: WalletLogType.SWAP_IN,
      remark,
    });
  }

  /**
   * 创建订单记录
   */
  private createOrderEntity(
    queryRunner: QueryRunner,
    userId: number,
    fromToken: TokenEntity,
    toToken: TokenEntity,
    calculation: SwapCalculation,
    quote: string,
  ): OrderSwapEntity {
    return queryRunner.manager.create(OrderSwapEntity, {
      userId,
      orderNo: generateOrderNo(),
      fromTokenId: fromToken.id,
      fromToken: fromToken.code,
      fromAmount: calculation.fromAmount.toString(),
      toTokenId: toToken.id,
      toToken: toToken.code,
      toAmount: calculation.toAmount.toString(),
      rate: calculation.rate,
      fromPrice: calculation.fromPrice,
      toPrice: calculation.toPrice,
      quote,
      status: Status.Enabled,
    });
  }

  /**
   * 创建闪兑订单
   */
  async create(userId: number, dto: CreateSwapDto): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 验证交易密码
      await this.userService.verifyTransferPassword(userId, dto.transPassword);

      // 2. 验证代币
      const [fromToken, toToken] = await this.validateTokens(
        dto.fromTokenId,
        dto.toTokenId,
      );

      // 3. 计算兑换
      const calculation = await this.calculateSwap(
        fromToken,
        toToken,
        dto.fromAmount,
        this.DEFAULT_QUOTE,
      );

      // 4. 执行钱包操作
      await this.executeWalletOperations(
        queryRunner,
        userId,
        fromToken,
        toToken,
        calculation,
      );

      // 5. 创建订单记录
      const order = this.createOrderEntity(
        queryRunner,
        userId,
        fromToken,
        toToken,
        calculation,
        this.DEFAULT_QUOTE,
      );
      await queryRunner.manager.save(order);

      // 6. 提交事务
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Create swap failed: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 将实体转换为响应模型
   */
  private mapToModel(entity: OrderSwapEntity): SwapOrder {
    return new SwapOrder(entity);
  }

  /**
   * 获取用户闪兑记录
   */
  async getUserOrders(userId: number, queryDto: QuerySwapDto): Promise<IListRespData> {
    const queryBuilder = this.swapRepository.createQueryBuilder('swap');

    // 强制过滤当前用户
    queryBuilder.andWhere('swap.userId = :userId', { userId });

    // 应用其他过滤条件
    if (queryDto.fromToken) {
      queryBuilder.andWhere('swap.fromToken = :fromToken', { fromToken: queryDto.fromToken });
    }

    if (queryDto.toToken) {
      queryBuilder.andWhere('swap.toToken = :toToken', { toToken: queryDto.toToken });
    }

    if (queryDto.status !== undefined) {
      queryBuilder.andWhere('swap.status = :status', { status: queryDto.status });
    }

    if (queryDto.startDate) {
      queryBuilder.andWhere('swap.createdAt >= :startDate', { startDate: queryDto.startDate });
    }

    if (queryDto.endDate) {
      queryBuilder.andWhere('swap.createdAt <= :endDate', { endDate: queryDto.endDate });
    }

    // 游标分页
    if (queryDto.cursor) {
      queryBuilder.andWhere('swap.id < :cursor', { cursor: queryDto.cursor });
    }

    const limit = queryDto.limit || 20;

    // 排序和限制
    queryBuilder
      .orderBy('swap.id', 'DESC')
      .limit(limit);

    const swaps = await queryBuilder.getMany();

    // 计算下一个游标
    const nextCursor = swaps.length == limit ? swaps[swaps.length - 1].id : null;

    return {
      items: swaps.map(swap => this.mapToModel(swap)),
      nextCursor,
    };
  }
}
