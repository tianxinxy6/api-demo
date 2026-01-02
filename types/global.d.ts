declare global {
  /**
   * 认证用户信息接口
   */
  interface IAuthUser {
    /** 用户ID */
    uid: number;
  }

  /**
   * 链代币信息接口
   */
  interface IChainToken {
    /** 代币代码 */
    code: string;
    /** 合约地址 */
    contractAddress: string;
    /** 精度 */
    decimals: number;
  }

  /**
   * 价格数据接口
   */
  interface IPriceData {
    /** 交易对符号 */
    symbol: string;
    /** 价格 */
    price: string;
  }

  /**
   * API 响应基础接口
   */
  interface IBaseResponse<T = any> {
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
  interface IListRespData<T = any> {
    /** 列表项 */
    items: T[];
    /** 下一页游标 */
    nextCursor?: number;
  }
}

export { };