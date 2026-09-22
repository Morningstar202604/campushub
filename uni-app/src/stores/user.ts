import { defineStore } from 'pinia'
import { callFunction } from '@/utils/api'

/**
 * 登录态 Store（P1：真实接入 cloud function `login`）
 *
 * 后端契约（../campushub/cloudfunctions/login/index.js）：
 *   await callFunction('login') → { user: { _id, nickname, avatar, creditScore, ... } }
 *   ⚠️ 后端用 stripOpenid() 剥掉了 openid（openid 属服务端可信来源，不下发客户端），
 *      前端身份标识是 _id。原实现用 `user.openid` 做存在性判断，恒为 undefined，
 *      导致 setUserInfo 永不执行、isLoggedIn 恒 false —— 已改为判 _id。
 */

interface UserInfo {
  _id: string
  nickname: string
  avatar: string
  creditScore: number
  role: 'user' | 'admin'
  [key: string]: unknown
}

export const useUserStore = defineStore('user', {
  state: () => ({
    isLoggedIn: false,
    userInfo: null as UserInfo | null,
    loginRedirect: '',
    loginError: ''
  }),
  actions: {
    setUserInfo(user: UserInfo) {
      this.userInfo = user
      this.isLoggedIn = true
      this.loginError = ''
    },
    clear() {
      this.userInfo = null
      this.isLoggedIn = false
      this.loginRedirect = ''
      this.loginError = ''
    },
    /**
     * 恢复登录态：
     *  - 持久化的 userInfo 还在 → 直接标记已登录（H5/App 刷新后的乐观路径）
     *  - 走一遍 login 云函数 → 拿到最新 creditScore / role（小程序端冷启动必跑一次）
     * 任何异常都降级为未登录，绝不阻塞页面渲染。
     */
    async restore() {
      // 1. 先恢复本地缓存
      const cached = this.userInfo
      if (cached) {
        this.isLoggedIn = true
      }

      // 2. 调用后端刷新（失败不抛，静默降级）
      try {
        // login 契约：ok({ user }) → { success:true, user: { _id, ... } }
        // ⚠️ 后端 stripOpenid 已剥掉 openid，必须判 _id（原实现判 openid → 恒 false，登录态永不生效）
        const res: any = await callFunction('login')
        const user = res?.user
        if (user && user._id) {
          this.setUserInfo(user as UserInfo)
        } else if (res && res.success === false) {
          this.loginError = res.message || res.code || '登录态校验失败'
          console.warn('[CampusHub] login 云函数返回', res)
        }
      } catch (e: any) {
        this.loginError = e?.message || String(e)
        console.warn('[CampusHub] login 调用失败（已降级为本地缓存）', this.loginError)
      }
    },
    /**
     * 主动重新登录（如退出后再进、或角色升级场景）
     */
    async refresh() {
      this.loginError = ''
      try {
        const res: any = await callFunction('login')
        const user = res?.user || res?.data?.user
        if (user && user._id) this.setUserInfo(user as UserInfo)
        else this.clear()
      } catch (e: any) {
        this.loginError = e?.message || String(e)
        this.clear()
      }
    }
  },
  persist: {
    key: 'campushub.user',
    storage: {
      getItem: (k) => uni.getStorageSync(k) || null,
      setItem: (k, v) => uni.setStorageSync(k, v)
    }
  }
})
