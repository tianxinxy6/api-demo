import { Column, Entity, Index } from 'typeorm';
import { CommonCEntity } from '@/common/entities/common.entity';

@Entity({ name: 'user_login_log', comment: '用户登录日志表' })
@Index('idx_user_id', ['userId'])
export class UserLoginLogEntity extends CommonCEntity {
  @Column({ comment: '用户ID', name: 'user_id' })
  userId: number;

  @Column({ comment: '登录IP地址', name: 'login_ip' })
  loginIp: string;

  @Column({ comment: '用户代理', name: 'user_agent', length: 500 })
  userAgent: string;

  @Column({ comment: '登录设备类型', name: 'device_type', default: '' })
  deviceType: string;

  @Column({ comment: '登录平台', default: '' })
  platform: string;

  @Column({ comment: '浏览器', default: '' })
  browser: string;

  @Column({ comment: '操作系统', default: '' })
  os: string;

  @Column({ comment: '登录状态（0:失败 1:成功）', default: 1, type: 'tinyint' })
  status: number;

  @Column({ comment: '失败原因', name: 'failure_reason', default: '', length: 200 })
  failureReason: string;

  @Column({ comment: '登录位置', default: '' })
  location: string;
}