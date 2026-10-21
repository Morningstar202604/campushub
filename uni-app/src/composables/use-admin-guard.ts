/**
 * 管理台页面的前端守卫（体验层）。
 *
 * 为什么不能直接读 userStore.userInfo.role：
 *   ① role 是服务端权威字段，persist 时被 omit —— 本地缓存里没有它；
 *   ② App.vue 的 restore() 是异步的（一次 login 云函数往返），页面 onLoad 通常早于它完成。
 * 因此冷启动/刷新/深链直接进管理页时，userInfo.role 恒为 undefined，
 * 直接判定会把真正的管理员也误踢回上一页。这里先确保登录态已刷新再判定。
 *
 * 说明：这只是体验层拦截，真正的权限由后端 checkAdmin(openid) 强制，前端判断不可信也无所谓。
 */
import { useUserStore } from '@/stores/user'

export async function ensureAdmin(): Promise<boolean> {
  const userStore = useUserStore()
  if (!userStore.userInfo?.role) {
    await userStore.restore().catch(() => {})
  }
  if (userStore.userInfo?.role === 'admin') return true

  uni.showToast({ title: '无管理权限', icon: 'none' })
  setTimeout(() => {
    uni.navigateBack({ delta: 1 })
  }, 1200)
  return false
}
