import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isUuid } from '../../common/utils/uuid.js';
import { CreatePostDto, FeedQuery, ReportPostDto } from './dto/posts.dto.js';

const AUTHOR_SELECT = { id: true, nickname: true, avatar: true };

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 我的帖子（不含已删除，最新在前）——对应原前端 myPosts */
  async my(userId: string) {
    return this.prisma.post.findMany({
      where: { authorId: userId, status: { not: 'deleted' } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, kind: true, title: true, content: true, images: true,
        tags: true, categoryId: true, isAnonymous: true, resolved: true,
        isPinned: true, isEssence: true, likeCount: true, commentCount: true,
        collectCount: true, viewCount: true, expireAt: true, createdAt: true,
      },
    });
  }

  /** 信息流：status=normal，排除过期未解决任务帖 */
  async feed(q: FeedQuery) {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(30, Math.max(1, q.pageSize ?? 20));
    const now = new Date();

    const where: Prisma.PostWhereInput = {
      status: 'normal',
      OR: [
        { kind: { not: 'task' } },
        { resolved: true },
        { expireAt: { gt: now } },
      ],
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
    };

    let orderBy: Prisma.PostOrderByWithRelationInput[];
    if (q.tab === 'hot') {
      orderBy = [{ likeCount: 'desc' }, { createdAt: 'desc' }];
      where.createdAt = { gte: new Date(Date.now() - 7 * 86_400_000) };
    } else if (q.tab === 'latest') {
      orderBy = [{ createdAt: 'desc' }];
    } else {
      orderBy = [{ isPinned: 'desc' }, { createdAt: 'desc' }];
    }

    const [list, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, kind: true, title: true, content: true, images: true,
          tags: true, categoryId: true, isAnonymous: true, resolved: true,
          isPinned: true, isEssence: true, likeCount: true, commentCount: true,
          collectCount: true, viewCount: true, expireAt: true, createdAt: true,
          author: { select: AUTHOR_SELECT },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return { list, total, hasMore: (page - 1) * pageSize + list.length < total };
  }

  /** 详情：view_count +1（不按人去重，脚本刷量由网关限频兜底） */
  async detail(id: string) {
    if (!isUuid(id)) throw new NotFoundException('帖子不存在或已删除');
    const post = await this.prisma.post.findFirst({
      where: { id, status: { not: 'deleted' } },
      select: {
        id: true, authorId: true, categoryId: true, kind: true, title: true,
        content: true, images: true, tags: true, location: true,
        isAnonymous: true, expireAt: true, resolved: true, status: true,
        isPinned: true, isEssence: true, likeCount: true, commentCount: true,
        collectCount: true, viewCount: true, createdAt: true,
        author: { select: AUTHOR_SELECT },
      },
    });
    if (!post) throw new NotFoundException('帖子不存在或已删除');

    // 视图计数：作者本人浏览也计入（与原实现一致），异常不阻断读
    await this.prisma.post
      .update({ where: { id }, data: { viewCount: { increment: 1 } } })
      .catch(() => undefined);

    return post;
  }

  /** 发帖：校验分类存在 + kind 合法 */
  async create(userId: string, dto: CreatePostDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category || category.status !== 'active') {
      throw new BadRequestException('分类不存在或已停用');
    }
    const post = await this.prisma.post.create({
      data: {
        authorId: userId,
        categoryId: dto.categoryId,
        kind: dto.kind,
        title: dto.title,
        content: dto.content ?? '',
        images: dto.images ?? [],
        tags: dto.tags ?? [],
        location: dto.location ?? '',
        isAnonymous: dto.isAnonymous ?? false,
        expireAt: dto.expireAt ? new Date(dto.expireAt) : null,
      },
      select: { id: true, createdAt: true },
    });
    return post;
  }

  /** 标记已解决：作者/管理员 */
  async resolve(userId: string, id: string, resolved: boolean) {
    const post = await this.requireOwnerOrAdmin(userId, id);
    return this.prisma.post.update({
      where: { id },
      data: { resolved },
      select: { id: true, resolved: true },
    });
  }

  /** 软删除：作者/管理员 */
  async softDelete(userId: string, id: string) {
    await this.requireOwnerOrAdmin(userId, id);
    await this.prisma.post.update({
      where: { id },
      data: { status: 'deleted' },
    });
    return { ok: true };
  }

  /** 举报 */
  async report(userId: string, id: string, dto: ReportPostDto) {
    if (!isUuid(id)) throw new NotFoundException('帖子不存在或已删除');
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!post || post.status === 'deleted') {
      throw new NotFoundException('帖子不存在或已删除');
    }
    await this.prisma.report.create({
      data: {
        reporterId: userId,
        targetType: 'post',
        targetId: id,
        reason: dto.reason,
        detail: dto.detail ?? '',
      },
    });
    return { ok: true };
  }

  /** 作者或管理员判定（管理员 = profiles.is_admin） */
  private async requireOwnerOrAdmin(userId: string, id: string) {
    if (!isUuid(id)) throw new NotFoundException('帖子不存在或已删除');
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!post) throw new NotFoundException('帖子不存在或已删除');
    if (post.authorId === userId) return post;
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    if (!profile?.isAdmin) throw new ForbiddenException('无权限操作他人内容');
    return post;
  }
}
