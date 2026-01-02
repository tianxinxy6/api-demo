/**
 * 链上交易信息接口定义
 */
export interface ChainTransaction {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  blockNumber: number;
  timestamp: number;
  type: string;
  contract?: ContractInfo | null;
  isTarget: boolean;
  role?: 'sender' | 'receiver' | 'none';
  raw: any;
  //   [key: string]: any;
}

export interface ContractInfo {
  address: string;
  method: string;
  amount?: string;
}
