import * as crypto from 'crypto';

/**
 * 加密工具函数（纯函数，无依赖）
 * 2025 企业级标准：使用 Node.js 原生 crypto，避免第三方依赖
 */

const ALGORITHM = 'aes-256-cbc';

/**
 * 获取加密密钥
 */
function getEncryptionKey(customKey?: string): string {
  const key = customKey || process.env['ENCRYPTION_KEY'];
  if (!key) {
    throw new Error(
      'Encryption key is required. Set ENCRYPTION_KEY environment variable or pass it as parameter.',
    );
  }
  if (key.length < 32) {
    throw new Error('Encryption key must be at least 32 characters long');
  }
  return key;
}

/**
 * 使用 AES-256-CBC 加密数据
 *
 * 特点：
 * 1. 每次加密生成随机 IV
 * 2. IV 和密文一起返回
 * 3. 使用配置的密钥或环境变量
 *
 * @param plaintext 明文
 * @param secretKey 32 字节密钥（可从环境变量读取）
 * @returns hex 编码的 IV + 密文
 */
export function aesEncrypt(plaintext: string, secretKey?: string): string {
  try {
    // 密钥必须是 32 字节（256 位）
    const key = crypto
      .createHash('sha256')
      .update(getEncryptionKey(secretKey))
      .digest();

    // 为每次加密生成随机 IV（16 字节）
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 返回 IV + 密文（前 32 个十六进制字符是 IV）
    return iv.toString('hex') + encrypted;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`AES encryption failed: ${message}`);
  }
}

/**
 * 使用 AES-256-CBC 解密数据
 *
 * @param ciphertext hex 编码的 IV + 密文
 * @param secretKey 32 字节密钥
 * @returns 解密后的明文
 */
export function aesDecrypt(ciphertext: string, secretKey?: string): string {
  try {
    const key = crypto
      .createHash('sha256')
      .update(getEncryptionKey(secretKey))
      .digest();

    // 提取 IV（前 32 个十六进制字符 = 16 字节）
    const iv = Buffer.from(ciphertext.slice(0, 32), 'hex');
    const encrypted = ciphertext.slice(32);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`AES decryption failed: ${message}`);
  }
}

/**
 * 计算 SHA256 哈希
 * @param data 输入数据
 * @returns hex 编码的哈希值
 */
export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * 计算 SHA512 哈希
 * @param data 输入数据
 * @returns hex 编码的哈希值
 */
export function sha512(data: string): string {
  return crypto.createHash('sha512').update(data).digest('hex');
}

/**
 * 计算 MD5 哈希（仅用于兼容性，不推荐用于安全场景）
 * @param data 输入数据
 * @returns hex 编码的哈希值
 */
export function md5(data: string): string {
  if (!data) {
    throw new Error('md5: data cannot be null or undefined');
  }
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * 计算 Keccak256 哈希（用于以太坊）
 *
 * 说明：Keccak256 不在 Node.js crypto 中，需要使用 js-sha3
 * 如果未安装可暂时使用 SHA3-256 替代
 */
export function keccak256(data: string): string {
  try {
    const { keccak_256 } = require('js-sha3');
    return keccak_256(data);
  } catch {
    // 备用方案：使用 SHA3-256（需要 npm install sha3）
    // 注：这是降级方案，生产环境应确保 js-sha3 已安装
    // 可以在应用启动时检查依赖并记录警告日志
    return crypto.createHash('sha3-256').update(data).digest('hex');
  }
}

/**
 * 生成指定长度的随机字节
 * @param length 字节长度
 * @returns hex 编码的随机字符串
 */
export function generateRandomBytes(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * 生成随机字符串（用于 token、nonce 等）
 * @param length 字符长度（实际字节是 length/2）
 * @returns 随机字符串
 */
export function generateRandomString(length: number = 32): string {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * 计算 HMAC-SHA256
 * @param message 消息
 * @param secret 密钥
 * @returns hex 编码的 HMAC 值
 */
export function hmacSha256(message: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

/**
 * 计算 HMAC-SHA512
 * @param message 消息
 * @param secret 密钥
 * @returns hex 编码的 HMAC 值
 */
export function hmacSha512(message: string, secret: string): string {
  return crypto.createHmac('sha512', secret).update(message).digest('hex');
}
