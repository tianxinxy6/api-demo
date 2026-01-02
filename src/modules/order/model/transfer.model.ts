import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransferStatus } from '@/constants';
import { formatToDateTime } from '@/utils/date.util';
import { formatTokenAmount } from '@/utils';

/**
 * 转账订单响应模型
 */
export class TransferOrder {
  @ApiProperty({ description: '订单ID', example: 1 })
  id: number;

  @ApiProperty({ description: '转出用户ID', example: 1 })
  userId: number;

  @ApiProperty({ description: '转入用户ID', example: 2 })
  toUserId: number;

  @ApiProperty({ description: '订单号', example: '17035123456781234567' })
  orderNo: string;

  @ApiProperty({ description: '代币ID', example: 1 })
  tokenId: number;

  @ApiProperty({ description: '代币代码', example: 'USDT' })
  token: string;

  @ApiProperty({ description: '精度位数', example: 6 })
  decimals: number;

  @ApiProperty({ description: '转账金额', example: 100.5 })
  amount: number;

  @ApiProperty({
    description: '订单状态',
    example: TransferStatus.SUCCESS,
    enum: TransferStatus,
  })
  status: TransferStatus;

  @ApiPropertyOptional({ description: '备注', example: '转账备注' })
  remark?: string;

  @ApiProperty({ description: '创建时间', example: '2025-12-29 15:00:00' })
  createdAt: string;

  constructor(
    partial: Partial<Omit<TransferOrder, 'createdAt' | 'amount'>> & {
      createdAt?: Date;
      amount?: string;
      decimals: number;
    },
  ) {
    Object.assign(this, partial);

    // 格式化日期
    this.createdAt = partial.createdAt ? formatToDateTime(partial.createdAt) : '';

    // 格式化金额：使用 bigint 安全转换为 number
    this.amount = partial.amount ? Number(formatTokenAmount(partial.amount, partial.decimals)) : 0;
  }
}
