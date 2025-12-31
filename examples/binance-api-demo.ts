/**
 * Binance API 测试脚本
 * 用于验证 Binance API 是否可用
 * 
 * 运行方式：
 * npx ts-node examples/binance-api-demo.ts
 */

import axios from 'axios';

const BINANCE_API_URL = 'https://api.binance.com/api/v3';

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
 * 测试 1: 检查 API 连接
 */
async function testApiConnection() {
  try {
    log(colors.blue, '\n📡 测试 1: 检查 Binance API 连接...');
    const response = await axios.get(`${BINANCE_API_URL}/ping`);
    log(colors.green, '✅ API 连接正常');
    return true;
  } catch (error) {
    log(colors.red, '❌ API 连接失败');
    console.error(error.message);
    return false;
  }
}

/**
 * 测试 2: 获取服务器时间
 */
async function testServerTime() {
  try {
    log(colors.blue, '\n⏰ 测试 2: 获取服务器时间...');
    const response = await axios.get(`${BINANCE_API_URL}/time`);
    const serverTime = new Date(response.data.serverTime);
    log(colors.green, `✅ 服务器时间: ${serverTime.toLocaleString('zh-CN')}`);
    return true;
  } catch (error) {
    log(colors.red, '❌ 获取服务器时间失败');
    console.error(error.message);
    return false;
  }
}

/**
 * 测试 3: 获取单个交易对价格
 */
async function testSinglePrice() {
  try {
    log(colors.blue, '\n💰 测试 3: 获取 BTC 价格...');
    const response = await axios.get(`${BINANCE_API_URL}/ticker/price`, {
      params: { symbol: 'BTCUSDT' },
    });
    const { symbol, price } = response.data;
    console.log(response.data);
    log(colors.green, `✅ ${symbol}: $${parseFloat(price).toLocaleString()}`);
    return true;
  } catch (error) {
    log(colors.red, '❌ 获取价格失败');
    console.error(error.message);
    return false;
  }
}

/**
 * 测试 4: 获取 24 小时价格变动统计
 */
async function test24hTicker() {
  try {
    log(colors.blue, '\n📊 测试 4: 获取 24h 价格统计（多个币种）...');
    const symbols = ['BTCUSDT', 'ETHUSDT', 'TRXUSDT', 'BNBUSDT'];
    
    for (const symbol of symbols) {
      const response = await axios.get(`${BINANCE_API_URL}/ticker/24hr`, {
        params: { symbol },
      });
      const data = response.data;
      
      const priceChangePercent = parseFloat(data.priceChangePercent);
      const priceColor = priceChangePercent >= 0 ? colors.green : colors.red;
      const arrow = priceChangePercent >= 0 ? '📈' : '📉';
      
      console.log(
        `${priceColor}${arrow} ${data.symbol.padEnd(10)}${colors.reset}` +
        ` 价格: $${parseFloat(data.lastPrice).toLocaleString().padStart(12)}` +
        ` | 24h 涨跌: ${priceColor}${priceChangePercent > 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%${colors.reset}` +
        ` | 24h 高: $${parseFloat(data.highPrice).toLocaleString()}` +
        ` | 24h 低: $${parseFloat(data.lowPrice).toLocaleString()}`
      );
    }
    
    log(colors.green, '\n✅ 获取 24h 统计数据成功');
    return true;
  } catch (error) {
    log(colors.red, '❌ 获取 24h 统计数据失败');
    console.error(error.message);
    return false;
  }
}

/**
 * 测试 5: 批量获取价格
 */
async function testMultiplePrices() {
  try {
    log(colors.blue, '\n🔢 测试 5: 批量获取价格...');
    const response = await axios.get(`${BINANCE_API_URL}/ticker/price`);
    const prices = response.data;
    
    log(colors.green, `✅ 成功获取 ${prices.length} 个交易对的价格`);
    
    // 显示前 10 个 USDT 交易对
    const usdtPairs = prices
      .filter((p: any) => p.symbol.endsWith('USDT'))
      .slice(0, 10);
    
    console.log('\n前 10 个 USDT 交易对:');
    usdtPairs.forEach((p: any) => {
      console.log(`  ${p.symbol.padEnd(12)} $${parseFloat(p.price).toLocaleString()}`);
    });
    
    return true;
  } catch (error) {
    log(colors.red, '❌ 批量获取价格失败');
    console.error(error.message);
    return false;
  }
}

/**
 * 测试 6: 测试 API 响应速度
 */
async function testResponseTime() {
  try {
    log(colors.blue, '\n⚡ 测试 6: 测试 API 响应速度...');
    
    const tests = 5;
    const times: number[] = [];
    
    for (let i = 0; i < tests; i++) {
      const start = Date.now();
      await axios.get(`${BINANCE_API_URL}/ticker/price`, {
        params: { symbol: 'BTCUSDT' },
      });
      const duration = Date.now() - start;
      times.push(duration);
      console.log(`  请求 ${i + 1}: ${duration}ms`);
    }
    
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    log(colors.green, `\n✅ 平均响应时间: ${avg.toFixed(2)}ms`);
    console.log(`   最快: ${min}ms | 最慢: ${max}ms`);
    
    return true;
  } catch (error) {
    log(colors.red, '❌ 响应速度测试失败');
    console.error(error.message);
    return false;
  }
}

/**
 * 主测试函数
 */
async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║    Binance API 测试脚本                    ║');
  console.log('║    测试所有核心功能是否正常工作            ║');
  console.log('╚════════════════════════════════════════════╝');

  const results = {
    connection: false,
    serverTime: false,
    singlePrice: false,
    ticker24h: false,
    multiplePrices: false,
    responseTime: false,
  };

  // 按顺序执行所有测试
  results.connection = await testApiConnection();
  if (!results.connection) {
    log(colors.red, '\n❌ API 连接失败，跳过后续测试');
    return;
  }

  results.serverTime = await testServerTime();
  results.singlePrice = await testSinglePrice();
  results.ticker24h = await test24hTicker();
  results.multiplePrices = await testMultiplePrices();
  results.responseTime = await testResponseTime();

  // 总结
  console.log('\n' + '═'.repeat(50));
  log(colors.blue, '\n📋 测试总结:');
  console.log('═'.repeat(50));
  
  const total = Object.keys(results).length;
  const passed = Object.values(results).filter(Boolean).length;
  
  Object.entries(results).forEach(([key, value]) => {
    const status = value ? '✅ 通过' : '❌ 失败';
    const color = value ? colors.green : colors.red;
    log(color, `${status} - ${key}`);
  });
  
  console.log('═'.repeat(50));
  
  if (passed === total) {
    log(colors.green, `\n🎉 所有测试通过！(${passed}/${total})`);
    log(colors.green, '✅ Binance API 可以正常使用');
  } else {
    log(colors.yellow, `\n⚠️  部分测试失败 (${passed}/${total})`);
    log(colors.yellow, '请检查网络连接或 Binance API 状态');
  }
  
  console.log('\n提示: 如果所有测试通过，你的 NestJS 应用可以正常调用 Binance API');
}

// 运行测试
main().catch((error) => {
  log(colors.red, '\n❌ 测试过程中发生错误:');
  console.error(error);
  process.exit(1);
});
