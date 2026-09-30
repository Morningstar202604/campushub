import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { isUuid } from '../../common/utils/uuid.js';
import {
  CreateProductDto,
  ProductQuery,
  ReportProductDto,
  UpdateProductDto,
} from './dto/products.dto.js';

const SELLER_SELECT = { id: true, nickname: true, avatar: true };

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 市集列表：在售 + 分类/成色/关键字过滤 + 排序 */
  async list(q: ProductQuery) {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(30, Math.max(1, q.pageSize ?? 20));

    const where: Prisma.ProductWhereInput = {
      status: 'on_sale',
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.condition ? { condition: q.condition } : {}),
      ...(q.keyword
        ? {
            OR: [
              { title: { contains: q.keyword, mode: 'insensitive' } },
              { description: { contains: q.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    let orderBy: Prisma.ProductOrderByWithRelationInput[];
    switch (q.sort) {
      case 'priceAsc':
        orderBy = [{ price: 'asc' }, { createdAt: 'desc' }];
        break;
      case 'priceDesc':
        orderBy = [{ price: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'hot':
        orderBy = [{ likeCount: 'desc' }, { createdAt: 'desc' }];
        break;
      default:
        orderBy = [{ createdAt: 'desc' }];
    }

    const [list, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, categoryId: true, title: true, description: true,
          images: true, price: true, originalPrice: true, condition: true,
          tradeType: true, location: true, status: true, likeCount: true,
          commentCount: true, collectCount: true, viewCount: true,
          createdAt: true, updatedAt: true,
          seller: { select: SELLER_SELECT },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { list, total, hasMore: (page - 1) * pageSize + list.length < total };
  }

  /** 详情：view_count +1 */
  async detail(id: string) {
    if (!isUuid(id)) throw new NotFoundException('商品不存在或已删除');
    const product = await this.prisma.product.findFirst({
      where: { id, status: { not: 'deleted' } },
      select: {
        id: true, sellerId: true, categoryId: true, title: true,
        description: true, images: true, price: true, originalPrice: true,
        condition: true, tradeType: true, location: true, contactInfo: true,
        status: true, likeCount: true, commentCount: true, collectCount: true,
        viewCount: true, createdAt: true, updatedAt: true,
        seller: { select: SELLER_SELECT },
      },
    });
    if (!product) throw new NotFoundException('商品不存在或已删除');

    await this.prisma.product
      .update({ where: { id }, data: { viewCount: { increment: 1 } } })
      .catch(() => undefined);

    return product;
  }

  /** 发布：校验分类 + 价格保留 2 位小数 */
  async create(userId: string, dto: CreateProductDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category || category.status !== 'active') {
      throw new BadRequestException('分类不存在或已停用');
    }
    const product = await this.prisma.product.create({
      data: {
        seller: { connect: { id: userId } },
        category: { connect: { id: dto.categoryId } },
        title: dto.title,
        description: dto.description ?? '',
        images: dto.images ?? [],
        price: this.round2(dto.price),
        originalPrice: dto.originalPrice != null ? this.round2(dto.originalPrice) : null,
        condition: dto.condition ?? 'good',
        tradeType: dto.tradeType ?? '',
        location: dto.location ?? '',
        contactInfo: dto.contactInfo ?? '',
      },
      select: { id: true, createdAt: true },
    });
    return product;
  }

  /** 编辑：作者/管理员 */
  async update(userId: string, id: string, dto: UpdateProductDto) {
    await this.requireOwnerOrAdmin(userId, id);
    // 注意：带关系的 UpdateInput 不含标量 categoryId，须用 Unchecked 变体
    const data: Prisma.ProductUncheckedUpdateInput = {};
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.images !== undefined) data.images = dto.images;
    if (dto.price !== undefined) data.price = this.round2(dto.price);
    if (dto.originalPrice !== undefined) {
      data.originalPrice =
        dto.originalPrice == null ? null : this.round2(dto.originalPrice);
    }
    if (dto.condition !== undefined) data.condition = dto.condition;
    if (dto.tradeType !== undefined) data.tradeType = dto.tradeType;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.contactInfo !== undefined) data.contactInfo = dto.contactInfo;

    return this.prisma.product.update({
      where: { id },
      data,
      select: { id: true, title: true, price: true, updatedAt: true },
    });
  }

  /** 状态流转：上架/下架/标记已售（deleted 只走软删接口） */
  async updateStatus(
    userId: string,
    id: string,
    status: 'on_sale' | 'off_shelf' | 'sold',
  ) {
    await this.requireOwnerOrAdmin(userId, id);
    return this.prisma.product.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });
  }

  /** 软删 */
  async softDelete(userId: string, id: string) {
    await this.requireOwnerOrAdmin(userId, id);
    await this.prisma.product.update({
      where: { id },
      data: { status: 'deleted' },
    });
    return { ok: true };
  }

  /** 我发布的（不含软删） */
  async myProducts(userId: string, page = 1, pageSize = 20) {
    const [list, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: { sellerId: userId, status: { not: 'deleted' } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, categoryId: true, title: true, images: true, price: true,
          condition: true, status: true, likeCount: true, viewCount: true,
          createdAt: true,
        },
      }),
      this.prisma.product.count({
        where: { sellerId: userId, status: { not: 'deleted' } },
      }),
    ]);
    return { list, total, hasMore: (page - 1) * pageSize + list.length < total };
  }

  /** 举报商品 */
  async report(userId: string, id: string, dto: ReportProductDto) {
    if (!isUuid(id)) throw new NotFoundException('商品不存在或已删除');
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!product || product.status === 'deleted') {
      throw new NotFoundException('商品不存在或已删除');
    }
    await this.prisma.report.create({
      data: {
        reporterId: userId,
        targetType: 'product',
        targetId: id,
        reason: dto.reason,
        detail: dto.detail ?? '',
      },
    });
    return { ok: true };
  }

  private async requireOwnerOrAdmin(userId: string, id: string) {
    if (!isUuid(id)) throw new NotFoundException('商品不存在或已删除');
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { sellerId: true },
    });
    if (!product) throw new NotFoundException('商品不存在或已删除');
    if (product.sellerId === userId) return product;
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    if (!profile?.isAdmin) throw new ForbiddenException('无权限操作他人内容');
    return product;
  }

  private round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }
}
