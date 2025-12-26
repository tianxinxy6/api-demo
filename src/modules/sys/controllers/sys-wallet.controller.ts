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

@ApiTags('System - 系统钱包')
@Controller('sys/wallet')
export class SysWalletController {
  constructor(
    private readonly sysWalletAddressService: SysWalletAddressService,
  ) {}

  /**
   * 创建系统钱包地址
   */
  @Post('address')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建系统钱包地址' })
  @ApiResponse({ status: 201, description: '创建成功' })
  async createAddress(@Body() dto: CreateSysWalletAddressDto) {
    await this.sysWalletAddressService.createAddress(dto.chainType);
  }
}
