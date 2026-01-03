import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

import { ApiSecurityAuth } from '@/common/decorators/swagger.decorator';
import { ParseIntPipe } from '@/common/pipes/parse-int.pipe';
import { AuthUser } from '@/common/decorators/auth-user.decorator';
import { ChainType } from '@/constants';
import { ChainAddressService } from '../services/chain-address.service';
import { WalletService } from '../services/wallet.service';
import { ChainAddressResponse, WalletResponse } from '../vo';

@ApiTags('Wallet - 钱包管理')
@ApiSecurityAuth()
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly chainAddressService: ChainAddressService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * 获取我的钱包列表
   */
  @Get()
  @ApiOperation({ summary: '获取我的钱包列表' })
  @ApiResponse({ status: 200, type: [WalletResponse], description: '钱包列表' })
  async getMyWallets(@AuthUser() user: IAuthUser): Promise<WalletResponse[]> {
    return this.walletService.getUserWalletsWithToken(user.uid);
  }

  /**
   * 获取用户所有区块链地址
   */
  @Get('addresses')
  @ApiOperation({ summary: '获取所有区块链地址' })
  @ApiResponse({ status: 200, type: [ChainAddressResponse] })
  async getAddresses(@AuthUser() user: IAuthUser): Promise<ChainAddressResponse[]> {
    return this.chainAddressService.getChainAddresses(user.uid);
  }

  /**
   * 获取或创建指定区块链地址
   */
  @Get('addresses/:chainType')
  @ApiOperation({ summary: '获取指定区块链地址（不存在则创建）' })
  @ApiParam({
    name: 'chainType',
    enum: ChainType,
    example: ChainType.ETH,
  })
  @ApiResponse({ status: 200, type: ChainAddressResponse })
  @ApiResponse({ status: 400, description: '不支持的区块链类型' })
  async getOrCreateAddress(
    @AuthUser() user: IAuthUser,
    @Param('chainType', ParseIntPipe) chainType: ChainType,
  ): Promise<ChainAddressResponse> {
    return this.chainAddressService.createAndGet(user.uid, chainType);
  }
}
