// 互动操作组合器：把 like / collect / comment / resolve 四类写操作封装为响应式 API
// 详情页、列表页共用，避免每页重复拼 callFunction
//
// 后端契约（详见 ../campushub/cloudfunctions/{like,collect,comment-create,comment-list,resolve}/index.js）：
//   like        : callFunction('like',       { targetId, type: 'post'|'product'|'comment', action: 'like'|'unlike' })
//   collect     : callFunction('collect',    { targetId, type: 'post'|'product', action: 'collect'|'uncollect' })
//   comment-list: callFunction('comment-list', { targetId, targetType: 'post'|'product', page, pageSize }) → ok({ list, hasMore })
//                 （list 中每条楼层含 replies 数组，且回填 liked）
//   comment-create: callFunction('comment-create', { targetId, targetType, content, parentId?, replyToUserId?, replyToNickname? })
//   comment-delete: callFunction('comment-delete', { commentId })
//   resolve     : callFunction('resolve',      { postId })（仅 task/lost/found + 作者/管理员）
import { ref, type Ref } from 'vue'
import { callFunction } from '@/utils/api'

export type TargetType = 'post' | 'product' | 'comment'

export interface UseActionOptions {
  targetId: string | Ref<string>
  targetType: TargetType | Ref<TargetType>
}

export function useAction(opts: UseActionOptions) {
  const liked = ref(false)
  const likeCount = ref(0)
  const collected = ref(false)
  const loading = ref(false)

  function getId(): string {
    const v: any = opts.targetId
    return typeof v === 'string' ? v : v?.value ?? ''
  }
  function getType(): TargetType {
    const v: any = opts.targetType
    return (typeof v === 'string' ? v : v?.value) || 'post'
  }

  /** 点赞 / 取消点赞（后端幂等，重复 like 不会重复计数） */
  async function toggleLike() {
    if (loading.value) return
    loading.value = true
    const id = getId()
    const type: TargetType = getType()
    try {
      const action = liked.value ? 'unlike' : 'like'
      const res: any = await callFunction('like', { targetId: id, type, action })
      // 后端：like 成功 → { liked: true }；unlike 成功 → { liked: false, removed: n }
      liked.value = action === 'like'
      likeCount.value += action === 'like' ? 1 : -1
      if (res?.already && action === 'like') {
        // 已点过则计数不动
        likeCount.value = Math.max(0, likeCount.value - 1)
      }
    } catch (e: any) {
      console.error('[useAction.like]', e?.message || e)
      // 失败不更新本地态
    } finally {
      loading.value = false
    }
  }

  /** 收藏 / 取消收藏 */
  async function toggleCollect() {
    if (loading.value) return
    loading.value = true
    const id = getId()
    const type = getType()
    try {
      const action = collected.value ? 'uncollect' : 'collect'
      await callFunction('collect', { targetId: id, type, action })
      collected.value = action === 'collect'
    } catch (e: any) {
      console.error('[useAction.collect]', e?.message || e)
    } finally {
      loading.value = false
    }
  }

  /** 标记已解决（任务/失物/招领） */
  async function resolvePost() {
    if (loading.value) return
    loading.value = true
    try {
      const res: any = await callFunction('resolve', { postId: getId() })
      return Boolean(res?.resolved)
    } catch (e: any) {
      console.error('[useAction.resolve]', e?.message || e)
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    liked,
    likeCount,
    collected,
    loading,
    toggleLike,
    toggleCollect,
    resolvePost,
    /** 初始化外部已知状态（详情页拉到 isLiked/isCollected 后回填） */
    hydrate({ isLiked = false, isCollected = false, likeCount: c = 0 }) {
      liked.value = isLiked
      collected.value = isCollected
      likeCount.value = c
    }
  }
}
