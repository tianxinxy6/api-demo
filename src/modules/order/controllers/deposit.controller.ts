import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DepositService } from '../services/deposit.service';
import { QueryDepositDto } from '../dto/deposit.dto';
import { DepositOrder } from '../model/deposit.model';
import { AuthUser } from '@/common/decorators/auth-user.decorator';
import { ApiSecurityAuth } from '@/common/decorators/swagger.decorator';

/**
 * 充值订单控制器
 */
@ApiTags('Order - Deposit')
@ApiSecurityAuth()
@Controller('order/deposit')
export class DepositController {
  constructor(private readonly depositService: DepositService) {}

  @Get()
  @ApiOperation({ summary: '获取我的充值记录' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: DepositOrder,
    isArray: true,
  })
  async getMyOrders(
    @AuthUser() user: IAuthUser,
    @Query() queryDto: QueryDepositDto,
  ): Promise<IListRespData> {
    const result = await this.depositService.getUserOrders(user.uid, queryDto);
    return result;
  }
}
