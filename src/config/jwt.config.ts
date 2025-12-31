import { registerAs } from '@nestjs/config';
import { env } from '@/global/env';

export default registerAs('jwt', () => {
  const secret = env('JWT_SECRET');
  if (!secret) {
    throw new Error('JWT_SECRET is required in production');
  }

  return {
    secret,
    expiresIn: env('JWT_EXPIRES_IN', '1h'),
    refreshExpiresIn: env('JWT_REFRESH_EXPIRES_IN', '7d'),
  };
});
