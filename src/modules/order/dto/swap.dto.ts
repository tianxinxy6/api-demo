import { IsNotEmpty, IsNumber, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Status } from '@/constants';
import { DateDto } from '@/common/dto/date.dto';

/**
 * 创建闪兑订单请求
 */
export class CreateSwapDto {
  @ApiProperty({ description: '源代币ID', example: 1 })
  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  fromTokenId: number;

  @ApiProperty({ description: '目标代币ID', example: 2 })
  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  toTokenId: number;

  @ApiProperty({ description: '源代币数量(实际值)', example: 0.5 })
  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  fromAmount: number;

  @ApiProperty({ description: '交易密码', example: '123456' })
  @IsString()
  @IsNotEmpty()
  transPassword: string;
}

/**
 * 查询闪兑记录DTO
 */
export class QuerySwapDto extends DateDto {
  @ApiPropertyOptional({ description: '源代币代码', example: 'BTC' })
  @IsOptional()
  @IsString({ message: '源代币代码必须是字符串' })
  fromToken?: string;

  @ApiPropertyOptional({ description: '目标代币代码', example: 'ETH' })
  @IsOptional()
  @IsString({ message: '目标代币代码必须是字符串' })
  toToken?: string;

  @ApiPropertyOptional({
    description: '订单状态: 1=成功 0=失败',
    example: Status.Enabled,
    enum: Status,
  })
  @IsOptional()
  @IsEnum(Status, { message: '订单状态值无效' })
  @Type(() => Number)
  status?: Status;
}
