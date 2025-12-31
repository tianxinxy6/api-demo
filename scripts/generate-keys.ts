#!/usr/bin/env ts-node
/**
 * 生成安全密钥脚本
 * 用于初始化 ENCRYPT_KEY 和 JWT_SECRET
 * 
 * 使用方法:
 *   npm run generate:keys
 *   或
 *   npx ts-node scripts/generate-keys.ts
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 生成随机密钥
 * @param length 密钥长度（字节）
 * @returns 十六进制格式的密钥
 */
function generateKey(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * 生成 Base64 密钥（适用于 JWT）
 * @param length 密钥长度（字节）
 * @returns Base64 格式的密钥
 */
function generateBase64Key(length: number = 64): string {
  return crypto.randomBytes(length).toString('base64');
}

/**
 * 读取现有的 .env 文件
 */
function readEnvFile(envPath: string): string {
  if (fs.existsSync(envPath)) {
    return fs.readFileSync(envPath, 'utf-8');
  }
  return '';
}

/**
 * 更新 .env 文件中的密钥
 */
function updateEnvFile(envPath: string, key: string, value: string): void {
  let content = readEnvFile(envPath);
  
  // 检查 key 是否已存在
  const regex = new RegExp(`^${key}=.*$`, 'm');
  
  if (regex.test(content)) {
    // 替换现有值
    content = content.replace(regex, `${key}=${value}`);
    console.log(`✅ 更新 ${key}`);
  } else {
    // 添加新值
    content += `\n${key}=${value}\n`;
    console.log(`✅ 添加 ${key}`);
  }
  
  fs.writeFileSync(envPath, content, 'utf-8');
}

/**
 * 备份 .env 文件
 */
function backupEnvFile(envPath: string): void {
  if (fs.existsSync(envPath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${envPath}.backup-${timestamp}`;
    fs.copyFileSync(envPath, backupPath);
    console.log(`📦 已备份到: ${backupPath}`);
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🔐 安全密钥生成工具\n');
  
  const projectRoot = path.resolve(__dirname, '..');
  const envPath = path.join(projectRoot, '.env');
  const envLocalPath = path.join(projectRoot, '.env.local');
  
  // 检查命令行参数
  const args = process.argv.slice(2);
  const forceFlag = args.includes('--force') || args.includes('-f');
  const localFlag = args.includes('--local') || args.includes('-l');
  const noBackupFlag = args.includes('--no-backup');
  
  const targetEnvPath = localFlag ? envLocalPath : envPath;
  const envFileName = localFlag ? '.env.local' : '.env';
  
  console.log(`📝 目标文件: ${envFileName}`);
  
  // 备份现有文件
  if (!noBackupFlag && fs.existsSync(targetEnvPath)) {
    backupEnvFile(targetEnvPath);
  }
  
  console.log('\n🔑 生成新密钥...\n');
  
  // 生成密钥
  const encryptionKey = generateKey(32); // 256-bit key
  const jwtSecret = generateBase64Key(64); // 512-bit key
  
  // 更新 .env 文件
  updateEnvFile(targetEnvPath, 'ENCRYPT_KEY', encryptionKey);
  updateEnvFile(targetEnvPath, 'JWT_SECRET', jwtSecret);
  
  console.log('\n✨ 密钥生成完成!\n');
  console.log('生成的密钥信息:');
  console.log('─────────────────────────────────────');
  console.log(`ENCRYPT_KEY: ${encryptionKey.substring(0, 20)}...`);
  console.log(`JWT_SECRET:     ${jwtSecret.substring(0, 20)}...`);
  console.log('─────────────────────────────────────\n');
  
  console.log('⚠️  安全提示:');
  console.log('1. 请勿将密钥提交到版本控制系统');
  console.log('2. 生产环境请使用不同的密钥');
  console.log('3. 定期更换密钥以提高安全性');
  console.log('4. 备份文件已保存，可用于恢复\n');
  
  // 显示其他有用命令
  console.log('其他命令:');
  console.log('  生成到 .env.local:  npm run generate:keys -- --local');
  console.log('  强制重新生成:       npm run generate:keys -- --force');
  console.log('  跳过备份:           npm run generate:keys -- --no-backup\n');
}

// 执行主函数
try {
  main();
} catch (error) {
  console.error('❌ 错误:', error);
  process.exit(1);
}
