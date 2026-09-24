// 数据模型类型（与 packages/db/schema.sql 一一对应）

export interface Profile {
  id: string
  nickname: string
  avatar: string
  bio: string
  college: string
  major: string
  grade: string
  gender: number
  tags: string[]
  points: number
  checkin_streak: number
  last_checkin_date: string | null
  is_admin: boolean
  is_banned: boolean
  created_at: string
}

export type PostKind = 'post' | 'task' | 'lost' | 'found' | 'confession'

export interface Post {
  id: string
  author_id: string
  category_id: string
  kind: PostKind
  title: string
  content: string
  images: string[]
  tags: string[]
  location: string
  is_anonymous: boolean
  expire_at: string | null
  resolved: boolean
  status: 'normal' | 'expired' | 'deleted'
  is_pinned: boolean
  is_essence: boolean
  like_count: number
  comment_count: number
  collect_count: number
  view_count: number
  created_at: string
  author?: Pick<Profile, 'id' | 'nickname' | 'avatar'>
}

export interface Product {
  id: string
  seller_id: string
  category_id: string
  title: string
  description: string
  images: string[]
  price: number
  original_price: number | null
  condition: string
  trade_type: string
  location: string
  contact_info: string
  status: 'on_sale' | 'sold' | 'off_shelf' | 'deleted'
  like_count: number
  comment_count: number
  collect_count: number
  view_count: number
  created_at: string
  seller?: Pick<Profile, 'id' | 'nickname' | 'avatar'>
}

export interface Comment {
  id: string
  target_type: 'post' | 'product'
  target_id: string
  user_id: string
  parent_id: string | null
  reply_to_user_id: string | null
  content: string
  status: 'normal' | 'deleted'
  like_count: number
  created_at: string
  user?: Pick<Profile, 'id' | 'nickname' | 'avatar'>
}

export interface Category {
  id: string
  parent_id: string | null
  name: string
  emoji: string
  sort: number
  status: string
}

export interface Notification {
  id: string
  user_id: string
  type: 'like' | 'comment' | 'follow' | 'system' | 'report_result'
  target_type: string
  target_id: string | null
  actor_id: string | null
  content: string
  is_read: boolean
  created_at: string
}

export interface Announcement {
  id: string
  title: string
  content: string
  is_pinned: boolean
  status: string
  created_at: string
}

export interface Guide {
  id: string
  category_id: string | null
  title: string
  summary: string
  content: string
  cover_image: string
  tags: string[]
  view_count: number
  status: string
  sort: number
  created_at: string
}

export interface GuideCategory {
  id: string
  name: string
  icon: string
  sort: number
}
