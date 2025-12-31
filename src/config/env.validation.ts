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

enum LogLevel {
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
  Verbose = 'verbose',
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
  APP_NAME: string = 'chain-wallet';

  @IsString()
  APP_VERSION: string = '1.0.0';

  // Database
  @IsString()
  DATABASE_HOST: string = 'localhost';

  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  DATABASE_PORT: number = 3306;

  @IsString()
  DATABASE_USERNAME: string = 'root';

  @IsOptional()
  @IsString()
  DATABASE_PASSWORD?: string = '';

  @IsString()
  DATABASE_NAME: string = 'chain_wallet';

  // Redis
  @IsString()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  REDIS_PORT: number = 6379;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  // JWT
  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_EXPIRES_IN: string = '1h';

  @IsString()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  // Logging
  @IsEnum(LogLevel)
  LOG_LEVEL: LogLevel = LogLevel.Info;

  // API
  @IsString()
  API_PREFIX: string = 'api';

  @IsString()
  API_VERSION: string = 'v1';

  // Rate Limiting
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  THROTTLE_TTL: number = 60;

  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  THROTTLE_LIMIT: number = 10;

  // CORS
  @IsString()
  CORS_ORIGIN: string = '*';

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  CORS_CREDENTIALS: boolean = true;

  // Encryption
  @IsOptional()
  @IsString()
  ENCRYPTION_KEY?: string;

  // Vault (optional)
  @IsOptional()
  @IsString()
  VAULT_ADDR?: string;

  @IsOptional()
  @IsString()
  VAULT_TOKEN?: string;

  @IsOptional()
  @IsString()
  VAULT_SECRET_PATH?: string;
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
