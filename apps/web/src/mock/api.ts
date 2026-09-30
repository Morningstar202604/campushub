/**
 * Mock API：与 src/api/* 的函数签名一一对应，内存模拟真实 Supabase 行为
 */
import { mock, phImg, CATEGORIES, GUIDE_CATS, GUIDES, ANNOUNCEMENTS, PROFILES, persist } from './data'
import type { Post, Product, Comment, Guide, GuideCategory, Notification, Category, Announcement } from '@/types'

const { state } = mock

function toPost(row: any): Post {
  return { ...row, author: mock.authorOf(row.author_id), collect_count: row.collect_count ?? 0 }
}
function toProduct(row: any): Product {
  return { ...row, seller: mock.authorOf(row.seller_id) }
}
function toComment(row: any): Comment {
  return { ...row, user: mock.authorOf(row.user_id) }
}
function visiblePosts() {
  return state.posts.filter(p => p.status === 'normal')
}
function visibleProducts() {
  return state.products.filter(p => p.status === 'on_sale')
}

// ---------- 帖子 ----------
export const mockFeedPosts = async (f: any = {}) => {
  const page = f.page ?? 1
  const pageSize = Math.min(30, f.pageSize ?? 20)
  let list = visiblePosts()
  if (f.categoryId) list = list.filter(p => p.category_id === f.categoryId)
  if (f.kind) list = list.filter(p => p.kind === f.kind)
  // 排除过期未解决的任务帖
  list = list.filter(p => p.kind !== 'task' || p.resolved || (p.expire_at && new Date(p.expire_at) > new Date()))
  if (f.tab === 'hot') list = [...list].sort((a, b) => (b.like_count + b.comment_count) - (a.like_count + a.comment_count))
  else if (f.tab === 'latest') list = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))
  else list = [...list].sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.created_at.localeCompare(a.created_at))
  const total = list.length
  const slice = list.slice((page - 1) * pageSize, page * pageSize).map(toPost)
  return { list: slice, hasMore: (page - 1) * pageSize + slice.length < total }
}

export const mockPostById = async (id: string) => {
  const p = state.posts.find(x => x.id === id && x.status !== 'deleted')
  return p ? toPost(p) : null
}

export const mockListComments = async (targetType: string, targetId: string) => {
  return state.comments
    .filter(c => c.target_type === targetType && c.target_id === targetId && c.status === 'normal')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(toComment)
}

export const mockAddComment = async (targetType: string, targetId: string, content: string, parentId?: string) => {
  state.comments.push({
    id: mock.newCommentId(),
    target_type: targetType,
    target_id: targetId,
    user_id: 'mock-me',
    parent_id: parentId ?? null,
    reply_to_user_id: parentId ? state.comments.find(c => c.id === parentId)?.user_id ?? null : null,
    content,
    status: 'normal',
    like_count: 0,
    created_at: new Date().toISOString()
  })
  const target = state.posts.find(p => p.id === targetId) || state.products.find(p => p.id === targetId)
  if (target) target.comment_count += 1
  persist()
}

export const mockSoftDeleteComment = async (id: string) => {
  const c = state.comments.find(x => x.id === id)
  if (c) c.status = 'deleted'
  persist()

}

export const mockCreatePost = async (input: any) => {
  const post = {
    id: mock.newPostId(),
    author_id: 'mock-me',
    category_id: input.category_id || 'cat_chat',
    kind: input.kind || 'post',
    title: input.title,
    content: input.content,
    images: input.images || [],
    tags: input.tags || [],
    location: input.location || '',
    is_anonymous: !!input.is_anonymous,
    resolved: false,
    is_pinned: false,
    is_essence: false,
    like_count: 0,
    comment_count: 0,
    view_count: 0,
    status: 'normal',
    expire_at: input.kind === 'task' ? new Date(Date.now() + 7 * 86400000).toISOString() : null,
    created_at: new Date().toISOString()
  }
  state.posts.unshift(post)
  persist()
  return { id: post.id }
}

export const mockSoftDeletePost = async (id: string) => {
  const p = state.posts.find(x => x.id === id)
  if (p) p.status = 'deleted'
  persist()

}

export const mockMarkResolved = async (id: string, resolved: boolean) => {
  const p = state.posts.find(x => x.id === id)
  if (p) p.resolved = resolved
  persist()

}

// ---------- 商品 ----------
export const mockMarketProducts = async (f: any = {}) => {
  const page = f.page ?? 1
  const pageSize = Math.min(30, f.pageSize ?? 20)
  let list = visibleProducts()
  if (f.categoryId) list = list.filter(p => p.category_id === f.categoryId)
  list = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const total = list.length
  const slice = list.slice((page - 1) * pageSize, page * pageSize).map(toProduct)
  return { list: slice, hasMore: (page - 1) * pageSize + slice.length < total }
}

export const mockProductById = async (id: string) => {
  const p = state.products.find(x => x.id === id && x.status !== 'deleted')
  return p ? toProduct(p) : null
}

export const mockCreateProduct = async (input: any) => {
  const product = {
    id: mock.newProductId(),
    seller_id: 'mock-me',
    category_id: input.category_id || 'cat_idle',
    title: input.title,
    description: input.description || '',
    images: input.images || [],
    price: Number(input.price) || 0,
    original_price: input.original_price ? Number(input.original_price) : null,
    condition: input.condition || '',
    trade_type: input.trade_type || '面交',
    location: input.location || '',
    contact_info: input.contact_info || '',
    status: 'on_sale',
    like_count: 0,
    collect_count: 0,
    comment_count: 0,
    view_count: 0,
    created_at: new Date().toISOString()
  }
  state.products.unshift(product)
  persist()
  return { id: product.id }
}

export const mockUpdateProductStatus = async (id: string, status: string) => {
  const p = state.products.find(x => x.id === id)
  if (p) p.status = status
  persist()

}

export const mockSoftDeleteProduct = async (id: string) => {
  const p = state.products.find(x => x.id === id)
  if (p) p.status = 'deleted'
  persist()

}

// ---------- 社交（点赞/收藏/关注） ----------
export const mockIsLiked = async (type: string, id: string) => state.likes.has(`${type}:${id}`)
export const mockToggleLike = async (type: string, id: string, cur: boolean) => {
  const key = `${type}:${id}`
  if (cur) state.likes.delete(key)
  else state.likes.add(key)
  const target = state.posts.find(p => p.id === id) || state.products.find(p => p.id === id)
  if (target) target.like_count = Math.max(0, target.like_count + (cur ? -1 : 1))
  persist()

}
export const mockIsCollected = async (type: string, id: string) => state.collects.has(`${type}:${id}`)
export const mockToggleCollect = async (type: string, id: string, cur: boolean) => {
  const key = `${type}:${id}`
  if (cur) state.collects.delete(key)
  else state.collects.add(key)
  const target = state.posts.find(p => p.id === id) || state.products.find(p => p.id === id)
  if (target) target.collect_count = Math.max(0, (target.collect_count ?? 0) + (cur ? -1 : 1))
  persist()

}
export const mockIsFollowing = async (uid: string) => state.follows.has(uid)
export const mockToggleFollow = async (uid: string, cur: boolean) => {
  if (cur) state.follows.delete(uid)
  else state.follows.add(uid)
  persist()

}

// ---------- 搜索 ----------
export const mockSearchPosts = async (kw: string) =>
  visiblePosts()
    .filter(p => (p.title + p.content).toLowerCase().includes(kw.toLowerCase()))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(toPost)

export const mockSearchProducts = async (kw: string) =>
  visibleProducts()
    .filter(p => (p.title + p.description).toLowerCase().includes(kw.toLowerCase()))
    .map(toProduct)

// ---------- 我的列表 ----------
export const mockMyPosts = async () =>
  state.posts
    .filter(p => p.author_id === 'mock-me' && p.status !== 'deleted')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(toPost)

export const mockMyProducts = async () =>
  state.products
    .filter(p => p.seller_id === 'mock-me' && p.status !== 'deleted')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(toProduct)

export const mockMyCollects = async (): Promise<(Post | Product)[]> => {
  const keys = [...state.collects]
  const out: (Post | Product)[] = []
  for (const key of keys) {
    const [type, id] = key.split(':')
    if (type === 'post') {
      const p = state.posts.find(x => x.id === id && x.status !== 'deleted')
      if (p) out.push(toPost(p))
    } else {
      const p = state.products.find(x => x.id === id && x.status !== 'deleted')
      if (p) out.push(toProduct(p))
    }
  }
  return out
}

// ---------- 签到 ----------
export const mockDoCheckin = async () => {
  const today = new Date().toISOString().slice(0, 10)
  if (state.checkins.some(c => c.date === today)) throw new Error('今天已经签到过了，明天再来吧')
  const last = state.checkins[state.checkins.length - 1]
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const streak = last && last.date === yesterday ? last.streak + 1 : 1
  const points = streak % 7 === 0 ? 5 : 1
  state.checkins.push({ date: today, streak, points })
  mock.me.checkin_streak = streak
  mock.me.points += points
  persist()
  return { streak, points }
}

export const mockMyCheckins = async () => state.checkins

// ---------- 消息 ----------
export const mockMyNotifications = async () =>
  state.notifications.filter(n => n.user_id === 'mock-me')

export const mockMarkAllRead = async () => {
  state.notifications.forEach(n => { n.is_read = true })
  persist()

}

// ---------- 举报 / 反馈 ----------
export const mockSubmitReport = async (targetType: string, targetId: string, reason: string, detail = '') => {
  state.reports.push({ target_type: targetType, target_id: targetId, reason, detail, created_at: new Date().toISOString() })
}

export const mockSubmitFeedback = async (content: string, contact = '') => {
  state.feedbacks.push({ content, contact, created_at: new Date().toISOString() })
}

// ---------- 指南 / 分类 / 公告 ----------
export const mockGuideCategories = async (): Promise<GuideCategory[]> => GUIDE_CATS as any

export const mockGuides = async (catId?: string): Promise<Guide[]> => {
  let list = GUIDES as any[]
  if (catId) list = list.filter(g => g.category_id === catId)
  return list.map(g => ({ ...g, tags: g.tags }))
}

export const mockGuideById = async (id: string): Promise<Guide | null> => {
  return (GUIDES as any[]).find(g => g.id === id) ?? null
}

export const mockCategories = async (): Promise<Category[]> => CATEGORIES as any

export const mockAnnouncements = async (): Promise<Announcement[]> =>
  (ANNOUNCEMENTS as any[]).filter(a => a.is_active)

// ---------- 上传（返回本地占位图） ----------
export const mockUploadImages = async (files: File[]): Promise<string[]> => {
  return files.map((_, i) => phImg(i, '上传成功'))
}

// ============================================================
// URL 分发器：http 层统一拦截（mock 模式），业务代码零污染
// 返回结构与真实后端 REST 一致
// ============================================================

function parsePath(path: string) {
  const q = path.indexOf('?')
  const pathname = q >= 0 ? path.slice(0, q) : path
  const params: Record<string, string> = {}
  if (q >= 0) {
    for (const [k, v] of new URLSearchParams(path.slice(q + 1))) params[k] = v
  }
  return { pathname, params }
}

/** camelCase body → mock 内部 snake_case */
function toSnake(o: any): any {
  const out: Record<string, any> = {}
  for (const k of Object.keys(o ?? {})) {
    const sk = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
    out[sk] = o[k]
  }
  return out
}

function idOf(pathname: string, seg = 2): string {
  return pathname.split('/')[seg]
}

const delay = () => new Promise((r) => setTimeout(r, 60))

/** mock profile（snake_case）→ 后端风格 camelCase，兼容前端 toProfile */
function toCamelProfile(p: any) {
  return {
    id: p.id, nickname: p.nickname, avatar: p.avatar, bio: p.bio ?? '',
    college: p.college ?? '', major: p.major ?? '', grade: p.grade ?? '',
    gender: p.gender ?? 0, tags: p.tags ?? [], points: p.points ?? 0,
    checkinStreak: p.checkin_streak ?? 0, lastCheckinDate: p.last_checkin_date ?? null,
    isAdmin: p.is_admin ?? false, isBanned: p.is_banned ?? false,
    createdAt: p.created_at ?? new Date().toISOString(),
  }
}

export async function mockFetch(method: string, path: string, body?: any, formData?: FormData): Promise<any> {
  await delay()
  const { pathname, params } = parsePath(path)
  const m = method.toUpperCase()

  // ---- auth ----
  if (m === 'POST' && pathname === '/auth/login') {
    return { accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token', user: { id: 'mock-me', nickname: mock.me.nickname, avatar: mock.me.avatar, isAdmin: mock.me.is_admin } }
  }
  if (m === 'POST' && pathname === '/auth/register') {
    if (body?.nickname) mock.me.nickname = body.nickname
    return { accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token', user: { id: 'mock-me', nickname: mock.me.nickname, avatar: mock.me.avatar, isAdmin: mock.me.is_admin } }
  }
  if (m === 'GET' && pathname === '/auth/me') return toCamelProfile(mock.me)
  if (m === 'PATCH' && pathname === '/auth/me') {
    Object.assign(mock.me, toSnake(body ?? {}))
    persist()
    return toCamelProfile(mock.me)
  }
  if (m === 'POST' && pathname === '/auth/logout') return { ok: true }
  if (m === 'POST' && pathname === '/auth/refresh') {
    return { accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token' }
  }

  // ---- 分类 / 公告 ----
  if (m === 'GET' && pathname === '/categories') return CATEGORIES
  if (m === 'GET' && pathname === '/announcements') return ANNOUNCEMENTS.filter((a: any) => a.is_active)

  // ---- 帖子 ----
  if (m === 'GET' && pathname === '/posts/me') return mockMyPosts()
  if (m === 'GET' && /^\/posts\/[^/]+\/comments$/.test(pathname)) return mockListComments('post', idOf(pathname))
  if (m === 'POST' && /^\/posts\/[^/]+\/comments$/.test(pathname)) {
    await mockAddComment('post', idOf(pathname), body?.content, body?.parentId)
    return mockListComments('post', idOf(pathname))
  }
  if (m === 'GET' && pathname === '/posts') {
    return mockFeedPosts({
      categoryId: params.categoryId,
      kind: params.kind,
      tab: params.tab,
      page: Number(params.page || 1),
      pageSize: Number(params.pageSize || 20),
    })
  }
  if (m === 'GET' && /^\/posts\/[^/]+$/.test(pathname)) return mockPostById(idOf(pathname))
  if (m === 'POST' && pathname === '/posts') {
    const r = await mockCreatePost(toSnake(body))
    return { id: r.id }
  }
  if (m === 'DELETE' && /^\/posts\/[^/]+$/.test(pathname)) {
    await mockSoftDeletePost(idOf(pathname))
    return { ok: true }
  }
  if (m === 'PATCH' && /^\/posts\/[^/]+\/resolved$/.test(pathname)) {
    await mockMarkResolved(idOf(pathname), body?.resolved)
    return { ok: true }
  }

  // ---- 商品 ----
  if (m === 'GET' && pathname === '/products/me') return mockMyProducts()
  if (m === 'GET' && /^\/products\/[^/]+\/comments$/.test(pathname)) return mockListComments('product', idOf(pathname))
  if (m === 'POST' && /^\/products\/[^/]+\/comments$/.test(pathname)) {
    await mockAddComment('product', idOf(pathname), body?.content, body?.parentId)
    return mockListComments('product', idOf(pathname))
  }
  if (m === 'GET' && pathname === '/products') {
    return mockMarketProducts({
      categoryId: params.categoryId,
      page: Number(params.page || 1),
      pageSize: Number(params.pageSize || 20),
    })
  }
  if (m === 'GET' && /^\/products\/[^/]+$/.test(pathname)) return mockProductById(idOf(pathname))
  if (m === 'POST' && pathname === '/products') {
    const r = await mockCreateProduct(toSnake(body))
    return { id: r.id }
  }
  if (m === 'PATCH' && /^\/products\/[^/]+\/status$/.test(pathname)) {
    await mockUpdateProductStatus(idOf(pathname), body?.status)
    return { ok: true }
  }
  if (m === 'DELETE' && /^\/products\/[^/]+$/.test(pathname)) {
    await mockSoftDeleteProduct(idOf(pathname))
    return { ok: true }
  }
  if (m === 'POST' && /^\/products\/[^/]+\/report$/.test(pathname)) {
    await mockSubmitReport('product', idOf(pathname), body?.reason, body?.detail)
    return { ok: true }
  }

  // ---- 点赞 / 收藏 / 关注 ----
  const likeMatch = pathname.match(/^\/(posts|products|comments)\/([^/]+)\/(like|collect)$/)
  if (likeMatch) {
    const [, type, tid, act] = likeMatch
    const singular = type.replace(/s$/, '')
    const cur = m === 'DELETE'
    if (act === 'like') {
      if (cur) await mockToggleLike(singular, tid, true)
      else await mockToggleLike(singular, tid, false)
      return { ok: true }
    }
    if (cur) await mockToggleCollect(singular, tid, true)
    else await mockToggleCollect(singular, tid, false)
    return { ok: true }
  }
  if (m === 'GET' && pathname === '/interactions/status') {
    const type = params.targetType
    const tid = params.targetId
    return {
      liked: await mockIsLiked(type, tid),
      collected: await mockIsCollected(type, tid),
    }
  }
  if (m === 'POST' && pathname === '/interactions/follow') {
    await mockToggleFollow(body?.followingId, false)
    return { ok: true }
  }
  if (m === 'DELETE' && pathname === '/interactions/follow') {
    await mockToggleFollow(body?.followingId, true)
    return { ok: true }
  }
  if (m === 'GET' && pathname === '/interactions/following') {
    return { following: await mockIsFollowing(params.userId) }
  }
  if (m === 'GET' && /^\/users\/[^/]+\/follower-count$/.test(pathname)) {
    return { count: 0 }
  }

  // ---- 我的收藏（混合） ----
  if (m === 'GET' && pathname === '/me/collects') {
    const items = await mockMyCollects()
    return {
      list: items.map((c: any) => ({
        targetType: 'kind' in c ? 'post' : 'product',
        target: c,
      })),
      total: items.length,
      hasMore: false,
    }
  }

  // ---- 签到 ----
  if (m === 'POST' && pathname === '/checkins') {
    const r = await mockDoCheckin()
    const last = state.checkins[state.checkins.length - 1]
    return { date: last?.date ?? '', ...r }
  }
  if (m === 'GET' && pathname === '/checkins') return mockMyCheckins()

  // ---- 消息 ----
  if (m === 'GET' && pathname === '/notifications') return mockMyNotifications()
  if (m === 'PATCH' && pathname === '/notifications/read-all') {
    await mockMarkAllRead()
    return { ok: true }
  }
  if (m === 'GET' && pathname === '/notifications/unread-count') return { count: 0 }

  // ---- 指南 ----
  if (m === 'GET' && pathname === '/guides/categories') return mockGuideCategories()
  if (m === 'GET' && pathname === '/guides') return mockGuides(params.categoryId)
  if (m === 'GET' && /^\/guides\/[^/]+$/.test(pathname)) return mockGuideById(idOf(pathname))

  // ---- 举报 / 反馈 ----
  if (m === 'POST' && /^\/posts\/[^/]+\/report$/.test(pathname)) {
    await mockSubmitReport('post', idOf(pathname), body?.reason, body?.detail)
    return { ok: true }
  }
  if (m === 'POST' && pathname === '/feedbacks') {
    await mockSubmitFeedback(body?.content, body?.contact)
    return { ok: true }
  }

  // ---- 搜索 ----
  if (m === 'GET' && pathname === '/search') {
    const kw = params.keyword || ''
    if (params.tab === 'product') return { products: await mockSearchProducts(kw) }
    return { posts: await mockSearchPosts(kw) }
  }

  // ---- 上传 ----
  if (m === 'POST' && pathname === '/upload/images') {
    const files = formData ? (formData.getAll('files') as File[]) : []
    return { urls: await mockUploadImages(files) }
  }

  throw new Error(`mock 未实现该请求：${m} ${pathname}`)
}
