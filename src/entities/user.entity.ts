import { Column, Entity, Index } from 'typeorm';
import { Exclude } from 'class-transformer';
import { CommonDEntity } from '@/common/entities/common.entity';

@Entity({ name: 'user', comment: '用户表' })
@Index('idx_username', ['username'], { unique: true })
@Index('idx_email', ['email'], { unique: true, where: 'email IS NOT NULL' })
@Index('idx_phone', ['phone'], { unique: true, where: 'phone IS NOT NULL' })
export class UserEntity extends CommonDEntity {
  @Column({ comment: '用户名' })
  username: string;

  @Column({ comment: '密码哈希值' })
  @Exclude()
  password: string;

  @Column({ comment: '交易密码哈希值', name: 'trans_password', nullable: true })
  @Exclude()
  transPassword?: string;

  @Column({ comment: '昵称', default: '' })
  nickname: string;

  @Column({ comment: '邮箱', nullable: true })
  email: string;

  @Column({ comment: '头像', default: '' })
  avatar: string;

  @Column({ comment: '性别', default: 0, type: 'tinyint' })
  gender: number;

  @Column({ comment: '手机号', nullable: true })
  phone: string;

  @Column({ comment: '当前登录ip', name: 'login_ip', default: '' })
  loginIp: string;

  @Column({
    comment: '当前登录时间',
    name: 'login_time',
    type: 'timestamp',
    nullable: true,
  })
  loginTime: Date;

  @Column({ comment: '当前token', name: 'last_token', default: '', length: 32 })
  lastToken: string;

  @Column({ comment: '用户状态（0:禁用 1:正常）', default: 1, type: 'tinyint' })
  status: number;
}
