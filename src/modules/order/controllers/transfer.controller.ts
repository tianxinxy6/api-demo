import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TransferService } from '../services/transfer.service';
import { CreateTransferDto, QueryTransferDto } from '../dto/transfer.dto';
import { TransferOrder } from '../model/transfer.model';
import { AuthUser } from '@/common/decorators/auth-user.decorator';
import { ApiSecurityAuth } from '@/common/decorators/swagger.decorator';

/**
 * 转账订单控制器
 */
@ApiTags('Order - Transfer')
@ApiSecurityAuth()
@Controller('order/transfer')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post()
  @ApiOperation({ summary: '创建转账订单' })
  @ApiResponse({
    status: 201,
    description: '创建成功，返回订单号',
    type: String,
  })
  async create(@AuthUser() user: IAuthUser, @Body() createDto: CreateTransferDto): Promise<string> {
    return this.transferService.create(user.uid, createDto);
  }

  @Get()
  @ApiOperation({ summary: '获取我的转账记录' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: TransferOrder,
    isArray: true,
  })
  async getMyOrders(
    @AuthUser() user: IAuthUser,
    @Query() queryDto: QueryTransferDto,
  ): Promise<IListRespData> {
    return this.transferService.getUserOrders(user.uid, queryDto);
  }
}
