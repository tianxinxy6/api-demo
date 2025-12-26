declare global {
  /**
   * 认证用户信息接口
   */
  interface IAuthUser {
    /** 用户ID */
    uid: number;
  }

  interface IChainToken { 
    code: string; 
    contractAddress: string, 
    decimals: number 
  }

  /**
   * API 响应基础接口
   */
  export interface IBaseResponse<T = any> {
    /** 响应消息 */
    message: string;
    /** 状态码 */
    code: number;
    /** 响应数据 */
    data?: T;
  }

  /**
   * 列表响应数据接口
   */
  export interface IListRespData<T = any> {
    /** 列表项 */
    items: T[];
    /** 下一页游标 */
    nextCursor?: number;
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

