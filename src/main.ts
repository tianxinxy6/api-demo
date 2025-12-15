import cluster from 'node:cluster'

import path from 'node:path'
import {
  Logger,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'

import { NestFastifyApplication } from '@nestjs/platform-fastify'

import { useContainer } from 'class-validator'

import { AppModule } from './app.module'
import { fastifyApp } from './common/adapters/fastify.adapter'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
import { isDev, isMainProcess } from './global/env'
import { setupSwagger } from './setup-swagger'
import compression from 'compression';

declare const module: any

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyApp,
    {
      bufferLogs: true,
      snapshot: true,
      // forceCloseConnections: true,
    },
  )

  const configService = app.get(ConfigService)

  const { port, globalPrefix } = configService.get('app', { infer: true })

  // class-validator 的 DTO 类中注入 nest 容器的依赖 (用于自定义验证器)
  useContainer(app.select(AppModule), { fallbackOnErrors: true })

  // 允许跨域
  const corsOrigin = configService.get('CORS_ORIGIN', 'http://localhost:3000');
  app.enableCors({
    origin: isDev ? '*' : corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // 明确允许方法
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'], // 按需配置允许的请求头
  })

  // 压缩中间件 压缩可以大大减小响应主体的大小，从而提高 Web 应用程序的速度。
  app.use(compression())

  app.setGlobalPrefix(globalPrefix)
  app.useStaticAssets({ root: path.join(__dirname, '..', 'public') })
  // Starts listening for shutdown hooks
  !isDev && app.enableShutdownHooks()

  if (isDev) {
    app.useGlobalInterceptors(new LoggingInterceptor())
  }

  const printSwaggerLog = setupSwagger(app, configService)

  await app.listen(port, '0.0.0.0', async () => {
    const url = await app.getUrl()
    const { pid } = process
    const env = cluster.isPrimary
    const prefix = env ? 'P' : 'W'

    if (!isMainProcess)
      return

    printSwaggerLog?.()

    const logger = new Logger('NestApplication')
    logger.log(`[${prefix + pid}] Server running on ${url}`)
  })

  if (module.hot) {
    module.hot.accept()
    module.hot.dispose(() => app.close())
  }
}

bootstrap()
