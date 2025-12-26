import { ApiProperty } from '@nestjs/swagger';
import { formatToDateTime } from '@/utils/date.util';

/**
 * 基础用户信息响应模型 - 用于公开展示
 * 包含最基本的用户信息，不涉及敏感数据
 */
export class UserBasicResponse {
  @ApiProperty({ description: '用户ID' })
  id: number;

  @ApiProperty({ description: '用户名' })
  username: string;

  @ApiProperty({ description: '昵称' })
  nickname: string;

  @ApiProperty({ description: '头像' })
  avatar: string;

  @ApiProperty({ description: '用户状态: 0-禁用 1-正常' })
  status: number;

  constructor(partial: Partial<UserBasicResponse>) {
    Object.assign(this, partial);
  }
}

/**
 * 用户个人信息响应模型 - 用于个人中心
 * 包含用户个人可见的完整信息
 */
export class UserProfileResponse extends UserBasicResponse {
  @ApiProperty({ description: '邮箱', nullable: true })
  email?: string;

  @ApiProperty({ description: '手机号', nullable: true, example: '138****8888' })
  phone?: string;

  @ApiProperty({ description: '性别: 0-未知 1-男 2-女' })
  gender: number;

  @ApiProperty({ description: '创建时间', example: '2025-12-20 15:00:00' })
  createdAt: string;

  @ApiProperty({ description: '最后登录时间', nullable: true, example: '2025-12-20 15:00:00' })
  loginTime?: string;

  constructor(partial: Partial<Omit<UserProfileResponse, 'createdAt' | 'loginTime'>> & { createdAt?: Date; loginTime?: Date }) {
    super(partial);
    this.createdAt = partial.createdAt ? formatToDateTime(partial.createdAt) : '';
    this.loginTime = partial.loginTime ? formatToDateTime(partial.loginTime) : undefined;
  }
}

/**
 * 工具函数：格式化手机号（脱敏处理）
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

/**
 * 工具函数：格式化邮箱（脱敏处理）
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [username, domain] = email.split('@');
  if (username.length <= 2) return email;
  const maskedUsername = username.slice(0, 2) + '*'.repeat(username.length - 2);
  return `${maskedUsername}@${domain}`;
}