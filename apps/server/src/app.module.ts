import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
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
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { AppController } from './app.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
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
  ],
  controllers: [AppController],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule {}
