import { supabase } from '@/lib/supabase'
import { USE_MOCK } from '@/lib/mock'
import {
  mockFeedPosts, mockPostById, mockCreatePost, mockSoftDeletePost, mockMarkResolved,
  mockListComments, mockAddComment, mockSoftDeleteComment
} from '@/mock/api'
import type { Post, Comment } from '@/types'

const POST_FIELDS = `
  id, author_id, category_id, kind, title, content, images, tags, location,
  is_anonymous, expire_at, resolved, status, is_pinned, is_essence,
  like_count, comment_count, collect_count, view_count, created_at,
  author:profiles!posts_author_id_fkey(id, nickname, avatar)
`

export interface FeedFilter {
  categoryId?: string
  kind?: string
  tab?: 'recommend' | 'latest' | 'hot'
  page?: number
  pageSize?: number
}

/** 把 PostgREST 嵌入的 author 数组归一化为单对象 */
function normalizePost(row: any): Post {
  return { ...row, author: Array.isArray(row.author) ? row.author[0] : row.author }
}

/** 首页信息流：status=normal，过期任务帖排除 */
export async function feedPosts(f: FeedFilter = {}) {
  if (USE_MOCK) return mockFeedPosts(f)
  const page = f.page ?? 1
  const pageSize = Math.min(30, f.pageSize ?? 20)
  let q = supabase
    .from('posts')
    .select(POST_FIELDS, { count: 'exact' })
    .eq('status', 'normal')

  if (f.categoryId) q = q.eq('category_id', f.categoryId)
  if (f.kind) q = q.eq('kind', f.kind)

  // 排除过期未解决的任务帖
  q = q.or(`kind.neq.task,resolved.eq.true,expire_at.gt.${new Date().toISOString()}`)

  if (f.tab === 'hot') {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    q = q.gte('created_at', weekAgo).order('like_count', { ascending: false })
  } else if (f.tab === 'latest') {
    q = q.order('created_at', { ascending: false })
  } else {
    q = q.order('is_pinned', { ascending: false }).order('created_at', { ascending: false })
  }

  const offset = (page - 1) * pageSize
  const { data, error } = await q.range(offset, offset + pageSize - 1)
  if (error) throw new Error(error.message)
  return { list: (data ?? []).map(normalizePost), hasMore: (data?.length ?? 0) === pageSize }
}

export async function postById(id: string): Promise<Post | null> {
  if (USE_MOCK) return mockPostById(id)
  const { data, error } = await supabase.from('posts').select(POST_FIELDS).eq('id', id).single()
  if (error) throw new Error(error.message)
  return normalizePost(data)
}

export interface CreatePostInput {
  category_id: string
  kind: string
  title: string
  content: string
  images?: string[]
  tags?: string[]
  location?: string
  is_anonymous?: boolean
  expire_at?: string | null
}

export async function createPost(input: CreatePostInput) {
  if (USE_MOCK) return mockCreatePost(input)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('请先登录')
  const { data, error } = await supabase
    .from('posts')
    .insert({ ...input, author_id: user.id })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data
}

/** 软删除（RLS 只允许作者/管理员） */
export async function softDeletePost(id: string) {
  if (USE_MOCK) return mockSoftDeletePost(id)
  const { error } = await supabase.from('posts').update({ status: 'deleted' }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function markResolved(id: string, resolved: boolean) {
  if (USE_MOCK) return mockMarkResolved(id, resolved)
  const { error } = await supabase.from('posts').update({ resolved }).eq('id', id)
  if (error) throw new Error(error.message)
}

// ---------- 评论 ----------
export async function listComments(targetType: 'post' | 'product', targetId: string) {
  if (USE_MOCK) return mockListComments(targetType, targetId)
  const { data, error } = await supabase
    .from('comments')
    .select(`id, target_type, target_id, user_id, parent_id, reply_to_user_id, content, status, like_count, created_at,
      user:profiles!comments_user_id_fkey(id, nickname, avatar)`)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .eq('status', 'normal')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row: any) => ({ ...row, user: Array.isArray(row.user) ? row.user[0] : row.user })) as Comment[]
}

export async function addComment(targetType: 'post' | 'product', targetId: string, content: string, parentId?: string) {
  if (USE_MOCK) return mockAddComment(targetType, targetId, content, parentId)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('请先登录')
  const { data, error } = await supabase
    .from('comments')
    .insert({ target_type: targetType, target_id: targetId, user_id: user.id, content, parent_id: parentId ?? null })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function softDeleteComment(id: string) {
  if (USE_MOCK) return mockSoftDeleteComment(id)
  const { error } = await supabase.from('comments').update({ status: 'deleted' }).eq('id', id)
  if (error) throw new Error(error.message)
}
