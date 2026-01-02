import * as crypto from 'crypto';

/**
 * 签名工具类
 *
 * **签名规则：** HMAC-SHA256(timestamp + JSON.stringify(body), secret)
 *
 * **安全机制：**
 * - 时间戳验证：防止过期请求（5分钟）
 * - 签名验证：防止参数篡改
 * - 配合幂等性拦截器：防止重复提交
 */
export class SignatureUtil {
  /**
   * 生成签名
   */
  static generate(
    secret: string,
    body: any = {},
  ): {
    signature: string;
    timestamp: number;
  } {
    const timestamp = Date.now();
    const data = `${timestamp}${JSON.stringify(body)}`;
    const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');

    return { signature, timestamp };
  }

  /**
   * 验证签名
   */
  static verify(
    secret: string,
    signature: string,
    timestamp: number,
    body: any = {},
    tolerance: number = 5 * 60 * 1000, // 5分钟
  ): { valid: boolean; error?: string } {
    // 验证时间戳
    const timeDiff = Math.abs(Date.now() - timestamp);
    if (timeDiff > tolerance) {
      return { valid: false, error: '时间戳已过期' };
    }

    // 计算签名
    const data = `${timestamp}${JSON.stringify(body)}`;
    const computedSignature = crypto.createHmac('sha256', secret).update(data).digest('hex');

    // 检查签名长度是否匹配（防止 timingSafeEqual 抛出异常）
    if (signature.length !== computedSignature.length) {
      return { valid: false, error: '签名无效' };
    }

    // 安全比较（防止时序攻击）
    try {
      const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature));
      return { valid, error: valid ? undefined : '签名无效' };
    } catch (error) {
      return { valid: false, error: '签名格式错误' };
    }
  }
}
