import { IsOptional, IsNumber, IsString, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { WithdrawalStatus } from '@/constants';
import { DateDto } from '@/common/dto/date.dto';

/**
 * 创建提现订单DTO
 */
export class CreateWithdrawDto {
  @ApiProperty({ description: '区块链ID', example: 1 })
  @IsNotEmpty({ message: '区块链ID不能为空' })
  @IsNumber({}, { message: '区块链ID必须是数字' })
  @Type(() => Number)
  chainId: number;

  @ApiProperty({ description: '代币', example: 1 })
  @IsNotEmpty({ message: '代币代码不能为空' })
  @IsNumber({}, { message: '代币ID必须是数字' })
  @Type(() => Number)
  tokenId: number;

  @ApiProperty({ description: '提现金额', example: '1000000' })
  @IsNotEmpty({ message: '提现金额不能为空' })
  @IsNumber({}, { message: '提现金额必须是数字' })
  @Type(() => Number)
  amount: number;

  @ApiProperty({ description: '提现地址', example: 'TXXXxxxXXXXxxxXXXX' })
  @IsNotEmpty({ message: '提现地址不能为空' })
  @IsString({ message: '提现地址必须是字符串' })
  toAddress: string;

  @ApiProperty({ description: '交易密码', example: '123456' })
  @IsNotEmpty({ message: '交易密码不能为空' })
  @IsString({ message: '交易密码必须是字符串' })
  transPassword: string;
}

/**
 * 查询提现记录DTO
 */
export class QueryWithdrawDto extends DateDto {
  @ApiPropertyOptional({ description: '区块链ID', example: 1 })
  @IsOptional()
  @IsNumber({}, { message: '区块链ID必须是数字' })
  @Type(() => Number)
  chainId?: number;

  @ApiPropertyOptional({ description: '代币代码', example: 'USDT' })
  @IsOptional()
  @IsString({ message: '代币代码必须是字符串' })
  token?: string;

  @ApiPropertyOptional({ 
    description: '订单状态', 
    example: WithdrawalStatus.PENDING,
    enum: WithdrawalStatus 
  })
  @IsOptional()
  @IsEnum(WithdrawalStatus, { message: '订单状态值无效' })
  @Type(() => Number)
  status?: WithdrawalStatus;
}

/**
 * 取消提现订单DTO
 */
export class CancelWithdrawDto {
  @ApiProperty({ description: '订单号', example: '17035123456781234567' })
  @IsNotEmpty({ message: '订单号不能为空' })
  @IsString({ message: '订单号必须是字符串' })
  orderNo: string;
}
