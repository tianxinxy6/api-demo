import { Body, Controller, Post, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SwapService } from '../services/swap.service';
import { CreateSwapDto, QuerySwapDto } from '../dto/swap.dto';
import { SwapOrder } from '../model/swap.model';
import { AuthUser } from '@/common/decorators/auth-user.decorator';
import { ApiSecurityAuth } from '@/common/decorators/swagger.decorator';

/**
 * 闪兑订单控制器
 */
@ApiTags('Orders - Swap')
@ApiSecurityAuth()
@Controller('order/swap')
export class SwapController {
  constructor(private readonly swapService: SwapService) {}

  /**
   * 创建闪兑订单
   */
  @Post()
  @ApiOperation({ summary: '创建闪兑订单' })
  @ApiResponse({ status: 201, description: '创建成功' })
  async create(@AuthUser() user: IAuthUser, @Body() dto: CreateSwapDto): Promise<void> {
    await this.swapService.create(user.uid, dto);
  }

  /**
   * 获取我的闪兑记录
   */
  @Get()
  @ApiOperation({ summary: '获取我的闪兑记录' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: SwapOrder,
    isArray: true,
  })
  async getMyOrders(
    @AuthUser() user: IAuthUser,
    @Query() queryDto: QuerySwapDto,
  ): Promise<IListRespData> {
    const result = await this.swapService.getUserOrders(user.uid, queryDto);
    return result;
  }
}
