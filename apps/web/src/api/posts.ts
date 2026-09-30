import { http } from '@/lib/http'
import { resolveStaticUrl } from '@/lib/upload'
import type { components } from '@/types/api'
import type { Post, Comment } from '@/types'

type CreatePostApi = components['schemas']['CreatePostDto']

export interface FeedFilter {
  categoryId?: string
  kind?: string
  tab?: 'recommend' | 'latest' | 'hot'
  page?: number
  pageSize?: number
}

/** 后端 camelCase → 前端 Post（snake_case） */
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
    created_at: raw.createdAt,
    author: raw.author ? { id: raw.author.id, nickname: raw.author.nickname, avatar: raw.author.avatar } : undefined
  }
}

function toComment(raw: any): Comment {
  return {
    id: raw.id,
    target_type: raw.targetType,
    target_id: raw.targetId,
    user_id: raw.userId,
    parent_id: raw.parentId ?? null,
    reply_to_user_id: raw.replyToUserId ?? null,
    content: raw.content,
    status: raw.status ?? 'normal',
    like_count: raw.likeCount ?? 0,
    created_at: raw.createdAt,
    user: raw.user ? { id: raw.user.id, nickname: raw.user.nickname, avatar: raw.user.avatar } : undefined
  }
}

/** 首页信息流：status=normal，过期任务帖排除（服务端规则） */
export async function feedPosts(f: FeedFilter = {}) {
  const params = new URLSearchParams()
  if (f.categoryId) params.set('categoryId', f.categoryId)
  if (f.kind) params.set('kind', f.kind)
  if (f.tab) params.set('tab', f.tab)
  params.set('page', String(f.page ?? 1))
  params.set('pageSize', String(Math.min(30, f.pageSize ?? 20)))
  const qs = params.toString()
  const data = await http.get<any>(`/posts${qs ? `?${qs}` : ''}`, { cache: true })
  return {
    list: (data.list ?? []).map(toPost),
    total: data.total ?? 0,
    hasMore: data.hasMore ?? false
  }
}

export async function postById(id: string): Promise<Post | null> {
  const data = await http.get<any>(`/posts/${id}`)
  return toPost(data)
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
  const body: CreatePostApi = {
    categoryId: input.category_id,
    kind: input.kind,
    title: input.title,
    content: input.content,
    images: input.images ?? [],
    tags: input.tags ?? [],
    location: input.location ?? '',
    isAnonymous: input.is_anonymous ?? false,
    expireAt: input.expire_at ?? null
  }
  const data = await http.post<any>('/posts', body)
  return { id: data.id }
}

/** 软删除（作者/管理员） */
export async function softDeletePost(id: string) {
  await http.del(`/posts/${id}`)
}

export async function markResolved(id: string, resolved: boolean) {
  await http.patch(`/posts/${id}/resolved`, { resolved })
}

// ---------- 评论 ----------
export async function listComments(targetType: 'post' | 'product', targetId: string) {
  const data = await http.get<any>(`/${targetType}s/${targetId}/comments`)
  return (data ?? []).map(toComment)
}

export async function addComment(targetType: 'post' | 'product', targetId: string, content: string, parentId?: string) {
  const data = await http.post<any>(`/${targetType}s/${targetId}/comments`, {
    content,
    ...(parentId ? { parentId } : {})
  })
  return toComment(data)
}

export async function softDeleteComment(id: string) {
  await http.del(`/comments/${id}`)
}
