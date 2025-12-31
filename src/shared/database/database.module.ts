import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DatabaseService } from './database.service';
import { ConfigEntity } from '@/entities/config.entity';
import { BusinessException } from '@/common/exceptions/biz.exception';
import { ErrorCode } from '@/constants';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          ...configService.get('database'),
          autoLoadEntities: true,
        };
      },
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new BusinessException(ErrorCode.ErrSharedDatabaseNotConfigured);
        }
        const dataSource = await new DataSource(options).initialize();
        return dataSource;
      },
    }),
    // 注入 ConfigEntity 供其他模块使用
    TypeOrmModule.forFeature([ConfigEntity]),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService, TypeOrmModule],
})
export class DatabaseModule {}
