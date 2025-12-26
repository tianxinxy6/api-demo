import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ChainType } from '@/constants';

/**
 * 创建系统钱包地址 DTO
 */
export class CreateSysWalletAddressDto {
  @ApiProperty({
    description: '链类型',
    enum: ChainType,
    example: ChainType.ETH,
  })
  @IsEnum(ChainType, { message: '链类型无效' })
  chainType: ChainType;
}
