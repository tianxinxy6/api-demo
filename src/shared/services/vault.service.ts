import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * 私钥存储数据接口
 */
export interface PrivateKeyData {
  address: string;
  privateKey: string;
  publicKey?: string;
  createdAt?: string;
  [key: string]: any;
}

/**
 * Vault Token 缓存接口
 */
interface TokenCache {
  token: string;
  expiry: number;
}

/**
 * HashiCorp Vault 服务
 *
 * 提供安全的密钥存储和管理功能，包括：
 * - Vault 连接和健康检查
 * - AppRole 认证
 * - 私钥存储/获取
 * - Token 缓存管理
 *
 * @example
 * ```typescript
 * // 存储私钥
 * await vaultService.storePrivateKey('wallet-123', {
 *   privateKey: '0x...',
 *   publicKey: '0x...',
 *   createdAt: new Date().toISOString()
 * });
 *
 * // 获取私钥
 * const keyData = await vaultService.getPrivateKey('wallet-123');
 * ```
 */
@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);
  private tokenCache: TokenCache = { token: '', expiry: 0 };

  private readonly address: string;
  private readonly secretPath: string;
  private readonly token?: string;
  private readonly roleId?: string;
  private readonly secretId?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    const vaultConfig = this.configService.get('app.vault');

    this.address = vaultConfig.address;
    this.secretPath = vaultConfig.secretPath;
    this.token = vaultConfig.token;
    this.roleId = vaultConfig.roleId;
    this.secretId = vaultConfig.secretId;

    if (!this.address || !this.secretPath) {
      throw new Error('Vault address and secretPath are required');
    }

    this.initializeVault();
  }

  /**
   * 初始化 Vault 连接并进行健康检查
   */
  private async initializeVault(): Promise<void> {
    try {
      const healthResponse = await firstValueFrom(
        this.httpService.get(`${this.address}/v1/sys/health`, {
          validateStatus: () => true,
          timeout: 5000,
        }),
      );

      if (healthResponse.status === 200) {
        this.logger.log('Vault health check passed');
      } else {
        this.logger.warn(`Vault health check returned status ${healthResponse.status}`);
      }
    } catch (error) {
      this.logger.error(`Vault initialization failed: ${error.message}`);
      throw new Error(`Failed to connect to Vault: ${error.message}`);
    }
  }

  /**
   * 获取有效的 Vault Token
   *
   * 使用 AppRole 认证获取短生命周期的 token
   * 自动处理 token 缓存和续期
   *
   * @returns {Promise<string>} Vault token
   * @throws {BadRequestException} 当认证失败时
   */
  private async getVaultToken(): Promise<string> {
    // 检查缓存的 token 是否仍然有效
    if (this.tokenCache.token && this.tokenCache.expiry > Date.now()) {
      return this.tokenCache.token;
    }

    // 如果有预设的 token，直接使用
    if (this.token) {
      this.tokenCache.token = this.token;
      this.tokenCache.expiry = Date.now() + 3600000; // 1 hour
      return this.token;
    }

    // 使用 AppRole 认证获取新 token
    try {
      if (!this.roleId || !this.secretId) {
        throw new BadRequestException('Vault AppRole credentials (roleId/secretId) not configured');
      }

      const authResponse = await firstValueFrom(
        this.httpService.post(
          `${this.address}/v1/auth/approle/login`,
          {
            role_id: this.roleId,
            secret_id: this.secretId,
          },
          { timeout: 10000 },
        ),
      );

      const authData = authResponse.data.auth;
      this.tokenCache.token = authData.client_token;
      this.tokenCache.expiry = Date.now() + authData.lease_duration * 1000;

      this.logger.debug(`Got new Vault token, expires in ${authData.lease_duration}s`);

      return this.tokenCache.token;
    } catch (error) {
      this.logger.error(`Failed to get Vault token: ${error.message}`);
      throw new BadRequestException('Vault authentication failed');
    }
  }

  /**
   * 存储私钥到 Vault
   *
   * @param {string} walletId - 钱包ID，用作存储路径的一部分
   * @param {PrivateKeyData} keyData - 要存储的私钥数据
   * @returns {Promise<void>}
   * @throws {BadRequestException} 当 Vault 未启用或存储失败时
   *
   * @example
   * ```typescript
   * await vaultService.storePrivateKey('wallet-123', {
   *   privateKey: '0x1234...',
   *   publicKey: '0x5678...',
   *   createdAt: new Date().toISOString()
   * });
   * ```
   */
  async storePrivateKey(walletId: string, keyData: PrivateKeyData): Promise<void> {
    try {
      const token = await this.getVaultToken();
      const secretPath = `${this.secretPath}/${walletId}`;

      const payload = {
        data: {
          ...keyData,
          createdAt: keyData.createdAt || new Date().toISOString(),
        },
      };

      await firstValueFrom(
        this.httpService.post(`${this.address}/v1/${secretPath}`, payload, {
          headers: {
            'X-Vault-Token': token,
          },
          timeout: 10000,
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to store private key in Vault: ${error.message}`);
      throw new BadRequestException('Failed to store private key securely');
    }
  }

  /**
   * 从 Vault 获取私钥
   *
   * @param {string} walletId - 钱包ID
   * @returns {Promise<PrivateKeyData | null>} 私钥数据，如果不存在则返回 null
   * @throws {BadRequestException} 当 Vault 未启用或获取失败时
   *
   * @example
   * ```typescript
   * const keyData = await vaultService.getPrivateKey('wallet-123');
   * if (keyData) {
   *   console.log('Private key:', keyData.privateKey);
   * }
   * ```
   */
  async getPrivateKey(walletId: string): Promise<PrivateKeyData | null> {
    try {
      const token = await this.getVaultToken();
      const secretPath = `${this.secretPath}/${walletId}`;

      const response = await firstValueFrom(
        this.httpService.get(`${this.address}/v1/${secretPath}`, {
          headers: {
            'X-Vault-Token': token,
          },
          timeout: 10000,
        }),
      );

      const keyData = response.data?.data?.data;

      if (!keyData || !keyData.privateKey) {
        this.logger.warn(`No private key found for wallet ${walletId}`);
        return null;
      }

      return keyData;
    } catch (error) {
      if (error.response?.status === 404) {
        this.logger.warn(`Private key not found for wallet ${walletId}`);
        return null;
      }

      this.logger.error(`Failed to retrieve private key from Vault: ${error.message}`);
      throw new BadRequestException('Failed to retrieve private key');
    }
  }

  /**
   * 检查私钥是否存在
   *
   * @param {string} walletId - 钱包ID
   * @returns {Promise<boolean>} 私钥是否存在
   *
   * @example
   * ```typescript
   * const exists = await vaultService.hasPrivateKey('wallet-123');
   * if (exists) {
   *   console.log('Private key exists');
   * }
   * ```
   */
  async hasPrivateKey(walletId: string): Promise<boolean> {
    try {
      const keyData = await this.getPrivateKey(walletId);
      return keyData !== null;
    } catch (_error) {
      return false;
    }
  }

  /**
   * 列出所有存储的钱包ID（需要 Vault 权限支持）
   *
   * @returns {Promise<string[]>} 钱包ID列表
   * @throws {BadRequestException} 当操作失败时
   *
   * @example
   * ```typescript
   * const walletIds = await vaultService.listWallets();
   * console.log('All wallets:', walletIds);
   * ```
   */
  async listWallets(): Promise<string[]> {
    try {
      const token = await this.getVaultToken();

      const response = await firstValueFrom(
        this.httpService.request({
          method: 'LIST',
          url: `${this.address}/v1/${this.secretPath}`,
          headers: {
            'X-Vault-Token': token,
          },
          timeout: 10000,
        }),
      );

      return response.data?.data?.keys || [];
    } catch (error) {
      this.logger.error(`Failed to list wallets: ${error.message}`);
      throw new BadRequestException('Failed to list wallets');
    }
  }

  /**
   * 清除 token 缓存
   * 强制下次请求重新获取 token
   */
  clearTokenCache(): void {
    this.tokenCache = { token: '', expiry: 0 };
    this.logger.debug('Vault token cache cleared');
  }

  /**
   * 获取 Vault 状态信息
   *
   * @returns {Promise<any>} Vault 状态信息
   */
  async getVaultStatus(): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.address}/v1/sys/health`, {
          timeout: 5000,
        }),
      );

      return {
        healthy: response.status === 200,
        status: response.data,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }
}
