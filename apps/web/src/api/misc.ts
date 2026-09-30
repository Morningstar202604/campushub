import { http } from '@/lib/http'
import { resolveStaticUrl } from '@/lib/upload'
import type { Notification, Guide, GuideCategory, Category, Announcement } from '@/types'

function toNotification(raw: any): Notification {
  return {
    id: raw.id,
    user_id: raw.userId,
    type: raw.type,
    target_type: raw.targetType ?? '',
    target_id: raw.targetId ?? null,
    actor_id: raw.actorId ?? null,
    content: raw.content ?? '',
    is_read: raw.isRead ?? false,
    created_at: raw.createdAt
  }
}

function toGuide(raw: any): Guide {
  return {
    id: raw.id,
    category_id: raw.categoryId ?? null,
    title: raw.title,
    summary: raw.summary ?? '',
    content: raw.content ?? '',
    cover_image: resolveStaticUrl(raw.coverImage ?? ''),
    tags: raw.tags ?? [],
    view_count: raw.viewCount ?? 0,
    status: raw.status ?? 'published',
    sort: raw.sort ?? 0,
    created_at: raw.createdAt
  }
}

// ---------- 通知 ----------
export async function myNotifications(): Promise<Notification[]> {
  const data = await http.get<any[]>('/notifications?limit=50')
  return (data ?? []).map(toNotification)
}

export async function markAllRead() {
  await http.patch('/notifications/read-all')
}

export async function unreadCount(): Promise<number> {
  const data = await http.get<any>('/notifications/unread-count')
  return data.count ?? 0
}

// ---------- 指南 ----------
export async function guideCategories(): Promise<GuideCategory[]> {
  const data = await http.get<any[]>('/guides/categories')
  return data ?? []
}

export async function guides(categoryId?: string): Promise<Guide[]> {
  const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ''
  const data = await http.get<any[]>(`/guides${qs}`)
  return (data ?? []).map(toGuide)
}

export async function guideById(id: string): Promise<Guide | null> {
  const data = await http.get<any>(`/guides/${id}`)
  return toGuide(data)
}

// ---------- 分类 / 公告（App 启动加载） ----------
export async function categories(): Promise<Category[]> {
  const data = await http.get<any[]>('/categories')
  return (data ?? []).map((raw: any) => ({
    id: raw.id,
    parent_id: raw.parentId ?? null,
    name: raw.name,
    emoji: raw.emoji ?? '',
    sort: raw.sort ?? 0,
    status: raw.status ?? 'active'
  }))
}

export async function announcements(): Promise<Announcement[]> {
  const data = await http.get<any[]>('/announcements?limit=5')
  return (data ?? []).map((raw: any) => ({
    id: raw.id,
    title: raw.title,
    content: raw.content ?? '',
    is_pinned: raw.isPinned ?? false,
    status: raw.status ?? 'active',
    created_at: raw.createdAt
  }))
}

// ---------- 签到 / 积分 ----------
export async function doCheckin() {
  const data = await http.post<any>('/checkins')
  return { date: data.date, streak: data.streak, points: data.points }
}

export async function myCheckins(limit = 30) {
  const data = await http.get<any[]>(`/checkins?limit=${limit}`)
  return (data ?? []).map((raw: any) => ({
    id: raw.id ?? '',
    date: raw.date,
    streak: raw.streak,
    points: raw.points,
    created_at: raw.createdAt
  }))
}

// ---------- 举报 / 反馈 ----------
export async function submitReport(targetType: 'post' | 'product', targetId: string, reason: string, detail = '') {
  await http.post(`/${targetType}s/${targetId}/report`, { reason, detail })
}

export async function submitFeedback(content: string, contact = '') {
  await http.post('/feedbacks', { content, contact })
}

// ---------- 搜索 ----------
export async function searchPosts(keyword: string) {
  const data = await http.get<any>(`/search?keyword=${encodeURIComponent(keyword)}&tab=post`)
  return (data.posts ?? []).map((raw: any) => ({
    id: raw.id,
    title: raw.title,
    content: raw.content ?? '',
    kind: raw.kind,
    is_anonymous: raw.isAnonymous ?? false,
    like_count: raw.likeCount ?? 0,
    comment_count: raw.commentCount ?? 0,
    created_at: raw.createdAt
  }))
}

export async function searchProducts(keyword: string) {
  const data = await http.get<any>(`/search?keyword=${encodeURIComponent(keyword)}&tab=product`)
  return (data.products ?? []).map((raw: any) => ({
    id: raw.id,
    title: raw.title,
    description: raw.description ?? '',
    price: Number(raw.price),
    images: (raw.images ?? []).map(resolveStaticUrl),
    status: raw.status ?? 'on_sale',
    created_at: raw.createdAt
  }))
}
