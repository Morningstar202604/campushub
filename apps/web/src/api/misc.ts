import { supabase } from '@/lib/supabase'
import { USE_MOCK } from '@/lib/mock'
import {
  mockMyNotifications, mockMarkAllRead, mockGuideCategories, mockGuides, mockGuideById,
  mockDoCheckin, mockMyCheckins, mockSubmitReport, mockSubmitFeedback,
  mockSearchPosts, mockSearchProducts, mockCategories, mockAnnouncements
} from '@/mock/api'
import type { Notification, Guide, GuideCategory, Category, Announcement } from '@/types'

// ---------- 通知 ----------
export async function myNotifications() {
  if (USE_MOCK) return mockMyNotifications()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('请先登录')
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return (data ?? []) as Notification[]
}

export async function markAllRead() {
  if (USE_MOCK) return mockMarkAllRead()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
}

export async function unreadCount(): Promise<number> {
  if (USE_MOCK) return 0
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0
  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('is_read', false)
  return count ?? 0
}

// ---------- 指南 ----------
export async function guideCategories(): Promise<GuideCategory[]> {
  if (USE_MOCK) return mockGuideCategories()
  const { data, error } = await supabase.from('guide_categories').select('*').order('sort')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function guides(categoryId?: string): Promise<Guide[]> {
  if (USE_MOCK) return mockGuides(categoryId)
  let q = supabase.from('guides').select('*').eq('status', 'published').order('sort').order('created_at', { ascending: false })
  if (categoryId) q = q.eq('category_id', categoryId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function guideById(id: string): Promise<Guide | null> {
  if (USE_MOCK) return mockGuideById(id)
  const { data, error } = await supabase.from('guides').select('*').eq('id', id).single()
  if (error) throw new Error(error.message)
  return data
}

// ---------- 分类 / 公告（App 启动加载） ----------
export async function categories(): Promise<Category[]> {
  if (USE_MOCK) return mockCategories()
  const { data, error } = await supabase.from('categories').select('*').eq('enabled', true).order('sort')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function announcements(): Promise<Announcement[]> {
  if (USE_MOCK) return mockAnnouncements()
  const { data, error } = await supabase.from('announcements').select('*').eq('is_active', true)
    .eq('status', 'active').order('created_at', { ascending: false }).limit(5)
  if (error) throw new Error(error.message)
  return data ?? []
}

// ---------- 签到 / 积分 ----------
export async function doCheckin() {
  if (USE_MOCK) return mockDoCheckin()
  const { data, error } = await supabase.rpc('checkin')
  if (error) {
    if (/ALREADY_CHECKED_IN/.test(error.message)) throw new Error('今天已经签到过了')
    if (/NOT_LOGGED_IN/.test(error.message)) throw new Error('请先登录')
    throw new Error(error.message)
  }
  return data as { date: string; streak: number; points: number }
}

export async function myCheckins(limit = 30) {
  if (USE_MOCK) return mockMyCheckins()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase.from('checkins').select('*').eq('user_id', user.id)
    .order('date', { ascending: false }).limit(limit)
  return data ?? []
}

// ---------- 举报 / 反馈 ----------
export async function submitReport(targetType: 'post' | 'product' | 'comment' | 'user', targetId: string, reason: string, detail = '') {
  if (USE_MOCK) return mockSubmitReport(targetType, targetId, reason, detail)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('请先登录')
  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id, target_type: targetType, target_id: targetId, reason, detail
  })
  if (error) throw new Error(error.message)
}

export async function submitFeedback(content: string, contact = '') {
  if (USE_MOCK) return mockSubmitFeedback(content, contact)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('请先登录')
  const { error } = await supabase.from('feedbacks').insert({ user_id: user.id, content, contact })
  if (error) throw new Error(error.message)
}

// ---------- 搜索（pg_trgm 模糊匹配） ----------
export async function searchPosts(keyword: string) {
  if (USE_MOCK) return mockSearchPosts(keyword)
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, content, kind, is_anonymous, like_count, comment_count, created_at')
    .eq('status', 'normal')
    .ilike('title', `%${keyword}%`)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function searchProducts(keyword: string) {
  if (USE_MOCK) return mockSearchProducts(keyword)
  const { data, error } = await supabase
    .from('products')
    .select('id, title, description, price, images, status, created_at')
    .eq('status', 'on_sale')
    .ilike('title', `%${keyword}%`)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw new Error(error.message)
  return data ?? []
}
