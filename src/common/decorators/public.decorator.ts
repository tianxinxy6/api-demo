import { SetMetadata } from '@nestjs/common';

import { PUBLIC_KEY } from '@/modules/auth/auth.constant';

/**
 * 公开接口装饰器
 * 标记接口不需要 JWT 认证，允许匿名访问
 *
 * 使用示例：
 * @Public()
 * @Get('info')
 * async getPublicInfo() { ... }
 */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
