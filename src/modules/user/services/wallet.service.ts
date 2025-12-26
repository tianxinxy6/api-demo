import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { UserWalletEntity } from '@/entities/user-wallet.entity';
import { UserWalletLogEntity } from '@/entities/user-wallet-log.entity';
import { WalletLogType, WalletStatus } from '@/constants';

export interface editBalanceParams {
  userId: number;
  tokenId: number;
  amount: string; // 增加的金额，必须为正数
  decimals: number;
  type: WalletLogType;
  orderId?: number;
  remark?: string;
}

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(UserWalletEntity)
    private readonly userWalletRepository: Repository<UserWalletEntity>,
  ) {}

  /**
   * 使用原子操作增加用户钱包余额
   * @param queryRunner 事务查询器
   * @param params 增加参数
   */
  async addBalance(
    queryRunner: QueryRunner,
    params: editBalanceParams,
  ): Promise<UserWalletEntity> {
    const { userId, tokenId, amount } = params;
    const addAmount = BigInt(amount);
    if (addAmount <= 0) {
      throw new Error('增加金额必须大于0');
    }

    // 尝试原子更新现有记录
    const updateResult = await queryRunner.manager
      .createQueryBuilder()
      .update(UserWalletEntity)
      .set({
        balance: () => `CAST(balance AS DECIMAL(30,0)) + ${addAmount.toString()}`,
      })
      .where('userId = :userId AND tokenId = :tokenId', { userId, tokenId })
      .execute();

    let userWallet: UserWalletEntity;
    let beforeBalance: string;

    if (updateResult.affected === 0) {
      // 记录不存在，创建新记录
      try {
        userWallet = await this.createNewWallet(
          queryRunner,
          userId,
          tokenId,
          addAmount.toString(),
          params.decimals,
        );
        beforeBalance = '0';
      } catch (error) {
        // 唯一索引冲突，递归重试
        return this.addBalance(queryRunner, params);
      }
    } else {
      // 更新成功，获取更新后的记录
      userWallet = await queryRunner.manager.findOne(UserWalletEntity, {
        where: { userId, tokenId },
      });
      if (!userWallet) {
        throw new Error('钱包记录更新异常');
      }

      beforeBalance = (BigInt(userWallet.balance) - addAmount).toString();
    }

    // 创建钱包变动日志
    await this.createWalletLog(queryRunner, params, beforeBalance, userWallet.balance);

    return userWallet;
  }

  /**
   * 使用原子操作减少用户钱包余额
   * @param queryRunner 事务查询器
   * @param params 减少参数
   */
  async subBalance(
    queryRunner: QueryRunner,
    params: editBalanceParams,
  ): Promise<UserWalletEntity> {
    const { userId, tokenId, amount } = params;
    const subAmount = BigInt(amount);
    if (subAmount <= 0) {
      throw new Error('减少金额必须大于0');
    }

    // 尝试原子更新现有记录，同时检查余额是否足够
    const updateResult = await queryRunner.manager
      .createQueryBuilder()
      .update(UserWalletEntity)
      .set({
        balance: () => `CAST(balance AS DECIMAL(30,0)) - ${subAmount.toString()}`,
      })
      .where('userId = :userId AND tokenId = :tokenId', { userId, tokenId })
      .andWhere(`CAST(balance AS DECIMAL(30,0)) - ${subAmount.toString()} >= 0`)
      .execute();

    if (updateResult.affected === 0) {
      // 记录不存在或余额不足
      const existingWallet = await queryRunner.manager.findOne(UserWalletEntity, {
        where: { userId, tokenId },
      });

      if (!existingWallet) {
        throw new NotFoundException('钱包记录不存在');
      } else {
        throw new NotFoundException('余额不足');
      }
    }

    // 更新成功，获取更新后的记录
    const userWallet = await queryRunner.manager.findOne(UserWalletEntity, {
      where: { userId, tokenId },
    });
    if (!userWallet) {
      throw new Error('钱包记录更新异常');
    }

    const beforeBalance = (BigInt(userWallet.balance) + subAmount).toString();

    // 创建钱包变动日志（记录为负数表示减少）
    await this.createWalletLog(
      queryRunner,
      {
        ...params,
        amount: `-${subAmount.toString()}`, // 日志中记录为负数
      },
      beforeBalance,
      userWallet.balance,
    );

    return userWallet;
  }

  /**
   * 创建钱包变动日志的私有方法
   * @private
   */
  private async createWalletLog(
    queryRunner: QueryRunner,
    params: editBalanceParams,
    beforeBalance: string,
    afterBalance: string,
  ): Promise<void> {
    const { userId, tokenId, amount, type, orderId, remark } = params;
    
    const walletLog = queryRunner.manager.create(UserWalletLogEntity, {
      userId,
      tokenId,
      type,
      amount,
      beforeBalance,
      afterBalance,
      orderId: orderId || 0,
      remark,
    });
    
    await queryRunner.manager.save(UserWalletLogEntity, walletLog);
  }

  /**
   * 创建新钱包记录的私有方法
   * @private
   */
  private async createNewWallet(
    queryRunner: QueryRunner,
    userId: number,
    tokenId: number,
    balance: string,
    decimals: number,
  ): Promise<UserWalletEntity> {
    const userWallet = queryRunner.manager.create(UserWalletEntity, {
      userId,
      tokenId,
      balance,
      decimals,
      frozenBalance: '0',
      status: WalletStatus.ACTIVE,
    });
    
    await queryRunner.manager.save(UserWalletEntity, userWallet);
    return userWallet;
  }

  /**
   * 获取用户钱包余额
   */
  async getUserBalance(userId: number, tokenId: number): Promise<UserWalletEntity | null> {
    return await this.userWalletRepository.findOne({
      where: { userId, tokenId },
    });
  }

  /**
   * 获取用户所有钱包
   */
  async getAll(userId: number): Promise<UserWalletEntity[]> {
    return await this.userWalletRepository.find({
      where: { userId },
      order: { tokenId: 'ASC' },
    });
  }
}