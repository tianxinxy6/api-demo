import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';

import { BusinessException } from '@/common/exceptions/biz.exception';
import { ErrorCode } from '@/constants/error-code.constant';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER } from '@/constants/signature.constant';
import { SignatureUtil } from '@/utils/signature.util';

export const SKIP_SIGNATURE_KEY = Symbol('__skip_signature__');

/**
 * 签名验证守卫
 *
 * **默认行为：** 启用后，所有 POST/PUT/PATCH/DELETE 请求都需要签名验证
 *
 * **安全机制：**
 * - 签名验证：防止参数篡改（HMAC-SHA256）
 * - 时间戳验证：防止过期请求（5分钟）
 * - 配合幂等性拦截器：防止重复提交
 *
 * **使用方式：**
 * ```typescript
 * // 跳过签名验证（登录、注册等公开接口）
 * @Post('login')
 * @SkipSignature()
 * async login(@Body() dto: LoginDto) { }
 *
 * // 默认需要签名验证（转账、提现等）
 * @Post('transfer')
 * async transfer(@Body() dto: TransferDto) { }
 * ```
 *
 * **环境变量：**
 * - SIGNATURE_ENABLED: 启用签名验证（默认 false）
 * - SIGNATURE_SECRET: 签名密钥
 */
@Injectable()
export class SignatureGuard implements CanActivate {
  private readonly logger = new Logger(SignatureGuard.name);
  private readonly enabled: boolean;
  private readonly secret: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    this.enabled = this.configService.get<boolean>('app.signature.enabled', false);
    this.secret = this.configService.get<string>('app.signature.secret', '');

    if (this.enabled) {
      if (!this.secret) {
        this.logger.warn('⚠️ 签名验证已启用但未配置 SIGNATURE_SECRET');
      } else {
        this.logger.log('✅ 签名验证守卫已启用');
      }
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.enabled) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // GET 请求默认跳过
    if (request.method.toUpperCase() === 'GET') return true;

    // 检查是否跳过签名验证
    const skipSignature = this.reflector.getAllAndOverride<boolean>(SKIP_SIGNATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipSignature) return true;

    this.validateSignature(request);
    return true;
  }

  private validateSignature(request: FastifyRequest): void {
    const signature = request.headers[SIGNATURE_HEADER] as string;
    const timestampStr = request.headers[TIMESTAMP_HEADER] as string;

    if (!signature || !timestampStr) {
      throw new BusinessException(ErrorCode.ErrSignatureMissing);
    }

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      throw new BusinessException(ErrorCode.ErrTimestampInvalid);
    }

    // 验证签名
    const result = SignatureUtil.verify(this.secret, signature, timestamp, request.body);

    if (!result.valid) {
      this.logger.warn(`签名验证失败: ${result.error}`);
      throw new BusinessException(
        result.error?.includes('时间戳')
          ? ErrorCode.ErrTimestampInvalid
          : ErrorCode.ErrSignatureInvalid,
      );
    }
  }
}
