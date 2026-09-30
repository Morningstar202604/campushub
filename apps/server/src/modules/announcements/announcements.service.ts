import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 首页公告：置顶优先 + 最新在前，最多 5 条 */
  list(limit = 5) {
    return this.prisma.announcement.findMany({
      where: { status: 'active' },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(20, Math.max(1, limit)),
      select: {
        id: true,
        title: true,
        content: true,
        isPinned: true,
        createdAt: true,
      },
    });
  }
}
