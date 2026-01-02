import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { API_SECURITY_AUTH } from './common/decorators/swagger.decorator';
import { CommonEntity } from './common/entities/common.entity';
import { ResOp, TreeResult } from './common/model/response.model';

export function setupSwagger(app: INestApplication, configService: ConfigService) {
  const appConfig = configService.get('app')!;
  const { name, swagger } = appConfig;
  const { enable } = swagger;

  // 默认的 Swagger 配置
  const path = configService.get('SWAGGER_PATH', 'docs');
  const serverUrl = configService.get('API_DOMAIN', 'http://localhost:3000');

  if (!enable) return;

  const swaggerPath = `${serverUrl}/${path}`;

  const documentBuilder = new DocumentBuilder()
    .setTitle(name)
    .setDescription(
      `
🔷 **Base URL**: \`${serverUrl}/${appConfig.api.prefix}\` <br>
🧾 **Swagger JSON**: [查看文档 JSON](${swaggerPath}/json)`,
    )
    .setVersion('1.0')
    .addServer(`${serverUrl}/${appConfig.api.prefix}`, 'Base URL');

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
