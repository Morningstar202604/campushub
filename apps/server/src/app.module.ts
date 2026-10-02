import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { PostsModule } from './modules/posts/posts.module.js';
import { CommentsModule } from './modules/comments/comments.module.js';
import { InteractionsModule } from './modules/interactions/interactions.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { CheckinsModule } from './modules/checkins/checkins.module.js';
import { AnnouncementsModule } from './modules/announcements/announcements.module.js';
import { GuidesModule } from './modules/guides/guides.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { FeedbacksModule } from './modules/feedbacks/feedbacks.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { UploadModule } from './modules/upload/upload.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { AppController } from './app.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    // 结构化日志（pino）：应用日志 + HTTP 访问日志统一 JSON 输出，生产可采集（LOG_LEVEL 控制级别）
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        autoLogging: {
          ignore: (req) => {
            const url = req.url ?? '';
            return url === '/api/health' || url.startsWith('/static/');
          },
        },
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
      },
    }),
    PrismaModule,
    AuthModule,
    CategoriesModule,
    PostsModule,
    CommentsModule,
    InteractionsModule,
    ProductsModule,
    CheckinsModule,
    AnnouncementsModule,
    GuidesModule,
    NotificationsModule,
    FeedbacksModule,
    SearchModule,
    UploadModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule {}
