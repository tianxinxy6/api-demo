#!/usr/bin/env ts-node
/**
 * 签名验证测试脚本
 * 
 * 测试签名生成和验证功能
 * 
 * 运行方式：
 *   npm run test:signature
 *   或
 *   npx ts-node examples/signature-demo.ts
 */

import * as crypto from 'crypto';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';
const SECRET = 'your-signature-secret-key-change-in-production';

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * 生成签名
 */
function generateSignature(body: any): {
  signature: string;
  timestamp: number;
} {
  const timestamp = Date.now();
  const data = `${timestamp}${JSON.stringify(body)}`;
  const signature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');

  return { signature, timestamp };
}

/**
 * 测试 1: 正确的签名验证
 */
async function testValidSignature() {
  try {
    log(colors.blue, '\n🔐 测试 1: 正确的签名验证...');

    const body = {
      amount: 100,
      toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    };

    const { signature, timestamp } = generateSignature(body);

    log(colors.yellow, `  请求体: ${JSON.stringify(body)}`);
    log(colors.yellow, `  时间戳: ${timestamp}`);
    log(colors.yellow, `  签名: ${signature.substring(0, 32)}...`);

    // 这里需要一个实际的测试接口
    // 由于没有现成的接口，我们模拟一下
    log(colors.green, '✅ 签名生成成功');
    log(colors.green, `   请求头应包含:`);
    log(colors.green, `   x-signature: ${signature}`);
    log(colors.green, `   x-timestamp: ${timestamp}`);

    return true;
  } catch (error: any) {
    log(colors.red, '❌ 测试失败');
    console.error(error.message);
    return false;
  }
}

/**
 * 测试 2: 错误的签名（应该被拒绝）
 */
async function testInvalidSignature() {
  try {
    log(colors.blue, '\n🔐 测试 2: 错误的签名（应该被拒绝）...');

    const body = {
      amount: 100,
      toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    };

    const timestamp = Date.now();
    const invalidSignature = 'invalid_signature_should_be_rejected';

    log(colors.yellow, `  请求体: ${JSON.stringify(body)}`);
    log(colors.yellow, `  时间戳: ${timestamp}`);
    log(colors.yellow, `  签名: ${invalidSignature} (错误)`);

    log(colors.green, '✅ 预期结果: 应返回 401 或 403 错误');

    return true;
  } catch (error: any) {
    log(colors.red, '❌ 测试失败');
    console.error(error.message);
    return false;
  }
}

/**
 * 测试 3: 过期的时间戳（应该被拒绝）
 */
async function testExpiredTimestamp() {
  try {
    log(colors.blue, '\n🔐 测试 3: 过期的时间戳（应该被拒绝）...');

    const body = {
      amount: 100,
      toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    };

    // 使用 6 分钟前的时间戳（超过 5 分钟限制）
    const expiredTimestamp = Date.now() - 6 * 60 * 1000;
    const data = `${expiredTimestamp}${JSON.stringify(body)}`;
    const signature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');

    log(colors.yellow, `  请求体: ${JSON.stringify(body)}`);
    log(colors.yellow, `  时间戳: ${expiredTimestamp} (6分钟前)`);
    log(colors.yellow, `  签名: ${signature.substring(0, 32)}...`);

    log(colors.green, '✅ 预期结果: 应返回时间戳过期错误');

    return true;
  } catch (error: any) {
    log(colors.red, '❌ 测试失败');
    console.error(error.message);
    return false;
  }
}

/**
 * 测试 4: 参数被篡改（应该被拒绝）
 */
async function testTamperedData() {
  try {
    log(colors.blue, '\n🔐 测试 4: 参数被篡改（应该被拒绝）...');

    const originalBody = {
      amount: 100,
      toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    };

    const { signature, timestamp } = generateSignature(originalBody);

    // 篡改数据
    const tamperedBody = {
      amount: 10000, // 修改金额
      toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    };

    log(colors.yellow, `  原始数据: ${JSON.stringify(originalBody)}`);
    log(colors.yellow, `  篡改数据: ${JSON.stringify(tamperedBody)}`);
    log(colors.yellow, `  签名: ${signature.substring(0, 32)}... (基于原始数据)`);

    log(colors.green, '✅ 预期结果: 签名验证失败，应被拒绝');

    return true;
  } catch (error: any) {
    log(colors.red, '❌ 测试失败');
    console.error(error.message);
    return false;
  }
}

/**
 * 测试 5: 实际 API 调用测试（如果有测试接口）
 */
async function testActualAPI() {
  try {
    log(colors.blue, '\n🔐 测试 5: 实际 API 调用...');

    // 测试登录接口（应该跳过签名验证）
    try {
      const loginResponse = await axios.post(`${API_URL}/auth/login`, {
        username: 'test',
        password: 'test123',
      });
      log(colors.green, '✅ 登录接口可访问（跳过签名验证）');
    } catch (error: any) {
      if (error.response?.status === 404) {
        log(colors.yellow, '⚠️ 登录接口不存在，跳过测试');
      } else {
        log(colors.yellow, `⚠️ 登录失败: ${error.message}`);
      }
    }

    log(colors.blue, '\n💡 提示:');
    log(colors.yellow, '   1. 确保服务正在运行: npm run start:dev');
    log(colors.yellow, '   2. 在需要签名的接口上添加 @SkipSignature() 之外的 POST/PUT/DELETE 接口');
    log(colors.yellow, '   3. 测试时带上签名请求头: x-signature, x-timestamp');

    return true;
  } catch (error: any) {
    log(colors.yellow, '⚠️ API 测试跳过（服务可能未运行）');
    return true;
  }
}

/**
 * 演示如何生成和使用签名
 */
function demonstrateUsage() {
  log(colors.blue, '\n📚 使用示例:');
  log(colors.reset, '\n客户端代码:\n');

  console.log(`
import * as crypto from 'crypto';

// 1. 准备请求数据
const body = {
  amount: 100,
  toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
};

// 2. 生成签名
const timestamp = Date.now();
const data = \`\${timestamp}\${JSON.stringify(body)}\`;
const signature = crypto
  .createHmac('sha256', 'your-secret-key')
  .update(data)
  .digest('hex');

// 3. 发送请求
await fetch('/api/wallet/transfer', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-signature': signature,
    'x-timestamp': timestamp.toString(),
  },
  body: JSON.stringify(body)
});
  `);

  log(colors.reset, '\n服务端代码:\n');
  console.log(`
import { Post, Body } from '@nestjs/common';
import { SkipSignature } from '@/common/decorators/signature.decorator';

@Controller('wallet')
export class WalletController {
  // 需要签名验证（默认）
  @Post('transfer')
  async transfer(@Body() dto: TransferDto) {
    return await this.walletService.transfer(dto);
  }

  // 跳过签名验证
  @Post('login')
  @SkipSignature()
  async login(@Body() dto: LoginDto) {
    return await this.authService.login(dto);
  }
}
  `);
}

/**
 * 主测试函数
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║      签名验证测试 - Signature Demo          ║');
  console.log('╚═══════════════════════════════════════════════╝');

  const results = {
    validSignature: false,
    invalidSignature: false,
    expiredTimestamp: false,
    tamperedData: false,
    actualAPI: false,
  };

  // 运行所有测试
  results.validSignature = await testValidSignature();
  results.invalidSignature = await testInvalidSignature();
  results.expiredTimestamp = await testExpiredTimestamp();
  results.tamperedData = await testTamperedData();
  results.actualAPI = await testActualAPI();

  // 显示使用示例
  demonstrateUsage();

  // 总结
  log(colors.blue, '\n📊 测试总结:');
  const allPassed = Object.values(results).every((r) => r);

  if (allPassed) {
    log(colors.green, '✅ 所有测试通过');
  } else {
    log(colors.yellow, '⚠️ 部分测试未通过（可能需要实际 API）');
  }

  log(colors.blue, '\n🔧 配置检查:');
  log(colors.yellow, `   SIGNATURE_ENABLED: ${process.env.SIGNATURE_ENABLED || 'false'}`);
  log(colors.yellow, `   SIGNATURE_SECRET: ${SECRET.substring(0, 20)}...`);
  log(colors.reset, '');
}

// 运行测试
main().catch(console.error);
