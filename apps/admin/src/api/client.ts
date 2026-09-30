import { http } from "@/utils/http";

/**
 * 自家服务端 API 客户端（M1 服务层迁移后的统一入口）
 *
 * - baseURL：开发走 Vite 代理（vite.config.ts 里 /api → :3000），
 *   生产由 nginx 反代 /api；也可用 VITE_API_BASE 覆盖为完整地址。
 * - 请求自动携带 Bearer token、过期自动刷新（见 utils/http/index.ts）。
 */
export const API_BASE: string = import.meta.env.VITE_API_BASE || "/api";

/** 统一取数错误消息 */
export function errMsg(
  error: { message?: string } | null,
  fallback = "操作失败"
) {
  return error?.message || fallback;
}

type HttpMethod = "get" | "post" | "patch" | "delete";

/** 统一请求：params 拼 query，body 走 JSON；失败抛 Error（message 取后端 {code,message}） */
export async function request<T = any>(
  method: HttpMethod,
  path: string,
  params?: Record<string, any>,
  body?: unknown
): Promise<T> {
  const config: Record<string, any> = {};
  if (params) {
    // 去掉空值，避免 ?keyword= 空串等无意义参数
    config.params = Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v !== undefined && v !== null && v !== ""
      )
    );
  }
  if (body !== undefined) config.data = body;
  try {
    return await http.request<T>(method, API_BASE + path, config);
  } catch (e: any) {
    const msg =
      e?.response?.data?.message || e?.message || "操作失败，请稍后再试";
    throw new Error(msg);
  }
}
