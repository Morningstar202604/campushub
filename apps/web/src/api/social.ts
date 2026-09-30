import { http, hasToken } from '@/lib/http'

const TARGET_PREFIX: Record<string, string> = {
  post: 'posts',
  product: 'products'
}

// 互动防重：同一目标的请求在途时忽略重复触发（前端节流，后端幂等兜底）
const pending = new Set<string>()
function mark(key: string): boolean {
  if (pending.has(key)) return false
  pending.add(key)
  return true
}
function release(key: string) {
  pending.delete(key)
}

/** 点赞/取消赞（服务端唯一约束幂等，事务维护计数） */
export async function toggleLike(targetType: 'post' | 'product' | 'comment', targetId: string, liked: boolean) {
  const key = `like:${targetType}:${targetId}`
  if (!mark(key)) return
  try {
    const prefix = TARGET_PREFIX[targetType] ?? targetType + 's'
    if (liked) {
      await http.del(`/${prefix}/${targetId}/like`)
    } else {
      await http.post(`/${prefix}/${targetId}/like`)
    }
  } finally {
    release(key)
  }
}

export async function isLiked(targetType: 'post' | 'product' | 'comment', targetId: string): Promise<boolean> {
  if (!hasToken()) return false
  const data = await http.get<any>(`/interactions/status?targetType=${targetType}&targetId=${targetId}`)
  return data.liked
}

/** 收藏/取消收藏 */
export async function toggleCollect(targetType: 'post' | 'product', targetId: string, collected: boolean) {
  const key = `collect:${targetType}:${targetId}`
  if (!mark(key)) return
  try {
    const prefix = TARGET_PREFIX[targetType]
    if (collected) {
      await http.del(`/${prefix}/${targetId}/collect`)
    } else {
      await http.post(`/${prefix}/${targetId}/collect`)
    }
  } finally {
    release(key)
  }
}

export async function isCollected(targetType: 'post' | 'product', targetId: string): Promise<boolean> {
  if (!hasToken()) return false
  const data = await http.get<any>(`/interactions/status?targetType=${targetType}&targetId=${targetId}`)
  return data.collected
}

/** 关注/取消关注（不能关注自己由后端校验） */
export async function toggleFollow(followingId: string, following: boolean) {
  const key = `follow:${followingId}`
  if (!mark(key)) return
  try {
    if (following) {
      await http.del('/interactions/follow', { followingId })
    } else {
      await http.post('/interactions/follow', { followingId })
    }
  } finally {
    release(key)
  }
}

export async function isFollowing(followingId: string): Promise<boolean> {
  if (!hasToken()) return false
  const data = await http.get<any>(`/interactions/following?userId=${followingId}`)
  return data.following
}

export async function followerCount(userId: string): Promise<number> {
  const data = await http.get<any>(`/users/${userId}/follower-count`)
  return data.count ?? 0
}
