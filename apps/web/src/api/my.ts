import { supabase } from '@/lib/supabase'
import { USE_MOCK } from '@/lib/mock'
import { mockMyPosts, mockMyProducts, mockMyCollects } from '@/mock/api'
import type { Post, Product } from '@/types'

/** 我的帖子 */
export async function myPosts(): Promise<Post[]> {
  if (USE_MOCK) return mockMyPosts()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('请先登录')
  const { data, error } = await supabase
    .from('posts')
    .select('id, author_id, category_id, kind, title, content, images, tags, location, is_anonymous, expire_at, resolved, status, is_pinned, is_essence, like_count, comment_count, collect_count, view_count, created_at')
    .eq('author_id', user.id)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Post[]
}

/** 我的商品 */
export async function myProducts(): Promise<Product[]> {
  if (USE_MOCK) return mockMyProducts()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('请先登录')
  const { data, error } = await supabase
    .from('products')
    .select('id, seller_id, category_id, title, description, images, price, original_price, condition, trade_type, location, contact_info, status, like_count, collect_count, comment_count, view_count, created_at')
    .eq('seller_id', user.id)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

/** 我的收藏（帖子+商品混合） */
export async function myCollects(): Promise<(Post | Product)[]> {
  if (USE_MOCK) return mockMyCollects()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('请先登录')
  const { data: rows, error } = await supabase
    .from('collects')
    .select('target_type, target_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  const postIds = (rows ?? []).filter(r => r.target_type === 'post').map(r => r.target_id)
  const productIds = (rows ?? []).filter(r => r.target_type === 'product').map(r => r.target_id)
  const [postsRes, productsRes] = await Promise.all([
    postIds.length
      ? supabase.from('posts').select('*').in('id', postIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    productIds.length
      ? supabase.from('products').select('*').in('id', productIds)
      : Promise.resolve({ data: [] as any[], error: null })
  ])
  if (postsRes.error) throw new Error(postsRes.error.message)
  if (productsRes.error) throw new Error(productsRes.error.message)
  return [...(postsRes.data ?? []), ...(productsRes.data ?? [])] as (Post | Product)[]
}
