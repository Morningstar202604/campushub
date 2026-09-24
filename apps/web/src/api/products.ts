import { supabase } from '@/lib/supabase'
import { USE_MOCK } from '@/lib/mock'
import {
  mockMarketProducts, mockProductById, mockCreateProduct, mockUpdateProductStatus, mockSoftDeleteProduct
} from '@/mock/api'
import type { Product } from '@/types'

const PRODUCT_FIELDS = `
  id, seller_id, category_id, title, description, images, price, original_price,
  condition, trade_type, location, contact_info, status,
  like_count, comment_count, collect_count, view_count, created_at,
  seller:profiles!products_seller_id_fkey(id, nickname, avatar)
`

function normalizeProduct(row: any): Product {
  return { ...row, seller: Array.isArray(row.seller) ? row.seller[0] : row.seller }
}

export async function marketProducts(f: { categoryId?: string; page?: number; pageSize?: number } = {}) {
  if (USE_MOCK) return mockMarketProducts(f)
  const page = f.page ?? 1
  const pageSize = Math.min(30, f.pageSize ?? 20)
  let q = supabase
    .from('products')
    .select(PRODUCT_FIELDS, { count: 'exact' })
    .eq('status', 'on_sale')
    .order('created_at', { ascending: false })
  if (f.categoryId) q = q.eq('category_id', f.categoryId)
  const offset = (page - 1) * pageSize
  const { data, error } = await q.range(offset, offset + pageSize - 1)
  if (error) throw new Error(error.message)
  return { list: (data ?? []).map(normalizeProduct), hasMore: (data?.length ?? 0) === pageSize }
}

export async function productById(id: string): Promise<Product | null> {
  if (USE_MOCK) return mockProductById(id)
  const { data, error } = await supabase.from('products').select(PRODUCT_FIELDS).eq('id', id).single()
  if (error) throw new Error(error.message)
  return normalizeProduct(data)
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
  if (USE_MOCK) return mockCreateProduct(input)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('请先登录')
  const { data, error } = await supabase
    .from('products')
    .insert({ ...input, seller_id: user.id })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateProductStatus(id: string, status: 'sold' | 'off_shelf' | 'on_sale') {
  if (USE_MOCK) return mockUpdateProductStatus(id, status)
  const { error } = await supabase.from('products').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function softDeleteProduct(id: string) {
  if (USE_MOCK) return mockSoftDeleteProduct(id)
  const { error } = await supabase.from('products').update({ status: 'deleted' }).eq('id', id)
  if (error) throw new Error(error.message)
}
