import type { FastifyRequest } from 'fastify';
import type { IncomingMessage } from 'node:http';

export function getClientIp(request: FastifyRequest | IncomingMessage): string {
  const req = request as any;

  let ip: string | undefined =
    request.headers['x-forwarded-for'] ||
    request.headers['X-Forwarded-For'] ||
    request.headers['X-Real-IP'] ||
    request.headers['x-real-ip'] ||
    req?.ip ||
    req?.raw?.connection?.remoteAddress ||
    req?.raw?.socket?.remoteAddress ||
    undefined;
  if (ip && ip.split(',').length > 0) ip = ip.split(',')[0];

  return ip || '0.0.0.0';
}
