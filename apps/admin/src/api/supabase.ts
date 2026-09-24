import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase 客户端（管理后台与学生端共用同一 Supabase 项目）
 *
 * ⚠️ 占位配置：部署前请在 apps/admin/.env（开发）与 .env.production（生产）
 * 填写真实值，模板见 .env.example
 */
export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL || "https://YOUR_PROJECT.supabase.co";
export const SUPABASE_ANON_KEY: string =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_ANON_KEY";

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    "[admin] 未配置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，登录功能将不可用，请参照 .env.example 填写"
  );
}

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/** 统一取数错误消息 */
export function errMsg(error: { message?: string } | null, fallback = "操作失败") {
  return error?.message || fallback;
}
