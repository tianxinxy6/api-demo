import { ApiProperty } from '@nestjs/swagger';

import { RESPONSE_SUCCESS_CODE, RESPONSE_SUCCESS_MSG } from '@/constants/response.constant';

/**
 * 响应数据封装类
 * 提供统一的响应格式：{ code, message, data }
 */
export class ResOp<T = any> {
  @ApiProperty({ type: 'object', additionalProperties: true })
  data?: T;

  @ApiProperty({ type: 'number', default: RESPONSE_SUCCESS_CODE })
  code: number;

  @ApiProperty({ type: 'string', default: RESPONSE_SUCCESS_MSG })
  message: string;

  constructor(code: number, data: T, message = RESPONSE_SUCCESS_MSG) {
    this.code = code;
    this.message = message;
    this.data = data || null;
  }

  /**
   * 创建成功响应
   * @param data 响应数据
   * @param message 响应消息
   */
  static success<T>(data?: T, message?: string) {
    return new ResOp(RESPONSE_SUCCESS_CODE, data, message);
  }

  /**
   * 创建错误响应
   * @param code 错误码
   * @param message 错误消息
   */
  static error(code: number, message: string) {
    return new ResOp(code, {}, message);
  }
}

export class TreeResult<T> {
  @ApiProperty()
  id: number;

  @ApiProperty()
  parentId: number;

  @ApiProperty()
  children?: TreeResult<T>[];
}
