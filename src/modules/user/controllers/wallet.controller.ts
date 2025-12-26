import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { ApiSecurityAuth } from '@/common/decorators/swagger.decorator';
import { ParseIntPipe } from '@/common/pipes/parse-int.pipe';
import { AuthUser } from '@/common/decorators/auth-user.decorator';
import { ChainType } from '@/constants';
import { ChainAddressService } from '../services/chain-address.service';
import { ChainAddressResponse } from '../model';

@ApiTags('chain - 区块链管理')
@ApiSecurityAuth()
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly chainAddressService: ChainAddressService,
  ) {}

  /**
   * 获取用户的所有钱包地址
   */
  @Get('addresses')
  @ApiOperation({ 
    summary: '获取用户钱包地址列表',
    description: '获取当前用户在所有区块链上的钱包地址列表'
  })
  @ApiResponse({ 
    status: 200, 
    type: [ChainAddressResponse], 
    description: '用户钱包地址列表' 
  })
  @ApiQuery({ 
    name: 'chainType', 
    required: false, 
    description: '过滤特定区块链类型的地址',
    enum: ChainType
  })
  async getWalletAddresses(
    @AuthUser() user: IAuthUser,
  ): Promise<ChainAddressResponse[]> {
    return await this.chainAddressService.getChainAddresses(user.uid);
  }

  /**
   * 获取用户在指定区块链上的地址（如果不存在则自动创建）
   */
  @Get('address/:chainType')
  @ApiOperation({ 
    summary: '获取指定区块链的钱包地址',
    description: '获取用户在指定区块链上的钱包地址，如果不存在则自动创建'
  })
  @ApiParam({ 
    name: 'chainType', 
    description: '区块链类型', 
    enum: ChainType,
    example: ChainType.ETH 
  })
  @ApiResponse({ 
    status: 200, 
    type: ChainAddressResponse, 
    description: '钱包地址信息（如果不存在则自动创建）' 
  })
  @ApiResponse({ status: 400, description: '不支持的区块链类型' })
  async getWalletAddress(
    @AuthUser() user: IAuthUser,
    @Param('chainType', ParseIntPipe) chainType: ChainType,
  ): Promise<ChainAddressResponse> {
    return await this.chainAddressService.createChainAddress(user.uid, chainType);
  }
}