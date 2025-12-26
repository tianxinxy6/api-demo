import { ChainType } from "@/constants";
import { ApiProperty } from "@nestjs/swagger";

/**
 * 链上地址响应模型 - 基础版本（最小化返回）
 * 用于列表展示等场景
 */
export class ChainAddressResponse {
  @ApiProperty({ description: '地址ID', example: 1 })
  id: number;

  @ApiProperty({ description: '区块链类型', enum: ChainType, example: ChainType.ETH })
  chainType: ChainType;

  @ApiProperty({ description: '钱包地址', example: '0x742d35Cc6634C0532925a3b8D0eE8C3A4' })
  address: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  constructor(partial: Partial<ChainAddressResponse>) {
    Object.assign(this, partial);
  }
}