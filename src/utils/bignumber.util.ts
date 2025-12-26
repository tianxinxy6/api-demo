/**
 * 大数字处理工具函数
 * 用于处理区块链中可能超出 JavaScript Number 精度的大数字
 */

/**
 * 验证字符串是否为有效的大数字
 * @param value 待验证的字符串
 * @returns 是否为有效的大数字
 */
export function isValidBigNumber(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }
  
  // 移除前导零（保留至少一个零）
  const trimmed = value.replace(/^0+/, '') || '0';
  
  // 检查是否只包含数字
  return /^\d+$/.test(trimmed);
}

/**
 * 验证字符串是否为有效的有符号大数字（可以为负数）
 * @param value 待验证的字符串
 * @returns 是否为有效的有符号大数字
 */
export function isValidSignedBigNumber(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }
  
  // 处理负号
  const isNegative = value.startsWith('-');
  const numberPart = isNegative ? value.slice(1) : value;
  
  return isValidBigNumber(numberPart);
}

/**
 * 安全地将数字转换为字符串（用于存储到数据库）
 * @param value 数字值（可以是 number、bigint 或 string）
 * @returns 字符串形式的数字
 */
export function toBigNumberString(value: number | bigint | string): string {
  if (typeof value === 'string') {
    if (!isValidSignedBigNumber(value)) {
      throw new Error(`Invalid big number string: ${value}`);
    }
    return value;
  }
  
  if (typeof value === 'number') {
    // 检查是否为安全整数
    if (!Number.isInteger(value) || !Number.isSafeInteger(value)) {
      throw new Error(`Number ${value} is not a safe integer, use string or bigint instead`);
    }
    return value.toString();
  }
  
  if (typeof value === 'bigint') {
    return value.toString();
  }
  
  throw new Error(`Unsupported value type: ${typeof value}`);
}

/**
 * 安全地将字符串转换为 BigInt
 * @param value 字符串形式的数字
 * @returns BigInt 对象
 */
export function fromBigNumberString(value: string): bigint {
  if (!isValidSignedBigNumber(value)) {
    throw new Error(`Invalid big number string: ${value}`);
  }
  
  return BigInt(value);
}

/**
 * 比较两个大数字字符串
 * @param a 第一个数字字符串
 * @param b 第二个数字字符串
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareBigNumbers(a: string, b: string): -1 | 0 | 1 {
  const bigA = fromBigNumberString(a);
  const bigB = fromBigNumberString(b);
  
  if (bigA < bigB) return -1;
  if (bigA > bigB) return 1;
  return 0;
}

/**
 * 添加两个大数字字符串
 * @param a 第一个数字字符串
 * @param b 第二个数字字符串
 * @returns 相加后的结果字符串
 */
export function addBigNumbers(a: string, b: string): string {
  const bigA = fromBigNumberString(a);
  const bigB = fromBigNumberString(b);
  
  return (bigA + bigB).toString();
}

/**
 * 减去两个大数字字符串
 * @param a 被减数字符串
 * @param b 减数字符串
 * @returns 相减后的结果字符串
 */
export function subtractBigNumbers(a: string, b: string): string {
  const bigA = fromBigNumberString(a);
  const bigB = fromBigNumberString(b);
  
  return (bigA - bigB).toString();
}

/**
 * 检查余额是否充足
 * @param balance 当前余额字符串
 * @param amount 需要扣除的金额字符串
 * @returns 是否充足
 */
export function hasEnoughBalance(balance: string, amount: string): boolean {
  return compareBigNumbers(balance, amount) >= 0;
}

/**
 * 将 wei 转换为 ether（适用于以太坊）
 * @param wei wei 单位的字符串
 * @param decimals 小数位数，默认 18
 * @returns 格式化后的数字字符串
 */
export function formatTokenAmount(wei: string, decimals: number = 18): string {
  const weiBigInt = fromBigNumberString(wei);
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

/**
 * 将 ether 转换为 wei（适用于以太坊）
 * @param ether ether 单位的字符串（可以包含小数点）
 * @param decimals 小数位数，默认 18
 * @returns wei 单位的字符串
 */
export function parseTokenAmount(ether: string, decimals: number = 18): string {
  // 验证输入格式
  if (!/^\d+\.?\d*$/.test(ether)) {
    throw new Error(`Invalid ether format: ${ether}`);
  }
  
  const [integerPart = '0', fractionalPart = ''] = ether.split('.');
  
  // 检查小数位数是否超过限制
  if (fractionalPart.length > decimals) {
    throw new Error(`Fractional part exceeds ${decimals} decimals`);
  }
  
  // 补齐小数位数
  const paddedFractional = fractionalPart.padEnd(decimals, '0');
  const weiString = integerPart + paddedFractional;
  
  return BigInt(weiString).toString();
}

/**
 * 验证以太坊地址格式
 * @param address 地址字符串
 * @returns 是否为有效地址
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * 验证交易哈希格式
 * @param hash 交易哈希字符串
 * @returns 是否为有效哈希
 */
export function isValidTransactionHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}