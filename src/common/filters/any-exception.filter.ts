import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { QueryFailedError } from 'typeorm';

import { BusinessException } from '@/common/exceptions/biz.exception';
import { ErrorCode } from '@/constants/error-code.constant';

import { isDev } from '@/global/env';

interface MyError {
  readonly status: number;
  readonly statusCode?: number;
  readonly message?: string;
}

/**
 * 全局异常过滤器
 * 职责：
 * 1. 捕获所有未处理的异常
 * 2. 统一异常响应格式
 * 3. 区分业务异常和系统异常
 * 4. 生产环境隐藏系统错误详情
 * 5. 注册全局异常监听钩子
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor() {
    this.registerCatchAllExceptionsHook();
  }

  /**
   * 捕获异常并处理
   * @param exception 异常对象
   * @param host 参数主机
   */
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();

    const url = request.raw.url;

    const status = this.getStatus(exception);
    let message = this.getErrorMessage(exception);

    // 系统内部错误时
    if (status === HttpStatus.INTERNAL_SERVER_ERROR && !(exception instanceof BusinessException)) {
      Logger.error(exception, undefined, 'Catch');

      // 生产环境下隐藏错误信息
      if (!isDev) message = ErrorCode.ErrInternalServer?.split(':')[1];
    } else {
      this.logger.warn(`错误信息：(${status}) ${message} Path: ${decodeURI(url)}`);
    }

    const apiErrorCode = exception instanceof BusinessException ? exception.getErrorCode() : status;

    // 返回基础响应结果
    const resBody: IBaseResponse = {
      code: apiErrorCode,
      message,
      data: null,
    };

    response.status(status).send(resBody);
  }

  /**
   * 获取 HTTP 状态码
   * @param exception 异常对象
   */
  getStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    } else if (exception instanceof QueryFailedError) {
      return HttpStatus.INTERNAL_SERVER_ERROR;
    } else {
      return (
        (exception as MyError)?.status ??
        (exception as MyError)?.statusCode ??
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 获取错误消息
   * @param exception 异常对象
   */
  getErrorMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      return exception.message;
    } else if (exception instanceof QueryFailedError) {
      return exception.message;
    } else {
      return (
        (exception as any)?.response?.message ?? (exception as MyError)?.message ?? `${exception}`
      );
    }
  }

  /**
   * 注册全局异常监听钩子
   * 捕获未处理的 Promise 拒绝和未捕获的异常
   */
  registerCatchAllExceptionsHook() {
    process.on('unhandledRejection', (reason) => {
      this.logger.error('unhandledRejection: ', reason);
    });

    process.on('uncaughtException', (err) => {
      this.logger.error('uncaughtException: ', err);
    });
  }
}
