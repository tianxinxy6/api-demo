/**
 * 签名验证常量
 */

export const SIGNATURE_HEADER = 'x-signature';
export const TIMESTAMP_HEADER = 'x-timestamp';

/**
 * 签名配置
 */
export const SIGNATURE_CONFIG = {
  TIMESTAMP_TOLERANCE: 5 * 60 * 1000, // 5分钟
} as const;
