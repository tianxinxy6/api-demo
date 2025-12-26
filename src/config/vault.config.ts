import { registerAs } from '@nestjs/config';
import { env, envBoolean } from '@/global/env';

/**
 * Vault 配置 - 密钥管理服务
 */
export default registerAs('vault', () => ({
  // Vault 服务器地址
  address: env('VAULT_ADDR', 'http://localhost:8200'),

  // Vault 认证令牌
  token: env('VAULT_TOKEN', 'dev-root-token'),

  // Vault 密钥存储路径
  secretPath: env('VAULT_SECRET_PATH', 'secret/data/wallet/privatekeys'),
}));
