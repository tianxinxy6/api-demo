declare global {
  interface IAuthUser {
    uid: number
    pv: number
    /** 过期时间 */
    exp?: number
    /** 签发时间 */
    iat?: number
  }

  export interface IBaseResponse<T = any> {
    message: string
    code: number
    data?: T
  }

  export interface IListRespData<T = any> {
    items: T[]
  }
}

/**
 * JWT Payload 接口
 * 定义JWT token中包含的用户信息
 */
export interface JwtPayload {
  /**
   * 用户ID (JWT标准字段)
   */
  sub: string;

  /**
   * 签发时间 (JWT标准字段)
   */
  iat?: number;

  /**
   * 过期时间 (JWT标准字段)
   */
  exp?: number;

  /**
   * 签发者 (JWT标准字段)
   */
  iss?: string;
}

