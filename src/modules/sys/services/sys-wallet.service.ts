import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import * as crypto from 'crypto';
import { AddressInfo, ChainType, Status, SysWalletType } from '@/constants';
import { VaultUtil, VaultConfig } from '@/utils/vault.util';
import { ConfigService } from '@nestjs/config';
import { SysWalletAddressEntity } from '@/entities/sys-wallet-address.entity';
import { WalletService } from '@/shared/services/wallet.service';
import { ConfigService as SystemConfigService } from '@/shared/config/config.service';

/**
 * 链上地址服务
 * 
 * 主要功能：
 * 1. 生成 ETH/TRON 钱包地址
 * 2. 管理用户在不同区块链上的专属充值地址
 * 3. 私钥安全存储（使用 Vault）
 * 4. 获取用户钱包地址列表
 * 
 * 设计原则：
 * - API 返回数据最小化
 * - 使用 DTO 规范输入输出
 * - 敏感信息（私钥）不在常规 API 中返回
 */
@Injectable()
export class SysWalletAddressService {
    private readonly logger = new Logger(SysWalletAddressService.name);
    private readonly CACHE_TTL = 3600000; // 1小时缓存
    private vaultUtil: VaultUtil;

    constructor(
        @InjectRepository(SysWalletAddressEntity)
        private readonly walletAddressRepository: Repository<SysWalletAddressEntity>,
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
        private readonly walletService: WalletService,
        private readonly systemConfigService: SystemConfigService,
    ) {
        // 初始化 Vault 配置
        const vaultConfig: VaultConfig = this.configService.get('vault');
        this.vaultUtil = new VaultUtil(vaultConfig, this.httpService);
    }

    /**
     * 创建新的链上地址
     */
    async createAddress(chainType: ChainType): Promise<void> {
        const address = await this.walletAddressRepository.findOne({
            where: { chainType },
        });
        if (address) {
            return;
        }

        try {
            // 生成新地址
            const addressInfo = await this.walletService.generateWallet(chainType);

            // 保存到数据库
            const walletAddress = new SysWalletAddressEntity();
            walletAddress.chainId = 0;
            walletAddress.type = SysWalletType.Fee;
            walletAddress.chainType = chainType;
            walletAddress.name = 'fee_wallet';
            walletAddress.address = addressInfo.address;
            walletAddress.status = Status.Enabled;

            const savedAddress = await this.walletAddressRepository.save(walletAddress);

            // 将私钥加密存储到 Vault
            await this.storePrivateKeyToVault(savedAddress.id, addressInfo);

            this.logger.log(`Successfully created chain address ${addressInfo.address} for system wallet`);
        } catch (error) {
            this.logger.error(`Failed to create chain address: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getFeeWallet(chainType: ChainType): Promise<string> {
        return await this.getWallet(chainType, SysWalletType.Fee);
    }

    async getWithdrawWallet(chainType: ChainType): Promise<string> {
        return await this.getWallet(chainType, SysWalletType.Widthdraw);
    }

    /**
     * 获取手续费钱包地址的私钥
     */
    async getWallet(chainType: ChainType, type: SysWalletType): Promise<string> {
        const address = await this.walletAddressRepository.findOne({
            where: {
                chainType,
                type,
                status: Status.Enabled,
            },
        });
        if (!address) {
            throw new BadRequestException(`System wallet address for chain type ${chainType} not found`);
        }
        return await this.getPrivateKey(address.id);
    }

    /**
     * 获取归集钱包地址
     * 从 config 表中读取归集钱包地址配置
     * @param chainType 链类型
     * @returns 归集钱包地址
     */
    async getCollectWalletAddress(chainName: string): Promise<string | null> {
        // 根据链类型构建配置键名
        const configKey = `collect_wallet_address_${chainName.toLowerCase()}`;

        // 从 config 表中获取归集钱包地址
        const address = await this.systemConfigService.get(configKey);
        if (!address) {
            return null;
        }

        return address;
    }

    /**
     * 从 Vault 获取私钥（支持解密）
     */
    private async getPrivateKey(addressId: number): Promise<string> {
        try {
            const vaultKey = `address_sys_${addressId}`;
            const data = await this.vaultUtil.getPrivateKey(vaultKey);
            return this.decryptPrivateKey(
                data.privateKey, // 这里存储的是加密后的数据
                data.keyHash,
                addressId
            );
        } catch (error) {
            this.logger.error(`Failed to get private key for address ${addressId}: ${error.message}`);
            throw new BadRequestException('Failed to retrieve private key');
        }
    }

    /**
     * 私有方法：将加密私钥存储到 Vault
     */
    private async storePrivateKeyToVault(
        addressId: number,
        addressInfo: AddressInfo,
    ): Promise<string> {
        try {
            const vaultKey = `address_sys_${addressId}`;
            const { encryptedData, keyHash } = this.encryptPrivateKey(addressInfo.privateKey, addressId);

            // 将加密后的私钥和验证信息作为普通数据存储到Vault
            await this.vaultUtil.storePrivateKey(vaultKey, {
                privateKey: encryptedData, // 存储加密后的数据
                address: addressInfo.address,
                publicKey: addressInfo.publicKey,
                keyHash,
            });

            this.logger.log(`Successfully stored encrypted private key for address ${addressId}`);
            return keyHash;
        } catch (error) {
            this.logger.error(`Failed to store private key to vault: ${error.message}`, error.stack);
            throw new BadRequestException('Failed to securely store private key');
        }
    }

    /**
     * 生成私钥加密密钥
     * 基于用户ID和地址ID生成唯一密钥
     */
    private generateKey(addressId: number): string {
        const systemKey = this.configService.get('app.encryptionKey');
        const keyMaterial = `address:${addressId}|system:${systemKey}`;

        // 使用PBKDF2派生密钥，增强安全性
        return crypto.pbkdf2Sync(keyMaterial, 'wallet-salt-2025', 100000, 32, 'sha256').toString('hex');
    }

    /**
     * 加密私钥
     */
    private encryptPrivateKey(privateKey: string, addressId: number): { encryptedData: string, keyHash: string } {
        const encryptionKey = this.generateKey(addressId);
        const key = crypto.createHash('sha256').update(encryptionKey).digest();
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(privateKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const encryptedData = iv.toString('hex') + encrypted;
        const keyHash = crypto.createHash('sha256').update(encryptionKey).digest('hex').slice(0, 16);

        return { encryptedData, keyHash };
    }

    /**
     * 解密私钥
     */
    private decryptPrivateKey(encryptedData: string, keyHash: string, addressId: number): string {
        const encryptionKey = this.generateKey(addressId);
        const expectedKeyHash = crypto.createHash('sha256').update(encryptionKey).digest('hex').slice(0, 16);

        if (expectedKeyHash !== keyHash) {
            throw new Error('Invalid key hash - decryption key mismatch');
        }

        const key = crypto.createHash('sha256').update(encryptionKey).digest();
        const iv = Buffer.from(encryptedData.slice(0, 32), 'hex');
        const encrypted = encryptedData.slice(32);

        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }
}