import { PartialType } from '@nestjs/swagger';
import { UserRegisterDto } from './create-user.dto';

/**
 * @deprecated 此脚手架不支持用户 CRUD，仅支持认证功能
 */
export class UpdateUserDto extends PartialType(UserRegisterDto) {
  // 通过 PartialType 使所有字段可选
}
