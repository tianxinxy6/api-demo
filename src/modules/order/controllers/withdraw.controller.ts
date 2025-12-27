import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  ParseIntPipe,
  Put,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { WithdrawService } from '../services/withdraw.service';
import { CreateWithdrawDto, QueryWithdrawDto, CancelWithdrawDto } from '../dto/withdraw.dto';
import { WithdrawOrder } from '../model/withdraw.model';
import { AuthUser } from '@/common/decorators/auth-user.decorator';
import { ApiSecurityAuth } from '@/common/decorators/swagger.decorator';

@ApiTags('提现记录')
@ApiSecurityAuth()
@Controller('withdraw')
export class WithdrawController {
  constructor(private readonly withdrawService: WithdrawService) {}

  @Put()
  @ApiOperation({ summary: '创建提现订单' })
  @ApiResponse({
    status: 201,
    description: '创建成功',
    type: String,
  })
  async create(
    @AuthUser() user: IAuthUser,
    @Body() createDto: CreateWithdrawDto,
  ): Promise<string> {
    return this.withdrawService.create(user.uid, createDto);
  }

  @Delete()
  @ApiOperation({ summary: '取消提现订单' })
  @ApiResponse({
    status: 200,
    description: '取消成功',
  })
  async cancel(
    @AuthUser() user: IAuthUser,
    @Body() cancelDto: CancelWithdrawDto,
  ): Promise<void> {
    return this.withdrawService.cancel(user.uid, cancelDto.orderNo);
  }

  @Get()
  @ApiOperation({ summary: '获取我的提现记录' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: WithdrawOrder,
    isArray: true,
  })
  async getMyOrders(
    @AuthUser() user: IAuthUser,
    @Query() queryDto: QueryWithdrawDto,
  ): Promise<IListRespData> {
    return this.withdrawService.getUserOrders(user.uid, queryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取提现订单详情' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    type: WithdrawOrder,
  })
  async getOrder(
    @AuthUser() user: IAuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<WithdrawOrder> {
    return this.withdrawService.getOrderById(id, user.uid);
  }
}
