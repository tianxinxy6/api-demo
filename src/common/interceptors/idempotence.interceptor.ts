import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';

import type { FastifyRequest } from 'fastify';
import { ConflictException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { catchError, tap } from 'rxjs';

import { hashString } from '@/utils';
import { getClientIp } from '@/utils/ip.util';

import {
  HTTP_IDEMPOTENCE_KEY,
  HTTP_IDEMPOTENCE_OPTIONS,
} from '../decorators/idempotence.decorator';
import { RedisService } from '@/shared/cache/redis.service';

const IdempotenceHeaderKey = 'x-idempotence';

/**
 * 幂等性拦截器配置选项
 *
 * @example
 * // 基础用法 - 使用默认配置（60秒过期）
 * @Idempotence()
 * async createOrder() { ... }
 *
 * @example
 * // 自定义过期时间和错误消息
 * @Idempotence({
 *   expired: 300, // 5分钟
 *   errorMessage: '订单已提交，请勿重复操作',
 *   pendingMessage: '订单正在处理中，请稍候...'
 * })
 * async createOrder() { ... }
 *
 * @example
 * // 使用请求头的幂等 key
 * // 客户端请求时添加: x-idempotence: <unique-key>
 * @Idempotence()
 * async transfer() { ... }
 *
 * @example
 * // 自定义 key 生成规则
 * @Idempotence({
 *   generateKey: (req) => {
 *     const { userId, orderId } = req.body;
 *     return `order:${userId}:${orderId}`;
 *   }
 * })
 * async updateOrder() { ... }
 *
 * @example
 * // 仅使用请求头的 key，不自动生成
 * @Idempotence({
 *   disableGenerateKey: true,
 *   errorMessage: '请在请求头中添加 x-idempotence 字段'
 * })
 * async sensitiveOperation() { ... }
 *
 * @example
 * // 自定义错误处理
 * @Idempotence({
 *   handler: (req) => {
 *     return { code: 409, message: '重复请求', requestId: req.id };
 *   }
 * })
 * async customHandler() { ... }
 */
export interface IdempotenceOption {
  errorMessage?: string;
  pendingMessage?: string;

  /**
   * 如果重复请求的话，手动处理异常
   */
  handler?: (req: FastifyRequest) => any;

  /**
   * 记录重复请求的时间
   * @default 60
   */
  expired?: number;

  /**
   * 如果 header 没有幂等 key，根据 request 生成 key，如何生成这个 key 的方法
   */
  generateKey?: (req: FastifyRequest) => string;

  /**
   * 仅读取 header 的 key，不自动生成
   * @default false
   */
  disableGenerateKey?: boolean;
}

/**
 * 幂等性拦截器
 *
 * 通过 Redis 原子操作防止重复请求和重放攻击
 *
 * **工作原理：**
 * 1. 从请求头 `x-idempotence` 获取幂等 key，或根据请求内容自动生成
 * 2. 使用 Redis SETNX 原子操作尝试设置 key（值为 '0' 表示处理中）
 * 3. 如果设置成功（返回 1），允许请求继续，并设置过期时间
 * 4. 如果设置失败（返回 0），说明是重复请求，抛出 409 异常
 * 5. 请求成功后，更新 key 值为 '1'（表示已完成）
 * 6. 请求失败时，删除 key，允许重试
 *
 * **防重放攻击机制：**
 * - 使用 Redis SETNX 确保原子性，即使并发 10000 个相同请求也只有 1 个能通过
 * - 无竞态条件，不存在 GET→SET 之间的时间窗口漏洞
 *
 * **状态说明：**
 * - `'0'`: 请求处理中
 * - `'1'`: 请求已完成（成功）
 * - `null`: key 不存在或已过期
 *
 * @example
 * // 在 Controller 方法上使用
 * @Post('transfer')
 * @Idempotence({ expired: 300 })
 * async transfer(@Body() dto: TransferDto) {
 *   return await this.walletService.transfer(dto);
 * }
 */
@Injectable()
export class IdempotenceInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // skip Get 请求
    if (request.method.toUpperCase() === 'GET') return next.handle();

    const handler = context.getHandler();
    const options: IdempotenceOption | undefined = this.reflector.get(
      HTTP_IDEMPOTENCE_OPTIONS,
      handler,
    );

    if (!options) return next.handle();

    const {
      errorMessage = '相同请求成功后在 30 秒内只能发送一次',
      pendingMessage = '相同请求正在处理中...',
      handler: errorHandler,
      expired = 30,
      disableGenerateKey = false,
    } = options;
    const redis = this.redisService.getClient();

    const idempotence = request.headers[IdempotenceHeaderKey] as string;
    const key = disableGenerateKey
      ? undefined
      : options.generateKey
        ? options.generateKey(request)
        : this.generateKey(request);

    const idempotenceKey =
      !!(idempotence || key) && `idempotence:${idempotence || key}`;

    SetMetadata(HTTP_IDEMPOTENCE_KEY, idempotenceKey)(handler);

    if (idempotenceKey) {
      // 使用 SETNX (SET if Not eXists) + EXPIRE 实现原子操作，防止竞态条件
      // 返回 1 表示设置成功（key 不存在），返回 0 表示 key 已存在
      const setResult = await redis.setnx(idempotenceKey, '0');

      if (setResult === 0) {
        // key 已存在，说明是重复请求
        const resultValue: '0' | '1' | null = (await redis.get(
          idempotenceKey,
        )) as any;

        if (errorHandler) return await errorHandler(request);

        const message = {
          1: errorMessage,
          0: pendingMessage,
        }[resultValue || '0'];
        throw new ConflictException(message);
      }
      // 如果 setResult === 1，说明是第一个请求，设置过期时间
      await redis.expire(idempotenceKey, expired);
    }

    return next.handle().pipe(
      tap(async () => {
        if (idempotenceKey) {
          // 请求成功，更新状态为完成（1）
          await redis.set(idempotenceKey, '1', 'KEEPTTL');
        }
      }),
      catchError(async (err) => {
        // 请求失败，删除 key，允许重试
        if (idempotenceKey) await redis.del(idempotenceKey);

        throw err;
      }),
    );
  }

  private generateKey(req: FastifyRequest) {
    const { body, params, query = {}, headers, url } = req;

    const obj = { body, url, params, query } as any;

    const uuid = headers['x-uuid'];
    if (uuid) {
      obj.uuid = uuid;
    } else {
      const ua = headers['user-agent'];
      const ip = getClientIp(req);

      if (!ua && !ip) return undefined;

      Object.assign(obj, { ua, ip });
    }

    return hashString(JSON.stringify(obj));
  }
}
