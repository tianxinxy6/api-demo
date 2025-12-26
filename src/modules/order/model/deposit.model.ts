import { ApiProperty } from '@nestjs/swagger';
import { DepositStatus } from '@/constants';

/**
 * 充值订单响应模型
 */
export class DepositOrder {
  @ApiProperty({ description: '订单ID', example: 1 })
  id: number;

  @ApiProperty({ description: '用户ID', example: 1 })
  userId: number;

  @ApiProperty({ description: '区块链ID', example: 1 })
  chainId: number;

  @ApiProperty({ description: '代币代码', example: 'USDT' })
  token: string;

  @ApiProperty({ description: '充值金额', example: 1000000 })
  amount: string;

  @ApiProperty({ description: '区块链交易哈希', example: '0x1234567890abcdef...' })
  hash: string;

  @ApiProperty({ description: '确认区块', example: 12 })
  confirmBlock: number;

  @ApiProperty({ 
    description: '订单状态', 
    example: DepositStatus.PENDING,
    enum: DepositStatus 
  })
  status: DepositStatus;

  @ApiProperty({ description: '转账来源地址', example: 'TXXXxxxXXXXxxxXXXX' })
  from: string;

  @ApiProperty({ description: '转账目标地址', example: 'TYYYyyyYYYYyyyYYYY' })
  to: string;

  @ApiProperty({ description: '区块号', example: 12345678 })
  blockNumber: number;

  @ApiProperty({ description: '失败原因', example: null, required: false })
  failureReason?: string;

  @ApiProperty({ description: '创建时间', example: '2023-01-01T00:00:00Z' })
  createdAt: Date;
}