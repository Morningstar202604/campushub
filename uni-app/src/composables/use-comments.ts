// 评论组合器：楼层 + 楼中楼 + 点赞 + 删除，详情页复用
// 后端契约（../campushub/cloudfunctions/comment-list|comment-create|comment-delete|like）：
//   comment-list   楼层按时间正序，list[] 每楼层含 replies[]（子回复），并回填 liked
//   comment-create { targetId, targetType, content, parentId?, replyToUserId?, replyToNickname? }
//   comment-delete { commentId }（主楼层级联软删子回复）
//
// 入参为什么支持 ref / getter：
//   详情页必须在 setup 顶层就能创建本组合器（模板要立刻拿到 floors 等响应式量），
//   但 targetId 要等 onLoad(options) 之后才知道。旧签名只收 string，页面只能传一个当时的
//   空串或 Ref 对象——前者永远查不到评论，后者会被原样塞进请求体（后端报「缺少目标ID」）。
//   现在统一支持 string | Ref<string> | (() => string)，与 useAction 的入参风格一致。
import { ref, isRef, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { callFunction } from '@/utils/api'
import { useUserStore } from '../stores/user'

export interface CommentNode {
  _id: string
  userNickname: string
  userAvatar?: string
  content: string
  createdAt: unknown
  liked?: boolean
  likeCount?: number
  parentId?: string | null
  replyToNickname?: string
  replies?: CommentNode[]
  userId?: string
}

/** 惰性取值：字符串 / ref / getter 皆可 */
type Source<T> = T | Ref<T> | (() => T)

function resolveSource<T>(v: Source<T>, fallback: T): T {
  if (typeof v === 'function') return ((v as () => T)() ?? fallback) as T
  if (v && isRef(v)) return ((v as Ref<T>).value ?? fallback) as T
  return (v ?? fallback) as T
}

export interface UseCommentsOptions {
  targetId: Source<string>
  targetType?: Source<'post' | 'product'>
}

export function useComments(opts: UseCommentsOptions) {
  const floors = ref<CommentNode[]>([])
  const loading = ref(false)
  const error = ref('')
  const draft = ref('')

  // 获取当前用户（用于乐观插入）
  const userStore = useUserStore()
  const { userInfo: currentUser } = storeToRefs(userStore)

  async function loadAll() {
    const targetId = resolveSource(opts.targetId, '')
    // 目标还没就绪（详情页首帧、id 缺失）→ 不发无效请求，直接清空
    if (!targetId) {
      floors.value = []
      return
    }
    const targetType = resolveSource(opts.targetType as Source<'post' | 'product'>, 'post')
    loading.value = true
    error.value = ''
    try {
      // 不分页一次性拉全量（详情页评论量小；后端单页上限 50，hasMore 兜底再续拉）
      const res: any = await callFunction('comment-list', {
        targetId,
        targetType,
        page: 1,
        pageSize: 50
      })
      floors.value = res?.list ?? []
    } catch (e: any) {
      error.value = e?.message || String(e)
      console.error('[useComments.load]', error.value)
    } finally {
      loading.value = false
    }
  }

  async function submit(parentId?: string, replyTo?: { userId: string; nickname: string }) {
    const content = draft.value.trim()
    if (!content) return
    if (content.length > 500) {
      error.value = '评论不能超过500字'
      return
    }
    const targetId = resolveSource(opts.targetId, '')
    if (!targetId) {
      error.value = '内容还未加载完成，请稍后再试'
      return
    }
    const targetType = resolveSource(opts.targetType as Source<'post' | 'product'>, 'post')
    loading.value = true
    error.value = ''
    try {
      const res: any = await callFunction('comment-create', {
        targetId,
        targetType,
        content,
        parentId: parentId || undefined,
        replyToUserId: replyTo?.userId,
        replyToNickname: replyTo?.nickname
      })
      draft.value = ''
      // 乐观插入：将新评论 push 到列表头部
      floors.value.unshift({
        _id: res?._id || `temp-${Date.now()}`,
        userNickname: currentUser.value?.nickname || '我',
        userAvatar: currentUser.value?.avatar || '',
        content,
        createdAt: Date.now(),
        liked: false,
        likeCount: 0,
        userId: currentUser.value?._id || '',
        parentId: parentId || null,
        replyToNickname: replyTo?.nickname,
        replies: []
      })
      uni.showToast({ title: '评论成功', icon: 'none', duration: 2000 })
    } catch (e: any) {
      error.value = e?.message || String(e)
      uni.showToast({ title: '评论失败', icon: 'none', duration: 2000 })
      console.error('[useComments.submit]', error.value)
    } finally {
      loading.value = false
    }
  }

  async function remove(commentId: string) {
    try {
      await callFunction('comment-delete', { commentId })
      // 局部删除：从 list 中找到并 splice 移除
      const index = floors.value.findIndex(f => f._id === commentId)
      if (index !== -1) {
        floors.value.splice(index, 1)
      }
      uni.showToast({ title: '已删除', icon: 'none', duration: 2000 })
    } catch (e: any) {
      error.value = e?.message || String(e)
      uni.showToast({ title: '删除失败', icon: 'none', duration: 2000 })
      console.error('[useComments.remove]', error.value)
    }
  }

  async function toggleLikeComment(node: CommentNode) {
    const originalLiked = node.liked
    const originalLikeCount = node.likeCount
    try {
      const action = node.liked ? 'unlike' : 'like'
      await callFunction('like', { targetId: node._id, type: 'comment', action })
      node.liked = action === 'like'
      node.likeCount = (node.likeCount ?? 0) + (action === 'like' ? 1 : -1)
    } catch (e: any) {
      // 失败时 revert 本地状态
      node.liked = originalLiked
      node.likeCount = originalLikeCount
      uni.showToast({ title: '操作失败，请重试', icon: 'none', duration: 2000 })
      console.error('[useComments.toggleLike]', e?.message || e)
    }
  }

  return { floors, loading, error, draft, loadAll, submit, remove, toggleLikeComment }
}
