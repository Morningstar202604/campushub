import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'node:path';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // 全局前缀：/api
  app.setGlobalPrefix('api');
  app.enableCors();
  // 上传目录静态服务：/static/xxx.jpg（UPLOAD_DIR 相对项目根）
  const uploadDir = process.env.UPLOAD_DIR ?? 'uploads';
  app.useStaticAssets(join(process.cwd(), uploadDir), { prefix: '/static/' });
  // 全局参数校验：只留白名单字段，自动转型
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // OpenAPI 文档（/api-json 供前端 openapi-typescript 生成类型）
  const doc = new DocumentBuilder()
    .setTitle('CampusHub API')
    .setDescription('校园内容社区后端服务（NestJS + Prisma）')
    .setVersion('2.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, doc);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
