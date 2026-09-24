import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { USE_MOCK } from '@/lib/mock'
import { mock, persist } from '@/mock/data'
import type { Profile } from '@/types'

const MOCK_LOGIN_KEY = 'campus_mock_login'

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
      if (USE_MOCK) {
        // Mock 模式：从 localStorage 恢复演示登录态
        if (localStorage.getItem(MOCK_LOGIN_KEY)) {
          this.profile = { ...mock.me } as Profile
        }
        return
      }
      const { data } = await supabase.auth.getSession()
      if (data?.session) await this.fetchProfile()
    },
    async fetchProfile() {
      if (USE_MOCK) {
        this.profile = { ...mock.me } as Profile
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { this.profile = null; return }
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (error) { console.warn('[auth] 拉取 profile 失败', error.message); return }
      this.profile = data as Profile
    },
    /** 邮箱+密码登录（Supabase 原生；Mock 模式任意账号即演示登录） */
    async login(email: string, password: string) {
      if (USE_MOCK) {
        localStorage.setItem(MOCK_LOGIN_KEY, '1')
        this.profile = { ...mock.me } as Profile
        return
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(this.friendly(error.message))
      await this.fetchProfile()
    },
    async register(email: string, password: string, nickname: string) {
      if (USE_MOCK) {
        localStorage.setItem(MOCK_LOGIN_KEY, '1')
        this.profile = { ...mock.me, nickname: nickname || mock.me.nickname } as Profile
        return
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nickname } }
      })
      if (error) throw new Error(this.friendly(error.message))
      // 邮箱确认已开启时用户需先验证；未开启则直接登录
      await this.fetchProfile()
    },
    async logout() {
      if (USE_MOCK) {
        localStorage.removeItem(MOCK_LOGIN_KEY)
        this.profile = null
        return
      }
      await supabase.auth.signOut()
      this.profile = null
    },
    async updateProfile(patch: Partial<Profile>) {
      if (USE_MOCK) {
        Object.assign(mock.me, patch)
        this.profile = { ...mock.me } as Profile
        persist()
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未登录')
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
      if (error) throw new Error(error.message)
      await this.fetchProfile()
    },
    friendly(msg: string): string {
      if (/Invalid login credentials/i.test(msg)) return '邮箱或密码错误'
      if (/User already registered/i.test(msg)) return '该邮箱已注册，请直接登录'
      if (/Password should be at least/i.test(msg)) return '密码至少 6 位'
      if (/Email not confirmed/i.test(msg)) return '邮箱尚未验证，请查收验证邮件'
      return msg
    }
  }
})
