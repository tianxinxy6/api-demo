import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { Public } from '@/common/decorators/public.decorator';
import { RedisService } from '@/shared/cache/redis.service';
import { DatabaseService } from '@/shared/database/database.service';

@ApiTags('Health - 健康检查')
@Controller('health')
export class HealthController {
  constructor(
    private redisService: RedisService,
    private databaseService: DatabaseService,
  ) {}

  /**
   * 详细健康检查
   */
  @Get('detailed')
  @Public()
  @ApiOperation({ summary: '详细健康检查' })
  @ApiResponse({ status: 200, description: '返回服务健康状态' })
  async checkDetailed() {
    const [dbHealth, redisHealth] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbHealth,
      redis: redisHealth,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  private async checkDatabase() {
    try {
      const connectionInfo = this.databaseService.getConnectionInfo();
      return {
        status: 'healthy',
        ...connectionInfo,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async checkRedis() {
    try {
      const redis = this.redisService.getClient();
      const pong = await redis.ping();
      return {
        status: 'healthy',
        response: pong,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
