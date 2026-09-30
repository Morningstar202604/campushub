import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /** 帖子搜索：normal 状态 + 标题模糊，最新在前，limit 20 */
  searchPosts(keyword: string, limit = 20) {
    return this.prisma.post.findMany({
      where: {
        status: 'normal',
        title: { contains: keyword, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(50, Math.max(1, limit)),
      select: {
        id: true,
        categoryId: true,
        kind: true,
        title: true,
        content: true,
        images: true,
        isAnonymous: true,
        likeCount: true,
        commentCount: true,
        createdAt: true,
      },
    });
  }

  /** 商品搜索：在售 + 标题模糊，最新在前，limit 20 */
  searchProducts(keyword: string, limit = 20) {
    return this.prisma.product.findMany({
      where: {
        status: 'on_sale',
        title: { contains: keyword, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(50, Math.max(1, limit)),
      select: {
        id: true,
        title: true,
        description: true,
        images: true,
        price: true,
        createdAt: true,
      },
    });
  }

  /** 统一搜索：tab=post|product 缺省全查 */
  async all(keyword: string, tab?: string, limit = 20) {
    const kw = keyword.trim();
    if (!kw) return { posts: [], products: [] };
    const [posts, products] = await Promise.all([
      !tab || tab === 'post' ? this.searchPosts(kw, limit) : [],
      !tab || tab === 'product' ? this.searchProducts(kw, limit) : [],
    ]);
    return { posts, products };
  }
}
