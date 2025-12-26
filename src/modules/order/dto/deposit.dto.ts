import { IsOptional, IsNumber, IsString, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DepositStatus } from '@/constants';
import { CursorDto } from '@/common/dto/cursor.dto';

/**
 * 查询充值记录DTO
 */
export class QueryDepositDto extends CursorDto {
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
    example: DepositStatus.PENDING,
    enum: DepositStatus 
  })
  @IsOptional()
  @IsEnum(DepositStatus, { message: '订单状态值无效' })
  @Type(() => Number)
  status?: DepositStatus;

  @ApiPropertyOptional({ description: '开始时间', example: '2025-12-12 10:00:00' })
  @IsOptional()
  @IsDateString({}, { message: '开始时间格式不正确' })
  startDate?: string;

  @ApiPropertyOptional({ description: '结束时间', example: '2025-12-12 18:00:00' })
  @IsOptional()
  @IsDateString({}, { message: '结束时间格式不正确' })
  endDate?: string;
}