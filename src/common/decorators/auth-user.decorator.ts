import { createParamDecorator, ExecutionContext } from '@nestjs/common';

type Payload = keyof IAuthUser;

/**
 * 获取当前登录用户信息装饰器
 * 由 JWT 认证守卫将用户信息挂载到 request.user
 *
 * 使用示例：
 * - @AuthUser() user: IAuthUser - 获取完整用户信息
 * - @AuthUser('uid') userId: number - 只获取用户ID
 */
export const AuthUser = createParamDecorator((data: Payload, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<{ user: IAuthUser }>();
  // auth guard will mount this
  const user = request.user;

  return data ? user?.[data] : user;
});
