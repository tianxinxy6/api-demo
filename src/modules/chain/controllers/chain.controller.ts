import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

import { ApiSecurityAuth } from '@/common/decorators/swagger.decorator';
import { ChainService } from '../services/chain.service';
import { ChainTokenService } from '../services/token.service';
import { SupportedChainResponse, ChainTokenResponse } from '../vo';
import { BusinessException } from '@/common/exceptions/biz.exception';
import { ErrorCode } from '@/constants';

@ApiTags('Chain - 区块链管理')
@ApiSecurityAuth()
@Controller({ path: 'chains', version: '1' })
export class ChainController {
  constructor(
    private readonly chainService: ChainService,
    private readonly tokenService: ChainTokenService,
  ) {}

  /**
   * 获取所有支持的区块链
   */
  @Get()
  @ApiOperation({ summary: '获取支持的区块链列表' })
  @ApiResponse({
    status: 200,
    type: [SupportedChainResponse],
    description: '支持的区块链列表',
  })
  async getSupportedChains(): Promise<SupportedChainResponse[]> {
    return this.chainService.getSupportedChains();
  }

  /**
   * 获取指定链上的所有代币列表
   */
  @Get(':chainId/tokens')
  @ApiOperation({ summary: '获取链上代币列表' })
  @ApiParam({
    name: 'chainId',
    description: '区块链ID',
    example: 1,
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    type: [ChainTokenResponse],
    description: '链上代币列表',
  })
  @ApiResponse({ status: 404, description: '区块链不存在' })
  async getChainTokens(
    @Param('chainId', ParseIntPipe) chainId: number,
  ): Promise<ChainTokenResponse[]> {
    // 先验证链是否存在
    const chain = await this.chainService.getChainById(chainId);
    if (!chain) {
      throw new BusinessException(ErrorCode.ErrChainNotFound);
    }

    return this.tokenService.getChainTokenList(chainId);
  }
}
