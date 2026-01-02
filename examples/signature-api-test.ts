#!/usr/bin/env ts-node
/**
 * 实际 API 签名验证测试
 * 
 * 运行方式：
 *   1. 先启动服务: npm run start:dev
 *   2. 运行测试: npm run test:signature-api
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
 * 测试 1: 不带签名访问需要签名的接口（应该失败）
 */
async function testWithoutSignature() {
  try {
    log(colors.blue, '\n🧪 测试 1: 不带签名访问需要签名的接口...');

    const body = {
      amount: 100,
      toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    };

    const response = await axios.post(`${API_URL}/test/with-signature`, body);

    // 检查响应的 code 字段（业务错误返回 200 状态码，通过 code 区分）
    if (response.data.code !== 0) {
      log(colors.green, `✅ 测试通过：请求被拒绝 (code: ${response.data.code})`);
      log(colors.yellow, `   错误信息: ${response.data.message}`);
      return true;
    } else {
      log(colors.red, '❌ 测试失败：应该被拒绝，但请求成功了');
      return false;
    }
  } catch (error: any) {
    log(colors.red, `❌ 测试失败：未知错误 - ${error.message}`);
    return false;
  }
}

/**
 * 测试 2: 带正确签名访问接口（应该成功）
 */
async function testWithValidSignature() {
  try {
    log(colors.blue, '\n🧪 测试 2: 带正确签名访问接口...');

    const body = {
      amount: 100,
      toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    };

    const { signature, timestamp } = generateSignature(body);

    log(colors.yellow, `   签名: ${signature.substring(0, 32)}...`);
    log(colors.yellow, `   时间戳: ${timestamp}`);

    const response = await axios.post(`${API_URL}/test/with-signature`, body, {
      headers: {
        'x-signature': signature,
        'x-timestamp': timestamp.toString(),
      },
    });

    // POST 请求可能返回 200 或 201
    if ((response.status === 200 || response.status === 201) && response.data.code === 0) {
      log(colors.green, '✅ 测试通过：签名验证成功');
      log(colors.yellow, `   返回数据: ${JSON.stringify(response.data)}`);
      return true;
    } else {
      log(colors.red, `❌ 测试失败：status=${response.status}, code=${response.data?.code}`);
      return false;
    }
  } catch (error: any) {
    log(colors.red, `❌ 测试失败: ${error.message}`);
    if (error.response?.data) {
      log(colors.yellow, `   错误详情: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

/**
 * 测试 3: 带错误签名访问接口（应该失败）
 */
async function testWithInvalidSignature() {
  try {
    log(colors.blue, '\n🧪 测试 3: 带错误签名访问接口...');

    const body = {
      amount: 100,
      toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    };

    const timestamp = Date.now();
    const invalidSignature = 'invalid_signature_12345678';

    log(colors.yellow, `   签名: ${invalidSignature} (错误)`);

    const response = await axios.post(`${API_URL}/test/with-signature`, body, {
      headers: {
        'x-signature': invalidSignature,
        'x-timestamp': timestamp.toString(),
      },
    });

    // 检查响应的 code 字段
    if (response.data.code !== 0) {
      log(colors.green, `✅ 测试通过：错误签名被拒绝 (code: ${response.data.code})`);
      log(colors.yellow, `   错误信息: ${response.data.message}`);
      return true;
    } else {
      log(colors.red, '❌ 测试失败：应该被拒绝，但请求成功了');
      return false;
    }
  } catch (error: any) {
    log(colors.red, `❌ 测试失败：未知错误 - ${error.message}`);
    return false;
  }
}

/**
 * 测试 4: 访问跳过签名验证的接口（应该成功）
 */
async function testSkipSignature() {
  try {
    log(colors.blue, '\n🧪 测试 4: 访问跳过签名验证的接口...');

    const body = {
      amount: 100,
      toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    };

    const response = await axios.post(`${API_URL}/test/without-signature`, body);

    // 检查 success 字段或 code 字段
    if ((response.status === 200 || response.status === 201) && 
        (response.data.success === true || response.data.code === 0)) {
      log(colors.green, '✅ 测试通过：跳过签名验证成功');
      log(colors.yellow, `   返回数据: ${JSON.stringify(response.data)}`);
      return true;
    } else {
      log(colors.red, `❌ 测试失败：response=${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error: any) {
    log(colors.red, `❌ 测试失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试 5: 过期时间戳（应该失败）
 */
async function testExpiredTimestamp() {
  try {
    log(colors.blue, '\n🧪 测试 5: 过期时间戳（6分钟前）...');

    const body = {
      amount: 100,
      toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    };

    // 6分钟前的时间戳
    const expiredTimestamp = Date.now() - 6 * 60 * 1000;
    const data = `${expiredTimestamp}${JSON.stringify(body)}`;
    const signature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');

    log(colors.yellow, `   时间戳: ${expiredTimestamp} (6分钟前)`);

    const response = await axios.post(`${API_URL}/test/with-signature`, body, {
      headers: {
        'x-signature': signature,
        'x-timestamp': expiredTimestamp.toString(),
      },
    });

    // 检查响应的 code 字段
    if (response.data.code !== 0) {
      log(colors.green, `✅ 测试通过：过期时间戳被拒绝 (code: ${response.data.code})`);
      log(colors.yellow, `   错误信息: ${response.data.message}`);
      return true;
    } else {
      log(colors.red, '❌ 测试失败：应该被拒绝，但请求成功了');
      return false;
    }
  } catch (error: any) {
    log(colors.red, `❌ 测试失败：未知错误 - ${error.message}`);
    return false;
  }
}

/**
 * 测试 6: 参数被篡改（应该失败）
 */
async function testTamperedData() {
  try {
    log(colors.blue, '\n🧪 测试 6: 参数被篡改...');

    const originalBody = {
      amount: 100,
      toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    };

    // 生成签名
    const { signature, timestamp } = generateSignature(originalBody);

    // 篡改数据
    const tamperedBody = {
      amount: 10000, // 修改金额
      toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    };

    log(colors.yellow, `   原始金额: ${originalBody.amount}`);
    log(colors.yellow, `   篡改金额: ${tamperedBody.amount}`);

    const response = await axios.post(`${API_URL}/test/with-signature`, tamperedBody, {
      headers: {
        'x-signature': signature,
        'x-timestamp': timestamp.toString(),
      },
    });

    // 检查响应的 code 字段
    if (response.data.code !== 0) {
      log(colors.green, `✅ 测试通过：篡改数据被检测到 (code: ${response.data.code})`);
      log(colors.yellow, `   错误信息: ${response.data.message}`);
      return true;
    } else {
      log(colors.red, '❌ 测试失败：应该被拒绝，但请求成功了');
      return false;
    }
  } catch (error: any) {
    log(colors.red, `❌ 测试失败：未知错误 - ${error.message}`);
    return false;
  }
}

/**
 * 主测试函数
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║      实际 API 签名验证测试                           ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  log(colors.yellow, '\n⚠️ 请确保服务正在运行: npm run start:dev');
  log(colors.yellow, '⚠️ 请确保 .env 中设置: SIGNATURE_ENABLED=true\n');

  // 等待用户确认
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const results = {
    withoutSignature: false,
    withValidSignature: false,
    withInvalidSignature: false,
    skipSignature: false,
    expiredTimestamp: false,
    tamperedData: false,
  };

  // 运行所有测试
  results.skipSignature = await testSkipSignature();
  results.withoutSignature = await testWithoutSignature();
  results.withValidSignature = await testWithValidSignature();
  results.withInvalidSignature = await testWithInvalidSignature();
  results.expiredTimestamp = await testExpiredTimestamp();
  results.tamperedData = await testTamperedData();

  // 总结
  log(colors.blue, '\n╔═══════════════════════════════════════════════════════╗');
  log(colors.blue, '║  测试总结                                             ║');
  log(colors.blue, '╚═══════════════════════════════════════════════════════╝');

  const passed = Object.values(results).filter((r) => r).length;
  const total = Object.values(results).length;

  log(colors.yellow, `\n通过: ${passed}/${total}`);

  Object.entries(results).forEach(([name, result]) => {
    const icon = result ? '✅' : '❌';
    const color = result ? colors.green : colors.red;
    log(color, `${icon} ${name}`);
  });

  if (passed === total) {
    log(colors.green, '\n🎉 所有测试通过！签名验证功能正常工作！');
  } else {
    log(colors.yellow, '\n⚠️ 部分测试未通过，请检查配置');
  }

  log(colors.reset, '');
}

// 运行测试
main().catch((error) => {
  log(colors.red, `\n❌ 测试出错: ${error.message}`);
  log(colors.yellow, '\n请确保:');
  log(colors.yellow, '1. 服务正在运行: npm run start:dev');
  log(colors.yellow, '2. 配置正确: SIGNATURE_ENABLED=true in .env');
  log(colors.reset, '');
  process.exit(1);
});
