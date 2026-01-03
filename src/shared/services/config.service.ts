import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigEntity } from '@/entities/config.entity';

/**
 * 配置服务
 * 职责：
 * 1. 管理系统配置（存储在数据库）
 * 2. 支持多种类型配置（字符串、数字、布尔）
 * 3. 管理区块链扫描进度
 */
@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  constructor(
    @InjectRepository(ConfigEntity)
    private readonly configRepository: Repository<ConfigEntity>,
  ) {}

  /**
   * 获取配置值
   * @param key 配置键名
   * @param defaultValue 默认值
   * @returns 配置值或默认值
   */
  async get(key: string, defaultValue?: string): Promise<string | undefined> {
    try {
      const config = await this.configRepository.findOne({
        where: {
          key,
        },
      });

      return config?.value ?? defaultValue;
    } catch (error) {
      this.logger.error(`Failed to get config ${key}:`, error.message);
      return defaultValue;
    }
  }

  /**
   * 设置配置值
   * @param key 配置键名
   * @param value 配置值
   * @param description 配置描述
   * @param groupName 配置分组
   */
  async set(key: string, value: string): Promise<void> {
    try {
      const existing = await this.configRepository.findOne({
        where: { key },
      });

      if (existing) {
        // 更新现有配置
        await this.configRepository.update(
          { key },
          {
            value,
            updatedAt: new Date(),
          },
        );
      } else {
        // 创建新配置
        const config = this.configRepository.create({
          key,
          value,
        });
        await this.configRepository.save(config);
      }
    } catch (error) {
      this.logger.error(`Failed to set config ${key}:`, error.message);
      throw error;
    }
  }

  /**
   * 获取数字类型的配置值
   * @param key 配置键名
   * @param defaultValue 默认值
   * @returns 数字配置值或默认值
   */
  async getNumber(key: string, defaultValue?: number): Promise<number> {
    const value = await this.get(key, defaultValue?.toString());
    if (value === undefined) {
      return defaultValue || 0;
    }

    const numValue = parseInt(value, 10);
    return isNaN(numValue) ? defaultValue || 0 : numValue;
  }

  /**
   * 设置数字类型的配置值
   * @param key 配置键名
   * @param value 数字值
   * @param description 配置描述
   * @param groupName 配置分组
   */
  async setNumber(key: string, value: number): Promise<void> {
    await this.set(key, value.toString());
  }

  /**
   * 获取区块链最后扫描的区块号
   * @param chainCode 链代码 (如 ETH, TRON)
   * @returns 最后扫描的区块号
   */
  async getLastScannedBlock(chainCode: string): Promise<number> {
    const key = `${chainCode.toLowerCase()}_last_scanned_block`;
    return await this.getNumber(key, 0);
  }

  /**
   * 设置区块链最后扫描的区块号
   * @param chainCode 链代码 (如 ETH, TRON)
   * @param blockNumber 区块号
   */
  async setLastScannedBlock(chainCode: string, blockNumber: number): Promise<void> {
    const key = `${chainCode.toLowerCase()}_last_scanned_block`;
    await this.setNumber(key, blockNumber);
  }

  /**
   * 获取布尔类型的配置值
   * @param key 配置键名
   * @param defaultValue 默认值
   * @returns 布尔配置值或默认值
   */
  async getBoolean(key: string, defaultValue?: boolean): Promise<boolean> {
    const value = await this.get(key, defaultValue?.toString());
    if (value === undefined) {
      return defaultValue || false;
    }

    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * 设置布尔类型的配置值
   * @param key 配置键名
   * @param value 布尔值
   * @param description 配置描述
   * @param groupName 配置分组
   */
  async setBoolean(key: string, value: boolean): Promise<void> {
    await this.set(key, value.toString());
  }

  /**
   * 删除配置
   * @param key 配置键名
   */
  async delete(key: string): Promise<void> {
    try {
      await this.configRepository.delete({ key });
    } catch (error) {
      this.logger.error(`Failed to delete config ${key}:`, error.message);
      throw error;
    }
  }
}
