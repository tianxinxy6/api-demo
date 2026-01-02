import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@/constants';
import { formatToDateTime } from '@/utils/date.util';
import { formatTokenAmount } from '@/utils';

/**
 * 闪兑订单响应模型
 */
export class SwapOrder {
  @ApiProperty({ description: '订单ID', example: 1 })
  id: number;

  @ApiProperty({ description: '订单号', example: 'SW202512310001' })
  orderNo: string;

  @ApiProperty({ description: '源代币代码', example: 'BTC' })
  fromToken: string;

  @ApiProperty({ description: '源代币数量', example: 0.5 })
  fromAmount: number;

  @ApiProperty({ description: '目标代币代码', example: 'ETH' })
  toToken: string;

  @ApiProperty({ description: '目标代币数量', example: 10.5 })
  toAmount: number;

  @ApiProperty({ description: '兑换比例', example: '21.00000000' })
  rate: string;

  @ApiProperty({
    description: '订单状态: 1=成功 0=失败',
    example: Status.Enabled,
    enum: Status,
  })
  status: Status;

  @ApiProperty({ description: '失败原因', example: null, required: false })
  failReason?: string;

  @ApiProperty({ description: '创建时间', example: '2025-12-31 10:30:00' })
  createdAt: string;

  constructor(entity: any) {
    this.id = entity.id;
    this.orderNo = entity.orderNo;
    this.fromToken = entity.fromToken;
    this.fromAmount = Number(formatTokenAmount(entity.fromAmount));
    this.toToken = entity.toToken;
    this.toAmount = Number(formatTokenAmount(entity.toAmount));
    this.rate = entity.rate;
    this.status = entity.status;
    this.failReason = entity.failReason || null;
    this.createdAt = formatToDateTime(entity.createdAt);
  }
}
