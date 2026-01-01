import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SysWalletAddressService } from '../services/sys-wallet.service';
import { CreateSysWalletAddressDto } from '../dto/sys-wallet.dto';
import { Public } from '@/common/decorators/public.decorator';

/**
 * 系统钱包控制器
 * 职责：管理系统级钱包地址（手续费钱包、提现钱包等）
 */
@ApiTags('System - Wallet')
@Public()
@Controller('system/wallets')
export class SysWalletController {
  constructor(
    private readonly sysWalletAddressService: SysWalletAddressService,
  ) {}

  /**
   * 创建系统钱包地址
   */
  @Post('addresses')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建系统钱包地址' })
  @ApiResponse({ status: 201, description: '创建成功' })
  async createAddress(@Body() dto: CreateSysWalletAddressDto): Promise<void> {
    await this.sysWalletAddressService.createAddress(dto.chainType, dto.type);
  }
}
