import { registerAs } from '@nestjs/config';
import { env } from '@/global/env';

export default registerAs('jwt', () => ({
  secret: env('JWT_SECRET'),
  expires: env('JWT_EXPIRES_IN', '7d'),
}));
