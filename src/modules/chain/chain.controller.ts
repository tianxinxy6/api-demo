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
} from '@nestjs/swagger';

import { ApiSecurityAuth } from '@/common/decorators/swagger.decorator';
import { ChainService } from './services/chain.service';
import { TokenService } from './services/token.service';
import {
  SupportedChainResponse,
  ChainTokenResponse,
} from './model';

@ApiTags('chain - 区块链管理')
@ApiSecurityAuth()
@Controller('chain')
export class ChainController {
  constructor(
    private readonly chainService: ChainService,
    private readonly tokenService: TokenService,
  ) { }

  /**
   * 获取所有支持的区块链
   */
  @Get('all')
  @ApiOperation({
    summary: '获取支持的区块链列表',
    description: '获取平台支持的所有区块链配置信息'
  })
  @ApiResponse({
    status: 200,
    type: [SupportedChainResponse],
    description: '支持的区块链列表'
  })
  async getSupportedChains(): Promise<SupportedChainResponse[]> {
    return await this.chainService.getSupportedChains();
  }

  /**
   * 获取指定链上的所有代币列表
   */
  @Get('tokens/:chainId')
  @ApiOperation({
    summary: '获取链上代币列表',
    description: '获取指定区块链上支持的所有代币列表（包括原生代币和ERC20/TRC20等代币）'
  })
  @ApiParam({
    name: 'chainId',
    description: '区块链ID',
    example: 1,
    type: 'number'
  })
  @ApiResponse({
    status: 200,
    type: [ChainTokenResponse],
    description: '链上代币列表'
  })
  @ApiResponse({ status: 404, description: '链不存在或无支持的代币' })
  async getChainTokens(
    @Param('chainId') chainId: number,
  ): Promise<ChainTokenResponse[]> {
    // 先验证链是否存在
    const chain = await this.chainService.getChainById(chainId);
    if (!chain) {
      return [];
    }

    return await this.tokenService.getChainTokenList(chainId);
  }
}