import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { Public } from '@/common/decorators/public.decorator';

@ApiTags('Health - 健康检查')
@Controller('health')
export class HealthController {
  /**
   * 健康检查
   */
  @Get()
  @Public()
  @ApiOperation({ summary: '详细健康检查' })
  @ApiResponse({ status: 200, description: '返回服务健康状态' })
  async checkDetailed() {
    return null;
  }
}
