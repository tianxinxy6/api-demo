import { CommonEntity } from '@/common/entities/common.entity';
import {
  Entity,
  Column,
  Index,
} from 'typeorm';

/**
 * 系统配置表
 * 用于存储各种配置信息，包括区块链扫描状态等
 */
@Entity('config')
@Index('idx_key', ['key'], { unique: true })
export class ConfigEntity extends CommonEntity {
  /**
   * 配置键名
   * 例如: 'eth_last_scanned_block', 'tron_last_scanned_block'
   */
  @Column({
    name: 'key',
    type: 'varchar',
    length: 100,
    comment: '配置键名'
  })
  key: string;

  /**
   * 配置值
   */
  @Column({
    name: 'value',
    type: 'varchar',
    length: 1000,
    comment: '配置值'
  })
  value: string;

  /**
   * 配置描述
   */
  @Column({
    name: 'description',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '配置描述'
  })
  description?: string;
}