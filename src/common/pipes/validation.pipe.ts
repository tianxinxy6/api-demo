import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // 如果值为undefined或null，创建一个空对象以避免验证错误
    value ??= {};

    const object = plainToInstance(metatype, value);
    const errors = await validate(object, {
      whitelist: true, // 自动移除不在DTO中定义的属性
      forbidNonWhitelisted: true, // 如果存在非白名单属性则抛出错误
      transform: true, // 自动转换类型
      validateCustomDecorators: true, // 验证自定义装饰器
      skipMissingProperties: false, // 不跳过缺失的属性，让验证器处理可选属性
    });

    if (errors.length > 0) {
      const errorMessages = this.formatErrors(errors);
      throw new BadRequestException({
        message: 'Validation failed',
        errors: errorMessages,
      });
    }

    return object;
  }

  private toValidate(metatype: new (...args: any[]) => any): boolean {
    const types: (new (...args: any[]) => any)[] = [
      String,
      Boolean,
      Number,
      Array,
      Object,
    ];
    return !types.includes(metatype);
  }

  private formatErrors(errors: any[]): any[] {
    return errors.map((error) => {
      const constraints = error.constraints;
      const children = error.children;

      if (constraints) {
        return {
          property: error.property,
          value: error.value,
          constraints: Object.values(constraints),
        };
      }

      if (children && children.length > 0) {
        return {
          property: error.property,
          children: this.formatErrors(children),
        };
      }

      return {
        property: error.property,
        value: error.value,
      };
    });
  }
}
