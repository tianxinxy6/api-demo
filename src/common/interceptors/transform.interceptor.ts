import type { FastifyRequest } from 'fastify';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import qs from 'qs';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ResOp } from '../vo/response.model';
import { BYPASS_KEY } from '../decorators/bypass.decorator';

/**
 * 响应转换拦截器
 * 职责：
 * 1. 统一处理接口响应格式
 * 2. 将响应数据包装为标准格式: { code, message, data }
 * 3. 处理 query 参数，支持数组参数
 * 4. 支持通过 @Bypass 装饰器跳过转换
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> {
    const bypass = this.reflector.get<boolean>(BYPASS_KEY, context.getHandler());

    if (bypass) return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();

    // 处理 query 参数，将数组参数转换为数组,如：?a[]=1&a[]=2 => { a: [1, 2] }
    request.query = qs.parse(request.url.split('?').at(1) || '');

    return next.handle().pipe(
      map((data) => {
        return ResOp.success(data);
      }),
    );
  }
}
