import { http } from '@/lib/http'
import { resolveStaticUrl } from '@/lib/upload'
import type { components } from '@/types/api'
import type { Product } from '@/types'

type CreateProductApi = components['schemas']['CreateProductDto']

/** 后端 camelCase + Decimal 字符串 → 前端 Product（snake_case, price number） */
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
    created_at: raw.createdAt,
    seller: raw.seller ? { id: raw.seller.id, nickname: raw.seller.nickname, avatar: raw.seller.avatar } : undefined
  }
}

export async function marketProducts(f: { categoryId?: string; page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams()
  if (f.categoryId) params.set('categoryId', f.categoryId)
  params.set('page', String(f.page ?? 1))
  params.set('pageSize', String(Math.min(30, f.pageSize ?? 20)))
  const qs = params.toString()
  const data = await http.get<any>(`/products${qs ? `?${qs}` : ''}`, { cache: true })
  return {
    list: (data.list ?? []).map(toProduct),
    total: data.total ?? 0,
    hasMore: data.hasMore ?? false
  }
}

export async function productById(id: string): Promise<Product | null> {
  const data = await http.get<any>(`/products/${id}`)
  return toProduct(data)
}

export interface CreateProductInput {
  category_id: string
  title: string
  description: string
  images?: string[]
  price: number
  original_price?: number | null
  condition: string
  trade_type: string
  location: string
  contact_info: string
}

export async function createProduct(input: CreateProductInput) {
  const body: CreateProductApi = {
    categoryId: input.category_id,
    title: input.title,
    description: input.description,
    images: input.images ?? [],
    price: input.price,
    originalPrice: input.original_price ?? null,
    condition: input.condition,
    tradeType: input.trade_type,
    location: input.location,
    contactInfo: input.contact_info
  }
  const data = await http.post<any>('/products', body)
  return { id: data.id }
}

export async function updateProductStatus(id: string, status: 'sold' | 'off_shelf' | 'on_sale') {
  await http.patch(`/products/${id}/status`, { status })
}

export async function softDeleteProduct(id: string) {
  await http.del(`/products/${id}`)
}
