import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity({ name: 'user', comment: '用户表' })
@Index('idx_username', ['username'], { unique: true })
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '用户名' })
  username: string;

  @Column({ comment: '密码哈希值', select: false })
  @Exclude()
  password: string;

  @Column({ comment: '昵称', default: '' })
  nickname: string;

  @Column({ comment: '邮箱', default: '' })
  email: string;

  @Column({ comment: '头像', default: '' })
  avatar: string;

  @Column({ comment: '性别', default: 0, type: 'tinyint' })
  gender: number;

  @Column({ comment: '手机号', default: '' })
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

  @Column({ comment: '创建时间', name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ comment: '更新时间', name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
