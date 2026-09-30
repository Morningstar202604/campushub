import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isUuid } from '../../common/utils/uuid.js';

@Injectable()
export class GuidesService {
  constructor(private readonly prisma: PrismaService) {}

  /** 指南分类（全部，按 sort） */
  categories() {
    return this.prisma.guideCategory.findMany({
      orderBy: { sort: 'asc' },
    });
  }

  /** 已发布指南列表：可选按分类过滤，sort + 最新 */
  list(categoryId?: string) {
    return this.prisma.guide.findMany({
      where: {
        status: 'published',
        ...(categoryId ? { categoryId } : {}),
      },
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        categoryId: true,
        title: true,
        summary: true,
        coverImage: true,
        tags: true,
        viewCount: true,
        createdAt: true,
      },
    });
  }

  /** 指南详情：浏览量 +1（失败不阻断） */
  async detail(id: string) {
    if (!isUuid(id)) throw new NotFoundException('指南不存在');
    const guide = await this.prisma.guide.findFirst({
      where: { id, status: 'published' },
    });
    if (!guide) throw new NotFoundException('指南不存在');
    this.prisma.guide
      .update({ where: { id }, data: { viewCount: { increment: 1 } } })
      .catch(() => undefined);
    return guide;
  }
}
