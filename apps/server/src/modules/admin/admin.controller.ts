import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { AdminGuard } from '../../common/guards/admin.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AdminService } from './admin.service.js';
import {
  AdminPaginationDto,
  BanDto,
  CreateNotificationDto,
  FeedbackDoneDto,
  HandleReportDto,
  SaveAnnouncementDto,
  SaveCategoryDto,
  SaveGuideCatDto,
  SaveGuideDto,
  SetAdminDto,
  SetEssenceDto,
  SetPinDto,
  SetStatusDto,
} from './dto/admin.dto.js';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // 帖子审核
  @Get('posts')
  listPosts(@Query() q?: AdminPaginationDto) {
    return this.admin.listPosts(q);
  }
  @Patch('posts/:id/status')
  setPostStatus(@CurrentUser('sub') adminId: string, @Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.admin.setPostStatus(adminId, id, dto);
  }
  @Patch('posts/:id/pin')
  setPostPin(@CurrentUser('sub') adminId: string, @Param('id') id: string, @Body() dto: SetPinDto) {
    return this.admin.setPostPin(adminId, id, dto);
  }
  @Patch('posts/:id/essence')
  setPostEssence(@CurrentUser('sub') adminId: string, @Param('id') id: string, @Body() dto: SetEssenceDto) {
    return this.admin.setPostEssence(adminId, id, dto);
  }

  // 商品审核
  @Get('products')
  listProducts(@Query() q?: AdminPaginationDto) {
    return this.admin.listProducts(q);
  }
  @Patch('products/:id/status')
  setProductStatus(@CurrentUser('sub') adminId: string, @Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.admin.setProductStatus(adminId, id, dto);
  }

  // 评论审核
  @Get('comments')
  listComments(@Query() q?: AdminPaginationDto) {
    return this.admin.listComments(q);
  }
  @Patch('comments/:id/status')
  setCommentStatus(@CurrentUser('sub') adminId: string, @Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.admin.setCommentStatus(adminId, id, dto);
  }

  // 举报
  @Get('reports')
  listReports(@Query() q?: AdminPaginationDto) {
    return this.admin.listReports(q);
  }
  @Patch('reports/:id')
  handleReport(@CurrentUser('sub') adminId: string, @Param('id') id: string, @Body() dto: HandleReportDto) {
    return this.admin.handleReport(adminId, id, dto);
  }

  // 用户
  @Get('users')
  listUsers(@Query() q?: AdminPaginationDto) {
    return this.admin.listUsers(q);
  }
  @Patch('users/:id/ban')
  setUserBan(@CurrentUser('sub') adminId: string, @Param('id') id: string, @Body() dto: BanDto) {
    return this.admin.setUserBan(adminId, id, dto);
  }
  @Patch('users/:id/admin')
  setUserAdmin(@CurrentUser('sub') adminId: string, @Param('id') id: string, @Body() dto: SetAdminDto) {
    return this.admin.setUserAdmin(adminId, id, dto);
  }

  // 分类
  @Get('categories')
  listCategories() {
    return this.admin.listCategories();
  }
  @Post('categories')
  createCategory(@CurrentUser('sub') adminId: string, @Body() dto: SaveCategoryDto) {
    return this.admin.saveCategory(adminId, dto);
  }
  @Patch('categories/:id')
  updateCategory(@CurrentUser('sub') adminId: string, @Param('id') id: string, @Body() dto: SaveCategoryDto) {
    return this.admin.saveCategory(adminId, { ...dto, id });
  }
  @Delete('categories/:id')
  deleteCategory(@CurrentUser('sub') adminId: string, @Param('id') id: string) {
    return this.admin.deleteCategory(adminId, id);
  }

  // 公告
  @Get('announcements')
  listAnnouncements() {
    return this.admin.listAnnouncements();
  }
  @Post('announcements')
  createAnnouncement(@CurrentUser('sub') adminId: string, @Body() dto: SaveAnnouncementDto) {
    return this.admin.saveAnnouncement(adminId, dto);
  }
  @Patch('announcements/:id')
  updateAnnouncement(@CurrentUser('sub') adminId: string, @Param('id') id: string, @Body() dto: SaveAnnouncementDto) {
    return this.admin.saveAnnouncement(adminId, { ...dto, id });
  }
  @Delete('announcements/:id')
  deleteAnnouncement(@CurrentUser('sub') adminId: string, @Param('id') id: string) {
    return this.admin.deleteAnnouncement(adminId, id);
  }

  // 指南分类
  @Get('guide-categories')
  listGuideCats() {
    return this.admin.listGuideCats();
  }
  @Post('guide-categories')
  createGuideCat(@CurrentUser('sub') adminId: string, @Body() dto: SaveGuideCatDto) {
    return this.admin.saveGuideCat(adminId, dto);
  }
  @Patch('guide-categories/:id')
  updateGuideCat(@CurrentUser('sub') adminId: string, @Param('id') id: string, @Body() dto: SaveGuideCatDto) {
    return this.admin.saveGuideCat(adminId, { ...dto, id });
  }
  @Delete('guide-categories/:id')
  deleteGuideCat(@CurrentUser('sub') adminId: string, @Param('id') id: string) {
    return this.admin.deleteGuideCat(adminId, id);
  }

  // 指南
  @Get('guides')
  listGuides(@Query() q?: AdminPaginationDto) {
    return this.admin.listGuides(q);
  }
  @Post('guides')
  createGuide(@CurrentUser('sub') adminId: string, @Body() dto: SaveGuideDto) {
    return this.admin.saveGuide(adminId, dto);
  }
  @Patch('guides/:id')
  updateGuide(@CurrentUser('sub') adminId: string, @Param('id') id: string, @Body() dto: SaveGuideDto) {
    return this.admin.saveGuide(adminId, { ...dto, id });
  }
  @Delete('guides/:id')
  deleteGuide(@CurrentUser('sub') adminId: string, @Param('id') id: string) {
    return this.admin.deleteGuide(adminId, id);
  }

  // 反馈
  @Get('feedbacks')
  listFeedbacks(@Query() q?: AdminPaginationDto) {
    return this.admin.listFeedbacks(q);
  }
  @Patch('feedbacks/:id')
  setFeedbackDone(@CurrentUser('sub') adminId: string, @Param('id') id: string, @Body() dto: FeedbackDoneDto) {
    return this.admin.setFeedbackDone(adminId, id, dto);
  }

  // 通知
  @Get('notifications')
  listNotifications(@Query() q?: AdminPaginationDto) {
    return this.admin.listNotifications(q);
  }
  @Post('notifications')
  createNotification(@CurrentUser('sub') adminId: string, @Body() dto: CreateNotificationDto) {
    return this.admin.createNotification(adminId, dto);
  }

  // 审计日志
  @Get('logs')
  listLogs(@Query() q?: AdminPaginationDto) {
    return this.admin.listLogs(q);
  }
}
