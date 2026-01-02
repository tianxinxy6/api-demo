import { ApiProperty } from '@nestjs/swagger';
import { WithdrawalStatus } from '@/constants';
import { formatToDateTime } from '@/utils/date.util';
import { formatTokenAmount } from '@/utils';

/**
 * 提现订单响应模型
 */
export class WithdrawOrder {
  @ApiProperty({ description: '订单ID', example: 1 })
  id: number;

  @ApiProperty({ description: '用户ID', example: 1 })
  userId: number;

  @ApiProperty({ description: '订单号', example: '17035123456781234567' })
  orderNo: string;

  @ApiProperty({ description: '区块链ID', example: 1 })
  chainId: number;

  @ApiProperty({ description: '代币代码', example: 'USDT' })
  token: string;

  @ApiProperty({ description: '精度位数', example: 6 })
  decimals: number;

  @ApiProperty({ description: '提现金额', example: 10.5 })
  amount: number;

  @ApiProperty({ description: '手续费', example: 0.5 })
  fee: number;

  @ApiProperty({ description: '实际到账金额', example: 10 })
  actualAmount: number;

  @ApiProperty({ description: '提现地址', example: 'TXXXxxxXXXXxxxXXXX' })
  toAddress: string;

  @ApiProperty({
    description: '订单状态',
    example: WithdrawalStatus.PENDING,
    enum: WithdrawalStatus,
  })
  status: WithdrawalStatus;

  @ApiProperty({
    description: '区块链交易哈希',
    example: '0x1234567890abcdef...',
    required: false,
  })
  hash?: string;

  @ApiProperty({ description: '失败原因', example: null, required: false })
  failureReason?: string;

  @ApiProperty({ description: '审核备注', example: null, required: false })
  remark?: string;

  @ApiProperty({ description: '创建时间', example: '2025-12-20 15:00:00' })
  createdAt: string;

  @ApiProperty({
    description: '完成时间',
    example: '2025-12-20 15:00:00',
    required: false,
  })
  finishedAt?: string;

  constructor(
    partial: Partial<
      Omit<WithdrawOrder, 'createdAt' | 'finishedAt' | 'amount' | 'fee' | 'actualAmount'>
    > & {
      createdAt?: Date;
      finishedAt?: Date;
      amount?: string;
      fee?: string;
      actualAmount?: string;
      decimals: number;
    },
  ) {
    Object.assign(this, partial);

    // 格式化日期
    this.createdAt = partial.createdAt ? formatToDateTime(partial.createdAt) : '';
    this.finishedAt = partial.finishedAt ? formatToDateTime(partial.finishedAt) : undefined;

    // 格式化金额：使用 bigint 安全转换为 number
    this.amount = partial.amount ? Number(formatTokenAmount(partial.amount, partial.decimals)) : 0;
    this.fee = partial.fee ? Number(formatTokenAmount(partial.fee, partial.decimals)) : 0;
    this.actualAmount = partial.actualAmount
      ? Number(formatTokenAmount(partial.actualAmount, partial.decimals))
      : 0;
  }
}
