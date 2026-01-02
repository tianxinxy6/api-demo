import { applyDecorators } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';

export const API_SECURITY_AUTH = 'auth';

/**
 * Swagger 认证装饰器
 * 为 Swagger 文档添加认证安全标记
 * 等同于 @ApiSecurity('auth')
 *
 * 使用示例：
 * @ApiSecurityAuth()
 * @Controller('users')
 * export class UserController { ... }
 */
export function ApiSecurityAuth(): ClassDecorator & MethodDecorator {
  return applyDecorators(ApiSecurity(API_SECURITY_AUTH));
}
