import { customAlphabet, nanoid } from 'nanoid';

export function generateUUID(size: number = 21): string {
  return nanoid(size);
}

export function generateShortUUID(): string {
  return nanoid(10);
}

/**
 * 生成一个随机的值
 */
export function generateRandomValue(
  length: number,
  placeholder = '1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM',
): string {
  const customNanoid = customAlphabet(placeholder, length);
  return customNanoid();
}

/**
 * 生成一个随机的值
 */
export function randomValue(
  size = 16,
  dict = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict',
): string {
  let id = '';
  let i = size;
  const len = dict.length;
  while (i--) id += dict[(Math.random() * len) | 0];
  return id;
}

/**
 * 哈希字符串 (使用更高效的算法)
 */
export const hashString = (str: string, seed = 0): number => {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

export const uniqueSlash = (path: string) =>
  path.replace(/(https?:\/)|(\/)+/g, '$1$2');

/**
 * 生成 20 位唯一订单号
 * 格式：时间戳（13位）+ 随机数（7位）
 * @returns 20位数字字符串订单号
 * 
 * @example
 * generateOrderNo() // '17035123456781234567'
 */
export function generateOrderNo(): string {
  // 获取当前时间戳（13位）
  const timestamp = Date.now().toString();
  
  // 生成7位随机数字
  const randomNum = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  
  return timestamp + randomNum;
}

/**
 * 将 wei 转换为 ether（适用于以太坊）
 * @param wei wei 单位的字符串
 * @param decimals 小数位数，默认 18
 * @returns 格式化后的数字字符串
 */
export function formatTokenAmount(wei: string, decimals: number = 18): string {
  const weiBigInt = BigInt(wei);
  const divisor = BigInt(10 ** decimals);
  
  const integerPart = weiBigInt / divisor;
  const remainder = weiBigInt % divisor;
  
  if (remainder === BigInt(0)) {
    return integerPart.toString();
  } else {
    const fractionalPart = remainder.toString().padStart(decimals, '0');
    // 移除尾随零
    const trimmedFractional = fractionalPart.replace(/0+$/, '');
    return `${integerPart.toString()}.${trimmedFractional}`;
  }
}