import { Transform, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

enum DatabaseType {
  Postgres = 'postgres',
  MySQL = 'mysql',
  SQLite = 'sqlite',
  MongoDB = 'mongodb',
}

enum LogLevel {
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
  Verbose = 'verbose',
}

enum LogFormat {
  Json = 'json',
  Simple = 'simple',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Min(1)
  @Max(65535)
  @Transform(({ value }) => parseInt(value, 10))
  PORT: number = 3000;

  @IsString()
  APP_NAME: string = 'store-chat';

  @IsString()
  APP_VERSION: string = '1.0.0';

  // 数据库配置
  @IsOptional()
  @IsString()
  DATABASE_URL?: string;

  @IsEnum(DatabaseType)
  DATABASE_TYPE: DatabaseType = DatabaseType.Postgres;

  @IsString()
  DATABASE_HOST: string = 'localhost';

  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  DATABASE_PORT: number = 5432;

  @IsOptional()
  @IsString()
  DATABASE_USERNAME?: string;

  @IsOptional()
  @IsString()
  DATABASE_PASSWORD?: string;

  @IsOptional()
  @IsString()
  DATABASE_NAME?: string;

  // Redis配置
  @IsString()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  REDIS_PORT: number = 6379;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  // JWT配置
  @IsOptional()
  @IsString()
  JWT_SECRET?: string;

  @IsString()
  JWT_EXPIRES_IN: string = '7d';

  // 日志配置
  @IsEnum(LogLevel)
  LOG_LEVEL: LogLevel = LogLevel.Info;

  @IsEnum(LogFormat)
  LOG_FORMAT: LogFormat = LogFormat.Json;

  // API配置
  @IsString()
  API_PREFIX: string = 'api';

  @IsString()
  API_VERSION: string = 'v1';

  // 限流配置
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  THROTTLE_TTL: number = 60;

  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  THROTTLE_LIMIT: number = 10;

  // CORS配置
  @IsString()
  CORS_ORIGIN: string = 'http://localhost:3000';

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  CORS_CREDENTIALS: boolean = true;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
