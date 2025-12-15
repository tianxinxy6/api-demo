import { StringField } from '@/common/decorators/field.decorator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 用户注册 DTO
 */
export class UserRegisterDto {
  @StringField({ minLength: 3, maxLength: 50 })
  @ApiProperty({ example: 'john_doe', description: '用户名' })
  username: string;

  @StringField({ minLength: 8, maxLength: 100 })
  @ApiProperty({ example: 'password123', description: '密码' })
  password: string;

  @StringField({ required: false, maxLength: 50 })
  @ApiProperty({ example: 'John Doe', description: '昵称', required: false })
  nickname?: string;
}

/**
 * 用户登录 DTO
 */
export class UserLoginDto {
  @StringField({ minLength: 3, maxLength: 50 })
  @ApiProperty({ example: 'john_doe', description: '用户名' })
  username: string;

  @StringField({ minLength: 8, maxLength: 100 })
  @ApiProperty({ example: 'password123', description: '密码' })
  password: string;
}

/**
 * @deprecated 已弃用，使用 UserRegisterDto 代替
 */
export class CreateUserDto extends UserRegisterDto {}
