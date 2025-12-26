import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DatabaseService } from './database.service';
import { ConfigEntity } from '@/entities/config.entity';

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
      // dataSource receives the configured DataSourceOptions
      // and returns a Promise<DataSource>.
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('Database options are not defined');
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
