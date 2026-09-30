import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { snakeList, toSnakeKeys } from '../../common/utils/snake.js';
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

/** 分页默认值 */
function pageOf(q?: AdminPaginationDto) {
  return { page: Math.max(1, q?.page ?? 1), pageSize: Math.min(100, Math.max(1, q?.pageSize ?? 20)) };
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- 审计 ----------
  /** 写操作留痕：action 语义 + 可选目标 + detail */
  private async log(adminId: string, action: string, targetType = '', targetId?: string, detail = '') {
    await this.prisma.adminLog
      .create({
        data: { adminId, action, targetType, targetId, detail },
      })
      .catch(() => undefined); // 审计失败不阻断主流程
  }

  // ---------- 帖子审核 ----------
  async listPosts(q?: AdminPaginationDto) {
    const { page, pageSize } = pageOf(q);
    const where: Prisma.PostWhereInput = q?.keyword
      ? { title: { contains: q.keyword, mode: 'insensitive' } }
      : {};
    const [total, rows] = await Promise.all([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { author: { select: { nickname: true, avatar: true } } },
      }),
    ]);
    return snakeList(rows, total);
  }

  async setPostStatus(adminId: string, id: string, dto: SetStatusDto) {
    const post = await this.ensurePost(id);
    const updated = await this.prisma.post.update({ where: { id }, data: { status: dto.status } });
    await this.log(adminId, 'set_post_status', 'post', id, `${post.title} → ${dto.status}`);
    return toSnakeKeys(updated);
  }

  async setPostPin(adminId: string, id: string, dto: SetPinDto) {
    await this.ensurePost(id);
    const updated = await this.prisma.post.update({ where: { id }, data: { isPinned: dto.isPinned } });
    await this.log(adminId, dto.isPinned ? 'pin_post' : 'unpin_post', 'post', id);
    return toSnakeKeys(updated);
  }

  async setPostEssence(adminId: string, id: string, dto: SetEssenceDto) {
    await this.ensurePost(id);
    const updated = await this.prisma.post.update({ where: { id }, data: { isEssence: dto.isEssence } });
    await this.log(adminId, dto.isEssence ? 'set_essence' : 'unset_essence', 'post', id);
    return toSnakeKeys(updated);
  }

  private async ensurePost(id: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('帖子不存在');
    return post;
  }

  // ---------- 商品审核 ----------
  async listProducts(q?: AdminPaginationDto) {
    const { page, pageSize } = pageOf(q);
    const where: Prisma.ProductWhereInput = q?.keyword
      ? { title: { contains: q.keyword, mode: 'insensitive' } }
      : {};
    const [total, rows] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { seller: { select: { nickname: true, avatar: true } } },
      }),
    ]);
    return snakeList(rows, total);
  }

  async setProductStatus(adminId: string, id: string, dto: SetStatusDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('商品不存在');
    const updated = await this.prisma.product.update({ where: { id }, data: { status: dto.status } });
    await this.log(adminId, 'set_product_status', 'product', id, `${product.title} → ${dto.status}`);
    return toSnakeKeys(updated);
  }

  // ---------- 评论审核 ----------
  async listComments(q?: AdminPaginationDto) {
    const { page, pageSize } = pageOf(q);
    const [total, rows] = await Promise.all([
      this.prisma.comment.count(),
      this.prisma.comment.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { nickname: true, avatar: true } } },
      }),
    ]);
    return snakeList(rows, total);
  }

  async setCommentStatus(adminId: string, id: string, dto: SetStatusDto) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('评论不存在');
    const updated = await this.prisma.comment.update({ where: { id }, data: { status: dto.status } });
    await this.log(adminId, 'set_comment_status', 'comment', id, `${comment.targetType}:${comment.targetId} → ${dto.status}`);
    return toSnakeKeys(updated);
  }

  // ---------- 举报处理 ----------
  async listReports(q?: AdminPaginationDto) {
    const { page, pageSize } = pageOf(q);
    const [total, rows] = await Promise.all([
      this.prisma.report.count(),
      this.prisma.report.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          reporter: { select: { nickname: true } },
          handler: { select: { nickname: true } },
        },
      }),
    ]);
    return snakeList(rows, total);
  }

  async handleReport(adminId: string, id: string, dto: HandleReportDto) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('举报不存在');
    const updated = await this.prisma.report.update({
      where: { id },
      data: { status: dto.status, handledBy: adminId, handledAt: new Date(), detail: dto.note ?? report.detail },
    });
    await this.log(adminId, 'handle_report', 'report', id, `${report.targetType}:${report.targetId} → ${dto.status}`);
    return toSnakeKeys(updated);
  }

  // ---------- 用户管理 ----------
  async listUsers(q?: AdminPaginationDto) {
    const { page, pageSize } = pageOf(q);
    const where: Prisma.ProfileWhereInput = q?.keyword
      ? { nickname: { contains: q.keyword, mode: 'insensitive' } }
      : {};
    const [total, rows] = await Promise.all([
      this.prisma.profile.count({ where }),
      this.prisma.profile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, nickname: true, avatar: true, college: true, major: true,
          grade: true, gender: true, bio: true, points: true, checkinStreak: true,
          isBanned: true, isAdmin: true, createdAt: true,
        },
      }),
    ]);
    return snakeList(rows, total);
  }

  async setUserBan(adminId: string, id: string, dto: BanDto) {
    const profile = await this.prisma.profile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('用户不存在');
    if (id === adminId) throw new BadRequestException('不能封禁自己');
    const updated = await this.prisma.profile.update({ where: { id }, data: { isBanned: dto.isBanned } });
    await this.log(adminId, dto.isBanned ? 'ban_user' : 'unban_user', 'user', id, profile.nickname);
    return toSnakeKeys(updated);
  }

  async setUserAdmin(adminId: string, id: string, dto: SetAdminDto) {
    const profile = await this.prisma.profile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('用户不存在');
    if (id === adminId && !dto.isAdmin) throw new BadRequestException('不能取消自己的管理员');
    const updated = await this.prisma.profile.update({ where: { id }, data: { isAdmin: dto.isAdmin } });
    await this.log(adminId, dto.isAdmin ? 'grant_admin' : 'revoke_admin', 'user', id, profile.nickname);
    return toSnakeKeys(updated);
  }

  // ---------- 分类管理 ----------
  async listCategories() {
    const rows = await this.prisma.category.findMany({ orderBy: { sort: 'asc' } });
    // v1 语义映射：status=active → enabled
    const mapped = rows.map((r) => ({ ...r, enabled: r.status === 'active' }));
    return snakeList(mapped, rows.length);
  }

  async saveCategory(adminId: string, dto: SaveCategoryDto) {
    const status = dto.enabled === false ? 'hidden' : 'active';
    if (dto.id) {
      const exists = await this.prisma.category.findUnique({ where: { id: dto.id } });
      if (!exists) throw new NotFoundException('分类不存在');
      const updated = await this.prisma.category.update({
        where: { id: dto.id },
        data: { name: dto.name, emoji: dto.icon ?? exists.emoji, sort: dto.sort ?? exists.sort, status },
      });
      await this.log(adminId, 'update_category', 'category', dto.id, dto.name);
      return toSnakeKeys(updated);
    }
    // 新建：id 自动生成（cat_ + 拼音/序号，先按时间戳）
    const id = `cat_${Date.now().toString(36)}`;
    const created = await this.prisma.category.create({
      data: { id, name: dto.name, emoji: dto.icon ?? '', sort: dto.sort ?? 0, status },
    });
    await this.log(adminId, 'create_category', 'category', id, dto.name);
    return toSnakeKeys(created);
  }

  async deleteCategory(adminId: string, id: string) {
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2003') {
        throw new BadRequestException('该分类下存在内容，请先停用或迁移内容');
      }
      throw e;
    }
    await this.log(adminId, 'delete_category', 'category', id);
    return { id };
  }

  // ---------- 公告管理 ----------
  async listAnnouncements() {
    const rows = await this.prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
    // v1 语义映射：status=active → is_active
    const mapped = rows.map((r) => ({ ...r, is_active: r.status === 'active' }));
    return snakeList(mapped, rows.length);
  }

  async saveAnnouncement(adminId: string, dto: SaveAnnouncementDto) {
    const status = dto.isActive === false ? 'inactive' : 'active';
    if (dto.id) {
      const exists = await this.prisma.announcement.findUnique({ where: { id: dto.id } });
      if (!exists) throw new NotFoundException('公告不存在');
      const updated = await this.prisma.announcement.update({
        where: { id: dto.id },
        data: { title: dto.title, content: dto.content ?? exists.content, status, isPinned: dto.isPinned ?? exists.isPinned },
      });
      await this.log(adminId, 'update_announcement', 'announcement', dto.id, dto.title);
      return toSnakeKeys(updated);
    }
    const created = await this.prisma.announcement.create({
      data: { title: dto.title, content: dto.content ?? '', status, isPinned: dto.isPinned ?? false, createdBy: adminId },
    });
    await this.log(adminId, 'create_announcement', 'announcement', created.id, dto.title);
    return toSnakeKeys(created);
  }

  async deleteAnnouncement(adminId: string, id: string) {
    const exists = await this.prisma.announcement.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('公告不存在');
    await this.prisma.announcement.delete({ where: { id } });
    await this.log(adminId, 'delete_announcement', 'announcement', id, exists.title);
    return { id };
  }

  // ---------- 指南分类 ----------
  async listGuideCats() {
    const rows = await this.prisma.guideCategory.findMany({ orderBy: { sort: 'asc' } });
    return snakeList(rows, rows.length);
  }

  async saveGuideCat(adminId: string, dto: SaveGuideCatDto) {
    if (dto.id) {
      const exists = await this.prisma.guideCategory.findUnique({ where: { id: dto.id } });
      if (!exists) throw new NotFoundException('指南分类不存在');
      const updated = await this.prisma.guideCategory.update({
        where: { id: dto.id },
        data: { name: dto.name, icon: dto.icon ?? exists.icon, sort: dto.sort ?? exists.sort },
      });
      await this.log(adminId, 'update_guide_category', 'guide_category', dto.id, dto.name);
      return toSnakeKeys(updated);
    }
    const id = `gid_${Date.now().toString(36)}`;
    const created = await this.prisma.guideCategory.create({
      data: { id, name: dto.name, icon: dto.icon ?? '', sort: dto.sort ?? 0 },
    });
    await this.log(adminId, 'create_guide_category', 'guide_category', id, dto.name);
    return toSnakeKeys(created);
  }

  async deleteGuideCat(adminId: string, id: string) {
    try {
      await this.prisma.guideCategory.delete({ where: { id } });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2003') {
        throw new BadRequestException('该分类下存在指南，请先删除或迁移指南');
      }
      throw e;
    }
    await this.log(adminId, 'delete_guide_category', 'guide_category', id);
    return { id };
  }

  // ---------- 指南管理 ----------
  async listGuides(q?: AdminPaginationDto) {
    const { page, pageSize } = pageOf(q);
    const where: Prisma.GuideWhereInput = {};
    if (q?.categoryId) where.categoryId = q.categoryId;
    if (q?.keyword) where.title = { contains: q.keyword, mode: 'insensitive' };
    const [total, rows] = await Promise.all([
      this.prisma.guide.count({ where }),
      this.prisma.guide.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return snakeList(rows, total);
  }

  async saveGuide(adminId: string, dto: SaveGuideDto) {
    if (dto.id) {
      const exists = await this.prisma.guide.findUnique({ where: { id: dto.id } });
      if (!exists) throw new NotFoundException('指南不存在');
      const updated = await this.prisma.guide.update({
        where: { id: dto.id },
        data: {
          categoryId: dto.categoryId ?? exists.categoryId,
          title: dto.title,
          summary: dto.summary ?? exists.summary,
          content: dto.content ?? exists.content,
          tags: dto.tags ?? exists.tags,
          coverImage: dto.coverImage ?? exists.coverImage,
          status: dto.status ?? exists.status,
          sort: dto.sort ?? exists.sort,
        },
      });
      await this.log(adminId, 'update_guide', 'guide', dto.id, dto.title);
      return toSnakeKeys(updated);
    }
    const created = await this.prisma.guide.create({
      data: {
        categoryId: dto.categoryId ?? null,
        title: dto.title,
        summary: dto.summary ?? '',
        content: dto.content ?? '',
        tags: dto.tags ?? [],
        coverImage: dto.coverImage ?? '',
        status: dto.status ?? 'published',
        sort: dto.sort ?? 0,
      },
    });
    await this.log(adminId, 'create_guide', 'guide', created.id, dto.title);
    return toSnakeKeys(created);
  }

  async deleteGuide(adminId: string, id: string) {
    const exists = await this.prisma.guide.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('指南不存在');
    await this.prisma.guide.delete({ where: { id } });
    await this.log(adminId, 'delete_guide', 'guide', id, exists.title);
    return { id };
  }

  // ---------- 反馈管理 ----------
  async listFeedbacks(q?: AdminPaginationDto) {
    const { page, pageSize } = pageOf(q);
    const [total, rows] = await Promise.all([
      this.prisma.feedback.count(),
      this.prisma.feedback.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { nickname: true } } },
      }),
    ]);
    return snakeList(rows, total);
  }

  async setFeedbackDone(adminId: string, id: string, dto: FeedbackDoneDto) {
    const feedback = await this.prisma.feedback.findUnique({ where: { id } });
    if (!feedback) throw new NotFoundException('反馈不存在');
    const updated = await this.prisma.feedback.update({
      where: { id },
      data: { status: dto.done ? 'done' : 'pending' },
    });
    await this.log(adminId, dto.done ? 'feedback_done' : 'feedback_reopen', 'feedback', id);
    return toSnakeKeys(updated);
  }

  // ---------- 通知 ----------
  async listNotifications(q?: AdminPaginationDto) {
    const { page, pageSize } = pageOf(q);
    const [total, rows] = await Promise.all([
      this.prisma.notification.count(),
      this.prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { nickname: true } }, actor: { select: { nickname: true } } },
      }),
    ]);
    return snakeList(rows, total);
  }

  async createNotification(adminId: string, dto: CreateNotificationDto) {
    if (dto.userId) {
      const target = await this.prisma.profile.findUnique({ where: { id: dto.userId } });
      if (!target) throw new NotFoundException('目标用户不存在');
      await this.prisma.notification.create({
        data: {
          userId: dto.userId, type: dto.type, content: dto.content,
          targetType: dto.targetType ?? '', targetId: dto.targetId ?? null, actorId: adminId,
        },
      });
    } else {
      // 全站下发：给所有活跃用户各建一条（量小直接同步，M4 换队列）
      const users = await this.prisma.profile.findMany({ where: { isBanned: false }, select: { id: true } });
      await this.prisma.notification.createMany({
        data: users.map((u) => ({
          userId: u.id, type: dto.type, content: dto.content,
          targetType: dto.targetType ?? '', targetId: dto.targetId ?? null, actorId: adminId,
        })),
      });
    }
    await this.log(adminId, 'create_notification', 'notification', dto.userId ?? undefined, dto.content);
    return { ok: true };
  }

  // ---------- 操作审计 ----------
  async listLogs(q?: AdminPaginationDto) {
    const { page, pageSize } = pageOf(q);
    const [total, rows] = await Promise.all([
      this.prisma.adminLog.count(),
      this.prisma.adminLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { admin: { select: { nickname: true } } },
      }),
    ]);
    return snakeList(rows, total);
  }
}
