import { registerAs } from '@nestjs/config';
import { env } from '@/global/env';

export default registerAs('jwt', () => ({
  secret: env('JWT_SECRET'),
  expires: env('JWT_EXPIRES_IN', '3600'), // 访问令牌过期时间，默认1小时
  refreshExpires: env('JWT_REFRESH_EXPIRES_IN', '604800'), // 刷新令牌过期时间，默认7天
}));
