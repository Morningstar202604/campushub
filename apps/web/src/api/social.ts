import { supabase } from '@/lib/supabase'
import { USE_MOCK } from '@/lib/mock'
import { mockIsLiked, mockToggleLike, mockIsCollected, mockToggleCollect, mockIsFollowing, mockToggleFollow } from '@/mock/api'

/** 点赞/取消赞（likes 表唯一约束天然幂等，数据库触发器维护计数） */
export async function toggleLike(targetType: 'post' | 'product' | 'comment', targetId: string, liked: boolean) {
  if (USE_MOCK) return mockToggleLike(targetType, targetId, liked)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('请先登录')
  if (liked) {
    const { error } = await supabase.from('likes').delete()
      .match({ user_id: user.id, target_type: targetType, target_id: targetId })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('likes').insert({ user_id: user.id, target_type: targetType, target_id: targetId })
    if (error) throw new Error(error.message)
  }
}

export async function isLiked(targetType: 'post' | 'product' | 'comment', targetId: string): Promise<boolean> {
  if (USE_MOCK) return mockIsLiked(targetType, targetId)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('likes').select('id')
    .match({ user_id: user.id, target_type: targetType, target_id: targetId })
    .maybeSingle()
  return !!data
}

export async function toggleCollect(targetType: 'post' | 'product', targetId: string, collected: boolean) {
  if (USE_MOCK) return mockToggleCollect(targetType, targetId, collected)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('请先登录')
  if (collected) {
    const { error } = await supabase.from('collects').delete()
      .match({ user_id: user.id, target_type: targetType, target_id: targetId })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('collects').insert({ user_id: user.id, target_type: targetType, target_id: targetId })
    if (error) throw new Error(error.message)
  }
}

export async function isCollected(targetType: 'post' | 'product', targetId: string): Promise<boolean> {
  if (USE_MOCK) return mockIsCollected(targetType, targetId)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('collects').select('id')
    .match({ user_id: user.id, target_type: targetType, target_id: targetId })
    .maybeSingle()
  return !!data
}

export async function toggleFollow(followingId: string, following: boolean) {
  if (USE_MOCK) return mockToggleFollow(followingId, following)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('请先登录')
  if (user.id === followingId) throw new Error('不能关注自己')
  if (following) {
    const { error } = await supabase.from('follows').delete()
      .match({ follower_id: user.id, following_id: followingId })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: followingId })
    if (error) throw new Error(error.message)
  }
}

export async function isFollowing(followingId: string): Promise<boolean> {
  if (USE_MOCK) return mockIsFollowing(followingId)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('follows').select('id')
    .match({ follower_id: user.id, following_id: followingId })
    .maybeSingle()
  return !!data
}

export async function followerCount(userId: string): Promise<number> {
  if (USE_MOCK) return 0
  const { count } = await supabase.from('follows').select('id', { count: 'exact', head: true })
    .eq('following_id', userId)
  return count ?? 0
}
