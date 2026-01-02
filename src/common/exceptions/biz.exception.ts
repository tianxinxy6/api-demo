import { HttpException, HttpStatus } from '@nestjs/common';

import { ErrorCode } from '@/constants/error-code.constant';
import { RESPONSE_SUCCESS_CODE } from '@/constants/response.constant';

/**
 * 业务异常类
 * 职责：
 * 1. 统一处理业务逻辑异常
 * 2. 支持错误码和自定义消息
 * 3. 返回 HTTP 200 状态码，通过 code 字段区分错误
 *
 * 使用示例：
 * - throw new BusinessException(ErrorCode.ErrUserNotFound)
 * - throw new BusinessException('自定义错误消息')
 */
export class BusinessException extends HttpException {
  private errorCode: number;

  constructor(error: ErrorCode | string) {
    // 如果是非 ErrorCode 格式（不包含冒号）
    if (!error.includes(':')) {
      super(
        HttpException.createBody({
          code: RESPONSE_SUCCESS_CODE,
          message: error,
        }),
        HttpStatus.OK,
      );
      this.errorCode = RESPONSE_SUCCESS_CODE;
      return;
    }

    // 解析 ErrorCode 格式：'code:message'
    const [code, message] = error.split(':');
    super(
      HttpException.createBody({
        code,
        message,
      }),
      HttpStatus.OK,
    );

    this.errorCode = Number(code);
  }

  /**
   * 获取错误码
   */
  getErrorCode(): number {
    return this.errorCode;
  }
}

export { BusinessException as BizException };
