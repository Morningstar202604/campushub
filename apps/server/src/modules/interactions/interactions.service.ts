import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isUuid } from '../../common/utils/uuid.js';

type TargetType = 'post' | 'product';

const POST_SELECT = {
  id: true, kind: true, title: true, content: true, images: true,
  categoryId: true, isAnonymous: true, likeCount: true, collectCount: true,
  createdAt: true,
};
const PRODUCT_SELECT = {
  id: true, title: true, images: true, price: true, status: true,
  likeCount: true, collectCount: true, createdAt: true,
};

@Injectable()
export class InteractionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 点赞：已赞幂等返回；首次点赞事务内计数 +1 */
  async like(userId: string, targetType: TargetType, targetId: string) {
    await this.ensureTarget(targetType, targetId);
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.like.findUnique({
        where: {
          userId_targetType_targetId: { userId, targetType, targetId },
        },
      });
      if (existing) return;
      await tx.like.create({ data: { userId, targetType, targetId } });
      await this.bumpCount(tx, targetType, targetId, 'likeCount', 1);
    });
    return { liked: true };
  }

  /** 取消点赞：幂等 */
  async unlike(userId: string, targetType: TargetType, targetId: string) {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.like.findUnique({
        where: {
          userId_targetType_targetId: { userId, targetType, targetId },
        },
      });
      if (!existing) return;
      await tx.like.delete({ where: { id: existing.id } });
      await this.bumpCount(tx, targetType, targetId, 'likeCount', -1);
    });
    return { liked: false };
  }

  /** 收藏 */
  async collect(userId: string, targetType: TargetType, targetId: string) {
    await this.ensureTarget(targetType, targetId);
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.collect.findUnique({
        where: {
          userId_targetType_targetId: { userId, targetType, targetId },
        },
      });
      if (existing) return;
      await tx.collect.create({ data: { userId, targetType, targetId } });
      await this.bumpCount(tx, targetType, targetId, 'collectCount', 1);
    });
    return { collected: true };
  }

  /** 取消收藏 */
  async uncollect(userId: string, targetType: TargetType, targetId: string) {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.collect.findUnique({
        where: {
          userId_targetType_targetId: { userId, targetType, targetId },
        },
      });
      if (!existing) return;
      await tx.collect.delete({ where: { id: existing.id } });
      await this.bumpCount(tx, targetType, targetId, 'collectCount', -1);
    });
    return { collected: false };
  }

  /** 我赞过的列表（按目标聚合，多态组装） */
  async myLikes(userId: string, page = 1, pageSize = 20) {
    return this.myTargets(userId, 'like', page, pageSize);
  }

  /** 对某目标的点赞/收藏状态（未登录由前端不发请求处理） */
  async status(userId: string, targetType: TargetType, targetId: string) {
    if (!isUuid(targetId)) throw new NotFoundException('内容不存在或已删除');
    const [liked, collected] = await Promise.all([
      this.prisma.like.findUnique({
        where: { userId_targetType_targetId: { userId, targetType, targetId } },
        select: { id: true },
      }),
      this.prisma.collect.findUnique({
        where: { userId_targetType_targetId: { userId, targetType, targetId } },
        select: { id: true },
      }),
    ]);
    return { liked: !!liked, collected: !!collected };
  }

  /** 关注（幂等；不能关注自己） */
  async follow(userId: string, followingId: string) {
    if (!isUuid(followingId)) throw new NotFoundException('用户不存在');
    if (userId === followingId) throw new BadRequestException('不能关注自己');
    const target = await this.prisma.profile.findUnique({
      where: { id: followingId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('用户不存在');
    await this.prisma.follow.upsert({
      where: {
        followerId_followingId: { followerId: userId, followingId },
      },
      update: {},
      create: { followerId: userId, followingId },
    });
    return { following: true };
  }

  /** 取关（幂等） */
  async unfollow(userId: string, followingId: string) {
    await this.prisma.follow.deleteMany({
      where: { followerId: userId, followingId },
    });
    return { following: false };
  }

  /** 我是否已关注该用户 */
  async isFollowing(userId: string, followingId: string) {
    const row = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userId, followingId } },
      select: { id: true },
    });
    return { following: !!row };
  }

  /** 某用户粉丝数（公开） */
  async followerCount(followingId: string) {
    if (!isUuid(followingId)) throw new NotFoundException('用户不存在');
    const count = await this.prisma.follow.count({
      where: { followingId },
    });
    return { count };
  }

  /** 我收藏的列表 */
  async myCollects(userId: string, page = 1, pageSize = 20) {
    return this.myTargets(userId, 'collect', page, pageSize);
  }

  private async myTargets(
    userId: string,
    kind: 'like' | 'collect',
    page: number,
    pageSize: number,
  ) {
    const base = {
      where: { userId },
      orderBy: { createdAt: 'desc' as const },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { targetType: true, targetId: true, createdAt: true },
    };
    const rows =
      kind === 'like'
        ? await this.prisma.like.findMany(base)
        : await this.prisma.collect.findMany(base);

    const postIds = rows.filter((r) => r.targetType === 'post').map((r) => r.targetId);
    const productIds = rows
      .filter((r) => r.targetType === 'product')
      .map((r) => r.targetId);

    const [posts, products] = await Promise.all([
      postIds.length
        ? this.prisma.post.findMany({ where: { id: { in: postIds }, status: 'normal' }, select: POST_SELECT })
        : Promise.resolve([]),
      productIds.length
        ? this.prisma.product.findMany({ where: { id: { in: productIds }, status: { not: 'deleted' } }, select: PRODUCT_SELECT })
        : Promise.resolve([]),
    ]);

    const postMap = new Map(posts.map((p) => [p.id, p]));
    const productMap = new Map(products.map((p) => [p.id, p]));

    const list = rows
      .map((r) => {
        const target =
          r.targetType === 'post' ? postMap.get(r.targetId) : productMap.get(r.targetId);
        return target
          ? { targetType: r.targetType, targetId: r.targetId, createdAt: r.createdAt, target }
          : null;
      })
      .filter(Boolean);

    return { list, page, pageSize, hasMore: list.length === pageSize };
  }

  /** 目标存在性校验（点赞/收藏只针对正常内容） */
  private async ensureTarget(targetType: TargetType, targetId: string) {
    if (!isUuid(targetId)) throw new NotFoundException('内容不存在或已删除');
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

  /** 计数增减：不能低于 0（并发下防止 -1 计数） */
  private async bumpCount(
    tx: Prisma.TransactionClient,
    targetType: TargetType,
    targetId: string,
    field: 'likeCount' | 'collectCount',
    delta: number,
  ) {
    if (targetType === 'post') {
      await tx.post.updateMany({
        where: { id: targetId, [field]: delta < 0 ? { gt: 0 } : undefined },
        data: { [field]: { increment: delta } },
      });
    } else {
      await tx.product.updateMany({
        where: { id: targetId, [field]: delta < 0 ? { gt: 0 } : undefined },
        data: { [field]: { increment: delta } },
      });
    }
  }
}
