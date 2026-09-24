import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

/**
 * 未配置时使用非空占位符，保证 createClient 不抛错、页面可正常渲染；
 * 所有数据请求会在网络层失败并被各页面 try/catch 捕获，显示空态。
 * 部署前在 .env 填入真实值（与学生端同一 Supabase 项目）。
 */
const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_KEY = 'placeholder-anon-key'

if (!url || !key) {
  console.warn('[CampusHub] 未配置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，请先复制 .env.example 为 .env 并填写')
}

export const supabase = createClient(url || PLACEHOLDER_URL, key || PLACEHOLDER_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
})

export const isConfigured = Boolean(url && key)
