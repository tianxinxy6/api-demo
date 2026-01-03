import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { API_SECURITY_AUTH } from './common/decorators/swagger.decorator';
import { CommonEntity } from './common/entities/common.entity';
import { ResOp, TreeResult } from './common/vo/response.model';

export function setupSwagger(app: INestApplication, configService: ConfigService) {
  const appConfig = configService.get('app')!;
  const { name, swagger } = appConfig;
  const { enable } = swagger;

  // 默认的 Swagger 配置
  const path = configService.get('SWAGGER_PATH', 'docs');
  const serverUrl = configService.get('API_DOMAIN', 'http://localhost:3000');

  if (!enable) return;

  const swaggerPath = `${serverUrl}/${path}`;
  const baseUrl = `${serverUrl}/${appConfig.api.prefix}`;

  const documentBuilder = new DocumentBuilder()
    .setTitle(name)
    .setDescription(
      `
🔷 **Base URL**: \`${baseUrl}\` <br>
📦 **API 版本控制**: 本 API 支持多版本控制 <br>
  - V1: \`${baseUrl}/v1/...\` <br>
  - V2: \`${baseUrl}/v2/...\` <br>
🧾 **Swagger JSON**: [查看文档 JSON](${swaggerPath}/json) <br>
ℹ️ **版本说明**:
  - V1 为稳定版本，包含所有基础功能
  - V2 为增强版本，提供新功能和改进
  - 未指定版本时，默认使用 V1`,
    )
    .setVersion('1.0')
    .addServer(`${baseUrl}/v1`, 'API V1 (默认版本)')
    .addServer(`${baseUrl}/v2`, 'API V2 (增强版本)')
    .addServer(baseUrl, 'Base URL (使用默认版本)');

  // auth security
  documentBuilder.addSecurity(API_SECURITY_AUTH, {
    description: '输入令牌（Enter the token）',
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });

  const document = SwaggerModule.createDocument(app, documentBuilder.build(), {
    ignoreGlobalPrefix: true,
    extraModels: [CommonEntity, ResOp, TreeResult],
  });

  SwaggerModule.setup(path, app, document, {
    swaggerOptions: {
      persistAuthorization: true, // 保持登录
    },
    jsonDocumentUrl: `/${path}/json`,
  });

  return () => {
    // started log
    const logger = new Logger('SwaggerModule');
    logger.log(`Swagger UI: ${swaggerPath}`);
    logger.log(`Swagger JSON: ${swaggerPath}/json`);
  };
}
