import { http } from '@/lib/http'
import { resolveStaticUrl } from '@/lib/upload'
import type { Post, Product } from '@/types'

function toPost(raw: any): Post {
  return {
    id: raw.id,
    author_id: raw.authorId,
    category_id: raw.categoryId,
    kind: raw.kind,
    title: raw.title,
    content: raw.content,
    images: (raw.images ?? []).map(resolveStaticUrl),
    tags: raw.tags ?? [],
    location: raw.location ?? '',
    is_anonymous: raw.isAnonymous ?? false,
    expire_at: raw.expireAt ?? null,
    resolved: raw.resolved ?? false,
    status: raw.status ?? 'normal',
    is_pinned: raw.isPinned ?? false,
    is_essence: raw.isEssence ?? false,
    like_count: raw.likeCount ?? 0,
    comment_count: raw.commentCount ?? 0,
    collect_count: raw.collectCount ?? 0,
    view_count: raw.viewCount ?? 0,
    created_at: raw.createdAt
  }
}

function toProduct(raw: any): Product {
  return {
    id: raw.id,
    seller_id: raw.sellerId,
    category_id: raw.categoryId,
    title: raw.title,
    description: raw.description,
    images: (raw.images ?? []).map(resolveStaticUrl),
    price: Number(raw.price),
    original_price: raw.originalPrice == null ? null : Number(raw.originalPrice),
    condition: raw.condition,
    trade_type: raw.tradeType ?? '',
    location: raw.location ?? '',
    contact_info: raw.contactInfo ?? '',
    status: raw.status ?? 'on_sale',
    like_count: raw.likeCount ?? 0,
    comment_count: raw.commentCount ?? 0,
    collect_count: raw.collectCount ?? 0,
    view_count: raw.viewCount ?? 0,
    created_at: raw.createdAt
  }
}

/** 我的帖子 */
export async function myPosts(): Promise<Post[]> {
  const data = await http.get<any[]>('/posts/me')
  return (data ?? []).map(toPost)
}

/** 我的商品 */
export async function myProducts(): Promise<Product[]> {
  const data = await http.get<any[]>('/products/me')
  return (data ?? []).map(toProduct)
}

/** 我的收藏（帖子+商品混合） */
export async function myCollects(): Promise<(Post | Product)[]> {
  const data = await http.get<any>('/me/collects?pageSize=100')
  const items = data.list ?? []
  const merged: (Post | Product)[] = []
  for (const it of items) {
    if (it.targetType === 'post') merged.push(toPost(it.target))
    else if (it.targetType === 'product') merged.push(toProduct(it.target))
  }
  return merged
}
