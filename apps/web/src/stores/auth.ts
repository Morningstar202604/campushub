import { defineStore } from 'pinia'
import { http, setTokens, clearTokens, hasToken, refreshAccess } from '@/lib/http'
import { resolveStaticUrl } from '@/lib/upload'
import type { Profile } from '@/types'

/** 后端 camelCase → 前端 Profile（snake_case） */
function toProfile(raw: any): Profile {
  return {
    ...raw,
    avatar: resolveStaticUrl(raw.avatar ?? ''),
    checkin_streak: raw.checkinStreak ?? 0,
    last_checkin_date: raw.lastCheckinDate ?? null,
    is_admin: raw.isAdmin ?? false,
    is_banned: raw.isBanned ?? false,
    created_at: raw.createdAt,
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    profile: null as Profile | null,
    loading: false
  }),
  getters: {
    isLoggedIn: (s) => !!s.profile
  },
  actions: {
    /** 应用启动时恢复会话并拉取最新 profile */
    async restore() {
      if (!hasToken()) return
      // access 在内存里可能没有（页面刷新后），用 refresh token 换新会话
      try {
        await refreshAccess()
        await this.fetchProfile()
      } catch (e: any) {
        console.warn('[auth] 会话恢复失败', e?.message)
        this.profile = null
      }
    },
    async fetchProfile() {
      if (!hasToken()) { this.profile = null; return }
      try {
        const data = await http.get<any>('/auth/me')
        this.profile = toProfile(data)
      } catch (e: any) {
        // 401 已自动清 token；其他错误仅警告
        console.warn('[auth] 拉取 profile 失败', e.message)
        this.profile = null
      }
    },
    /** 邮箱+密码登录（自建服务层） */
    async login(email: string, password: string) {
      const data = await http.post<any>('/auth/login', { email, password })
      setTokens(data.accessToken, data.refreshToken)
      this.profile = toProfile(data.user)
      await this.fetchProfile()
    },
    async register(email: string, password: string, nickname: string) {
      const data = await http.post<any>('/auth/register', { email, password, nickname })
      setTokens(data.accessToken, data.refreshToken)
      this.profile = toProfile(data.user)
      await this.fetchProfile()
    },
    async logout() {
      try { await http.post('/auth/logout') } catch { /* 忽略 */ }
      clearTokens()
      this.profile = null
    },
    async updateProfile(patch: Partial<Profile>) {
      // snake_case → 后端 camelCase
      const body: Record<string, unknown> = { ...patch }
      if ('checkin_streak' in body) { body.checkinStreak = body.checkin_streak; delete body.checkin_streak }
      if ('last_checkin_date' in body) { body.lastCheckinDate = body.last_checkin_date; delete body.last_checkin_date }
      if ('is_admin' in body) { body.isAdmin = body.is_admin; delete body.is_admin }
      if ('is_banned' in body) { body.isBanned = body.is_banned; delete body.is_banned }
      if ('created_at' in body) delete body.created_at
      await http.patch('/auth/me', body)
      await this.fetchProfile()
    },
    friendly(msg: string): string {
      if (/邮箱或密码错误|密码错误/.test(msg)) return '邮箱或密码错误'
      if (/已注册/.test(msg)) return '该邮箱已注册，请直接登录'
      if (/至少 6 位|密码/.test(msg) && /6/.test(msg)) return '密码至少 6 位'
      return msg
    }
  }
})
