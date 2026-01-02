import { IsOptional, IsNumber, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DepositStatus } from '@/constants';
import { DateDto } from '@/common/dto/date.dto';

/**
 * 查询充值记录DTO
 */
export class QueryDepositDto extends DateDto {
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
    enum: DepositStatus,
  })
  @IsOptional()
  @IsEnum(DepositStatus, { message: '订单状态值无效' })
  @Type(() => Number)
  status?: DepositStatus;
}
