import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';
import { SkipSignature } from '@/common/decorators/signature.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { SysWalletAddressService } from '../sys/services/sys-wallet.service';
import { CreateSysWalletAddressDto } from './dto/sys-wallet.dto';

class TestSignatureDto {
  @IsNumber()
  amount: number;

  @IsString()
  toAddress: string;
}

/**
 * 签名验证测试控制器
 * 用于测试签名验证功能
 */
@ApiTags('Test - 测试接口')
@Controller('test')
@Public() // 跳过 JWT 验证
export class TestController {
  constructor(private readonly sysWalletAddressService: SysWalletAddressService) {}

  /**
   * 需要签名验证的接口
   */
  @Post('with-signature')
  @ApiOperation({ summary: '测试签名验证（需要签名）' })
  async withSignature(@Body() dto: TestSignatureDto) {
    return {
      success: true,
      message: '✅ 签名验证通过',
      data: dto,
      timestamp: Date.now(),
    };
  }

  /**
   * 跳过签名验证的接口
   */
  @Post('without-signature')
  @SkipSignature()
  @ApiOperation({ summary: '测试接口（跳过签名验证）' })
  async withoutSignature(@Body() dto: TestSignatureDto) {
    return {
      success: true,
      message: '✅ 无需签名验证',
      data: dto,
      timestamp: Date.now(),
    };
  }

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
