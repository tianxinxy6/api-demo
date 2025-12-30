import { IsNotEmpty, IsNumber, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TransferStatus } from '@/constants';
import { DateDto } from '@/common/dto/date.dto';

/**
 * 创建转账订单DTO
 */
export class CreateTransferDto {
  @ApiProperty({ description: '转入用户名', example: 'user123' })
  @IsNotEmpty({ message: '转入用户不能为空' })
  toUser: string;

  @ApiProperty({ description: '代币ID', example: 1 })
  @IsNotEmpty({ message: '代币ID不能为空' })
  @IsNumber({}, { message: '代币ID必须是数字' })
  @Type(() => Number)
  tokenId: number;

  @ApiProperty({ description: '转账金额', example: 100 })
  @IsNotEmpty({ message: '转账金额不能为空' })
  @IsNumber({}, { message: '转账金额必须是数字' })
  @Type(() => Number)
  amount: number;

  @ApiProperty({ description: '交易密码', example: '123456' })
  @IsNotEmpty({ message: '交易密码不能为空' })
  @IsString({ message: '交易密码必须是字符串' })
  transPassword: string;

  @ApiPropertyOptional({ description: '备注', example: '转账备注' })
  @IsOptional()
  @IsString({ message: '备注必须是字符串' })
  remark?: string;
}

/**
 * 查询转账记录DTO
 */
export class QueryTransferDto extends DateDto {
  @ApiPropertyOptional({ description: '代币ID', example: 1 })
  @IsOptional()
  @IsNumber({}, { message: '代币ID必须是数字' })
  @Type(() => Number)
  tokenId?: number;
}
