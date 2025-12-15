import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.checkConnection();
  }

  /**
   * 检查数据库连接状态
   */
  async checkConnection(): Promise<boolean> {
    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize();
    }

    await this.dataSource.query('SELECT 1');
    this.logger.log('Database connection established successfully');
    return true;
  }

  /**
   * 获取数据源
   */
  getDataSource(): DataSource {
    return this.dataSource;
  }

  /**
   * 创建查询运行器
   */
  createQueryRunner(): QueryRunner {
    return this.dataSource.createQueryRunner();
  }

  /**
   * 执行事务
   */
  async runTransaction<T>(
    operation: (queryRunner: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await operation(queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Transaction failed, rolling back', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 执行原生 SQL 查询
   */
  async query(sql: string, parameters?: any[]): Promise<any> {
    return await this.dataSource.query(sql, parameters);
  }

  /**
   * 获取数据库连接信息
   */
  getConnectionInfo() {
    const options = this.dataSource.options;
    return {
      type: options.type,
      host: 'host' in options ? options.host : undefined,
      port: 'port' in options ? options.port : undefined,
      database: 'database' in options ? options.database : undefined,
      isConnected: this.dataSource.isInitialized,
    };
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'ok' | 'error';
    info: any;
    error?: any;
  }> {
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        info: this.getConnectionInfo(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        status: 'error',
        info: this.getConnectionInfo(),
        error: errorMessage,
      };
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getStats(): Promise<any> {
    try {
      const [connectionCount, databaseSize, tableCount] = await Promise.all([
        this.query('SHOW STATUS LIKE "Threads_connected"'),
        this.query(
          'SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 1) AS "DB Size in MB" FROM information_schema.tables WHERE table_schema = DATABASE()',
        ),
        this.query(
          'SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = DATABASE()',
        ),
      ]);

      return {
        connections: connectionCount[0]?.Value ?? 0,
        databaseSize: databaseSize[0]?.['DB Size in MB'] ?? 0,
        tableCount: tableCount[0]?.table_count ?? 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Failed to get database stats', errorStack);
      throw error;
    }
  }
}
