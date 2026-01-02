import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ChainType, SysWalletType } from '@/constants';

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

  @ApiProperty({
    description: '钱包类型',
    enum: SysWalletType,
    example: SysWalletType.Fee,
  })
  @IsEnum(SysWalletType, { message: '钱包类型无效' })
  type: SysWalletType;
}
