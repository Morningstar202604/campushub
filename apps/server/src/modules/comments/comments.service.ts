import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isUuid } from '../../common/utils/uuid.js';
import { CreateCommentDto } from './dto/comments.dto.js';

const USER_SELECT = { id: true, nickname: true, avatar: true };

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 楼层列表（status=normal 升序） */
  async list(targetType: 'post' | 'product', targetId: string) {
    if (!isUuid(targetId)) return [];
    return this.prisma.comment.findMany({
      where: { targetType, targetId, status: 'normal' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, targetType: true, targetId: true, userId: true,
        parentId: true, replyToUserId: true, content: true,
        likeCount: true, createdAt: true,
        user: { select: USER_SELECT },
      },
    });
  }

  /** 发评论/回复：校验目标存在 + 父评论归属 */
  async create(
    userId: string,
    targetType: 'post' | 'product',
    targetId: string,
    dto: CreateCommentDto,
  ) {
    if (!isUuid(targetId)) throw new NotFoundException('内容不存在或已删除');
    await this.ensureTargetExists(targetType, targetId);
    if (dto.parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: { id: dto.parentId, targetType, targetId, status: 'normal' },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('被回复的评论不存在');
    }
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          targetType,
          targetId,
          userId,
          content: dto.content,
          parentId: dto.parentId ?? null,
          replyToUserId: dto.replyToUserId ?? null,
        },
        select: {
          id: true, content: true, parentId: true, createdAt: true,
          user: { select: USER_SELECT },
        },
      });
      // 同步冗余计数（与原 Supabase trigger 行为一致）
      if (targetType === 'post') {
        await tx.post.update({
          where: { id: targetId },
          data: { commentCount: { increment: 1 } },
        });
      } else {
        await tx.product.update({
          where: { id: targetId },
          data: { commentCount: { increment: 1 } },
        });
      }
      return comment;
    });
  }

  /** 软删：作者/管理员 */
  async softDelete(userId: string, id: string) {
    if (!isUuid(id)) throw new NotFoundException('评论不存在');
    const prev = await this.prisma.comment.findUnique({
      where: { id },
      select: { userId: true, targetType: true, targetId: true, status: true },
    });
    if (!prev) throw new NotFoundException('评论不存在');
    if (prev.userId !== userId) {
      const profile = await this.prisma.profile.findUnique({
        where: { id: userId },
        select: { isAdmin: true },
      });
      if (!profile?.isAdmin) throw new ForbiddenException('无权限操作他人内容');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.comment.update({
        where: { id },
        data: { status: 'deleted' },
      });
      // 仅首次软删时递减计数
      if (prev.status === 'normal') {
        if (prev.targetType === 'post') {
          await tx.post.update({
            where: { id: prev.targetId },
            data: { commentCount: { decrement: 1 } },
          });
        } else {
          await tx.product.update({
            where: { id: prev.targetId },
            data: { commentCount: { decrement: 1 } },
          });
        }
      }
    });
    return { ok: true };
  }

  private async ensureTargetExists(
    targetType: 'post' | 'product',
    targetId: string,
  ) {
    if (targetType === 'post') {
      const post = await this.prisma.post.findUnique({
        where: { id: targetId },
        select: { status: true },
      });
      if (!post || post.status === 'deleted') {
        throw new NotFoundException('帖子不存在或已删除');
      }
    } else {
      const product = await this.prisma.product.findUnique({
        where: { id: targetId },
        select: { status: true },
      });
      if (!product || product.status === 'deleted') {
        throw new NotFoundException('商品不存在或已删除');
      }
    }
  }
}
