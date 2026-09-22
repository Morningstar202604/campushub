// 视图模型适配层：raw 云函数记录 → 前端可渲染字段
// 所有列表页统一经此映射，避免各页散落字段处理
//
// ⚠️ 字段名以云函数落库对象为唯一事实源（见 ../campushub/cloudfunctions/*/index.js）：
//    帖子  posts    : userNickname / userAvatar / isAnonymous / likeCount / commentCount
//    商品  products : userNickname / images[] / price / originalPrice / category / status
//    公告  announcements : title / content / isPinned / status
//    旧代码写的 authorNickname / anonymous 后端从不写入 → 作者名全空、匿名态恒 false，已全部修正。
import { callFunction } from '@/utils/api'

/** 时间 → 显示串（dayjs 替代旧仓自定义 formatTime） */
export function fmtTime(t: unknown): string {
  if (!t) return ''
  const d = new Date(t as any)
  if (isNaN(d.getTime())) return String(t)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

/** 帖子模型（post-list raw → WallCard） */
export interface WallCard {
  id: string
  author: string
  isAnonymous: boolean
  time: string
  content: string
  likes: number
  comments: number
  kind: string
}

export function adaptWall(raw: any): WallCard {
  return {
    id: raw._id || raw.id || String(Math.random()),
    // ⚠️ 后端字段以 post-create/index.js 的落库对象为准：userNickname / isAnonymous
    //    （旧代码写的 authorNickname / anonymous 后端从不写入 → 作者名恒为「匿名同学」）
    author: raw.userNickname || raw.nickname || raw.author || '匿名同学',
    isAnonymous: Boolean(raw.isAnonymous),
    time: fmtTime(raw.createdAt),
    content: raw.content || raw.text || '',
    likes: raw.likeCount ?? 0,
    comments: raw.commentCount ?? 0,
    kind: raw.kind || 'post'
  }
}

/** 商品模型（product-list raw → MarketCard） */
export interface MarketCard {
  id: string
  title: string
  price: string
  originalPrice?: string
  category: string
  image: string
  status: string
  schoolName: string
  time: string
}

export function adaptMarket(raw: any): MarketCard {
  return {
    id: raw._id || raw.id || String(Math.random()),
    title: raw.title || raw.name || '',
    price: raw.price != null ? String(raw.price) : '',
    originalPrice: raw.originalPrice != null ? String(raw.originalPrice) : undefined,
    category: raw.category || '',
    // products 文档存的是 images 数组（无 cover/image 字段），首图即封面
    image: raw.cover || raw.image || raw.images?.[0] || '',
    status: raw.status || 'on_sale',
    schoolName: raw.schoolName || '',
    time: fmtTime(raw.createdAt)
  }
}

/** 公告模型（announcement raw → AnnouncementCard） */
export interface AnnouncementCard {
  id: string
  title: string
  content: string
  pinned: boolean
  time: string
}

export function adaptAnnouncement(raw: any): AnnouncementCard {
  return {
    id: raw._id || raw.id || String(Math.random()),
    title: raw.title || '',
    content: raw.content || '',
    pinned: Boolean(raw.isPinned),
    time: fmtTime(raw.createdAt)
  }
}

/** 失物/招领模型（post-list kind=lost/found） */
export interface LostFoundCard {
  id: string
  kind: 'lost' | 'found'
  title: string
  content: string
  image: string
  time: string
  resolved: boolean
}

export function adaptLostFound(raw: any): LostFoundCard {
  return {
    id: raw._id || raw.id || String(Math.random()),
    kind: raw.kind === 'found' ? 'found' : 'lost',
    title: raw.title || '（无标题）',
    content: raw.content || '',
    image: raw.cover || raw.image || raw.images?.[0] || '',
    time: fmtTime(raw.createdAt),
    resolved: Boolean(raw.resolved)
  }
}

/** 帖子详情（post-detail → ok({post, isLiked, isCollected})） */
export interface PostDetail {
  id: string
  title: string
  content: string
  images: string[]
  kind: string
  author: string
  authorAvatar?: string
  isAnonymous: boolean
  time: string
  viewCount: number
  likeCount: number
  commentCount: number
  collectCount: number
  resolved: boolean
  isLiked: boolean
  isCollected: boolean
  status: string
}

export function adaptPostDetail(res: any): PostDetail {
  const p = res?.post ?? res?.data?.post ?? {}
  const images: string[] = []
  for (const src of p.images || p.imageList || []) {
    // 旧仓可能存 fileID / https / 本地 path，统一走 fileIDToTempUrl 调用方处理
    if (typeof src === 'string') images.push(src)
    else if (src && typeof src === 'object' && (src.fileID || src.url)) images.push(src.fileID || src.url)
  }
  return {
    id: p._id || p.id || '',
    title: p.title || '',
    content: p.content || p.text || '',
    images,
    kind: p.kind || 'post',
    // 同 adaptWall：后端落库字段是 userNickname / userAvatar / isAnonymous
    author: p.userNickname || p.nickname || p.author || '',
    authorAvatar: p.userAvatar || p.avatar || '',
    isAnonymous: Boolean(p.isAnonymous),
    time: fmtTime(p.createdAt),
    viewCount: p.viewCount ?? 0,
    likeCount: p.likeCount ?? 0,
    commentCount: p.commentCount ?? 0,
    collectCount: p.collectCount ?? 0,
    resolved: Boolean(p.resolved),
    isLiked: Boolean(res?.isLiked),
    isCollected: Boolean(res?.isCollected),
    status: p.status || 'normal'
  }
}

/** 商品详情（product-detail → ok({product, isCollected})） */
export interface ProductDetail {
  id: string
  title: string
  description: string
  images: string[]
  price: string
  originalPrice?: string
  category: string
  condition: string
  tradeType: string
  location: string
  contactInfo: string
  author: string
  time: string
  viewCount: number
  likeCount: number
  collectCount: number
  isCollected: boolean
  status: string
}

export function adaptProductDetail(res: any): ProductDetail {
  const p = res?.product ?? res?.data?.product ?? {}
  const images: string[] = []
  for (const src of p.images || p.imageList || []) {
    if (typeof src === 'string') images.push(src)
    else if (src && typeof src === 'object' && (src.fileID || src.url)) images.push(src.fileID || src.url)
  }
  return {
    id: p._id || p.id || '',
    title: p.title || p.name || '',
    description: p.description || p.content || '',
    images,
    price: p.price != null ? String(p.price) : '',
    originalPrice: p.originalPrice != null ? String(p.originalPrice) : undefined,
    category: p.category || 'other',
    condition: p.condition || 'good',
    tradeType: p.tradeType || 'face',
    location: p.location || '',
    contactInfo: p.contactInfo || '',
    // 后端 product-create 落库字段是 userNickname
    author: p.userNickname || p.nickname || p.author || '',
    time: fmtTime(p.createdAt),
    viewCount: p.viewCount ?? 0,
    likeCount: p.likeCount ?? 0,
    collectCount: p.collectCount ?? 0,
    isCollected: Boolean(res?.isCollected),
    status: p.status || 'on_sale'
  }
}

/** 我的内容模型（my-list type=posts/products/collects） */
export interface MyItem {
  id: string
  type: 'post' | 'product' | 'collect'
  title: string
  content: string
  image: string
  time: string
  kind: string
  /** 商品专属：on_sale / sold / off_shelf（帖子为空串）——「我的内容」标记已售二态按钮用 */
  status?: string
}

export function adaptMyItem(raw: any, type: 'posts' | 'products' | 'collects' = 'posts'): MyItem {
  const isCollect = type === 'collects'
  // collects 分支后端（my-list/index.js）返回的是 posts 与 products 文档的**混合数组**，
  // 不带类型标记 —— 只能靠「有没有 price 字段」区分，否则收藏项会全部跳错详情页。
  const resolvedType: MyItem['type'] = isCollect
    ? raw.price != null
      ? 'product'
      : 'post'
    : type === 'products'
      ? 'product'
      : 'post'
  return {
    id: raw._id || raw.id || String(Math.random()),
    type: resolvedType,
    title: raw.title || (raw.content ? raw.content.slice(0, 20) : ''),
    content: raw.content || raw.description || '',
    image: raw.cover || raw.image || raw.images?.[0] || '',
    time: fmtTime(raw.createdAt),
    kind: raw.kind || '',
    // 商品状态透传（posts 文档无 status 字段 → undefined 兜底空串）
    status: raw.status || ''
  }
}

/**
 * 用户主页模型
 * 后端契约（cloudfunctions/user-profile/index.js）：
 *   ok({ profile, isFollowing, posts }) —— 键名是 **profile**，不是 user；
 *   且后端**不返回 isSelf**（它只在服务端用于决定给完整版还是脱敏版 profile）。
 *   故 isSelf 由前端用当前登录用户 _id 与 profile._id 比对得出 → 调用方需传 currentUserId。
 */
export interface UserProfile {
  id: string
  nickname: string
  avatar: string
  bio: string
  college: string
  major: string
  grade: string
  gender: number
  tags: string[]
  followerCount: number
  followingCount: number
  isSelf: boolean
  isFollowing: boolean
  posts: any[]
}

export function adaptProfile(res: any, currentUserId = ''): UserProfile {
  const u = res?.profile ?? res?.data?.profile ?? res?.user ?? res?.data?.user ?? {}
  const id = u._id || u.id || ''
  return {
    id,
    nickname: u.nickname || '同学',
    avatar: u.avatar || '',
    bio: u.bio || '',
    college: u.college || '',
    major: u.major || '',
    grade: u.grade || '',
    gender: u.gender ?? 0,
    tags: u.tags || [],
    followerCount: u.followerCount ?? 0,
    followingCount: u.followingCount ?? 0,
    isSelf: Boolean(res?.isSelf) || (!!currentUserId && id === currentUserId),
    isFollowing: Boolean(res?.isFollowing),
    posts: res?.posts ?? res?.userPosts ?? []
  }
}

/** 指南模型（guide-list / guide-detail）
 *  ⚠️ guide-list 的 field 白名单是 title/summary/coverImage/categoryId/category/tags/viewCount/_id，
 *     **不含 createdAt** → 列表页不要渲染时间（time 会是空串）。 */
export interface GuideCard {
  id: string
  title: string
  summary: string
  coverImage: string
  category: string
  categoryId: string
  tags: string[]
  viewCount: number
  time: string
}

export function adaptGuide(raw: any): GuideCard {
  return {
    id: raw._id || raw.id || String(Math.random()),
    title: raw.title || '',
    summary: raw.summary || '',
    coverImage: raw.coverImage || '',
    category: raw.category || '',
    categoryId: raw.categoryId || '',
    tags: raw.tags || [],
    viewCount: raw.viewCount ?? 0,
    time: fmtTime(raw.createdAt || raw.updatedAt)
  }
}

/** 通知模型（notification → ok({list, unreadCount, hasMore})） */
export interface NoticeCard {
  id: string
  type: string
  targetType: string
  content: string
  isRead: boolean
  targetId: string
  time: string
}

export function adaptNotice(raw: any): NoticeCard {
  return {
    id: raw._id || raw.id || String(Math.random()),
    type: raw.type || '',
    targetType: raw.targetType || '',
    content: raw.content || '',
    isRead: Boolean(raw.isRead),
    targetId: raw.targetId || '',
    time: fmtTime(raw.createdAt)
  }
}

/** 搜索结果（search → ok({posts, products, guides}) 或 {hot}） */
export interface SearchHit {
  id: string
  type: 'post' | 'product'
  title: string
  content: string
  time: string
}

export function adaptSearchHit(raw: any, type: 'post' | 'product'): SearchHit {
  return {
    id: raw._id || raw.id || String(Math.random()),
    type,
    title: raw.title || '',
    content: raw.content || raw.description || '',
    time: fmtTime(raw.createdAt)
  }
}

/**
 * 只拉公告（首页顶栏用）。
 * ⚠️ 不要用「一次性拉 feed + 公告」的组合器：首页的列表由 z-paging 的 @query 负责，
 *    组合器会再发一次 post-list，造成首屏双请求且第一次结果被丢弃。
 * 契约：announcement action=list → ok({ list })，最多 5 条 active，置顶优先。
 */
export async function loadAnnouncements(): Promise<AnnouncementCard[]> {
  const res: any = await callFunction('announcement', { action: 'list' })
  const list = Array.isArray(res) ? res : (res?.list ?? [])
  return list.map(adaptAnnouncement)
}
