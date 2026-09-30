import { request } from "./client";

/**
 * 管理后台业务 API —— 全部对接自家服务端 /api/admin/*
 *
 * 返回约定（与旧 Supabase 版本兼容，views 无需大改）：
 * - 列表：{ list, total, error: null | Error }
 * - 写操作：{ error: null | Error }
 * 成功时 error 为 null，失败时 error 为 Error（message 可直接展示）。
 */

type ListResult<T> = { list: T[]; total: number; error: Error | null };

function errOf(e: any): Error {
  return e instanceof Error
    ? e
    : new Error(e?.message || "操作失败，请稍后再试");
}

/** 通用分页/列表请求（成功返回空列表 + error:null，失败返回 error） */
async function getList<T>(
  path: string,
  params?: Record<string, any>
): Promise<ListResult<T>> {
  try {
    const d = await request<{ list?: T[]; total?: number }>("get", path, params);
    return { list: d?.list ?? [], total: d?.total ?? 0, error: null };
  } catch (e: any) {
    return { list: [], total: 0, error: errOf(e) };
  }
}

/** 写操作统一包装（成功 {error:null}，失败 {error}） */
async function writeOk(fn: () => Promise<any>): Promise<{ error: Error | null }> {
  try {
    await fn();
    return { error: null };
  } catch (e: any) {
    return { error: errOf(e) };
  }
}

// ---------- 帖子审核 ----------
export const auditPosts = (page = 1, pageSize = 20) =>
  getList<any>("/admin/posts", { page, pageSize });

export const setPostStatus = (id: string, status: string) =>
  writeOk(() =>
    request("patch", `/admin/posts/${id}/status`, undefined, { status })
  );

export const setPostPin = (id: string, isPinned: boolean) =>
  writeOk(() =>
    request("patch", `/admin/posts/${id}/pin`, undefined, { isPinned })
  );

export const setPostEssence = (id: string, isEssence: boolean) =>
  writeOk(() =>
    request("patch", `/admin/posts/${id}/essence`, undefined, { isEssence })
  );

// ---------- 商品审核 ----------
export const auditProducts = (page = 1, pageSize = 20) =>
  getList<any>("/admin/products", { page, pageSize });

export const setProductStatus = (id: string, status: string) =>
  writeOk(() =>
    request("patch", `/admin/products/${id}/status`, undefined, { status })
  );

// ---------- 评论审核 ----------
export const auditComments = (page = 1, pageSize = 20) =>
  getList<any>("/admin/comments", { page, pageSize });

export const setCommentStatus = (id: string, status: string) =>
  writeOk(() =>
    request("patch", `/admin/comments/${id}/status`, undefined, { status })
  );

// ---------- 举报处理（v2 语义：handled=已处理 / dismissed=驳回） ----------
export const listReports = (page = 1, pageSize = 20) =>
  getList<any>("/admin/reports", { page, pageSize });

export const handleReport = (
  id: string,
  status: "handled" | "dismissed",
  note: string,
  _adminId?: string
) =>
  writeOk(() =>
    request("patch", `/admin/reports/${id}`, undefined, { status, note })
  );

// ---------- 用户管理 ----------
export const listUsers = (page = 1, pageSize = 20, keyword = "") =>
  getList<any>("/admin/users", { page, pageSize, keyword });

export const setUserBan = (id: string, isBanned: boolean) =>
  writeOk(() =>
    request("patch", `/admin/users/${id}/ban`, undefined, { isBanned })
  );

export const setUserAdmin = (id: string, isAdmin: boolean) =>
  writeOk(() =>
    request("patch", `/admin/users/${id}/admin`, undefined, { isAdmin })
  );

// ---------- 分类管理 ----------
export const listCategories = () => getList<any>("/admin/categories");

export const saveCategory = (row: any) => {
  const payload = {
    name: row.name,
    icon: row.icon || "",
    sort: Number(row.sort ?? 0),
    enabled: row.enabled ?? true
  };
  return writeOk(() =>
    row.id
      ? request("patch", `/admin/categories/${row.id}`, undefined, payload)
      : request("post", "/admin/categories", undefined, payload)
  );
};

export const deleteCategory = (id: string) =>
  writeOk(() => request("delete", `/admin/categories/${id}`));

// ---------- 公告管理 ----------
export const listAnnouncements = () => getList<any>("/admin/announcements");

export const saveAnnouncement = (row: any) => {
  const payload = {
    title: row.title,
    content: row.content,
    isActive: row.is_active ?? true
  };
  return writeOk(() =>
    row.id
      ? request("patch", `/admin/announcements/${row.id}`, undefined, payload)
      : request("post", "/admin/announcements", undefined, payload)
  );
};

export const deleteAnnouncement = (id: string) =>
  writeOk(() => request("delete", `/admin/announcements/${id}`));

// ---------- 指南管理 ----------
export const listGuideCats = () => getList<any>("/admin/guide-categories");

export const saveGuideCat = (row: any) => {
  const payload = {
    name: row.name,
    icon: row.icon || "",
    sort: Number(row.sort ?? 0)
  };
  return writeOk(() =>
    row.id
      ? request("patch", `/admin/guide-categories/${row.id}`, undefined, payload)
      : request("post", "/admin/guide-categories", undefined, payload)
  );
};

export const deleteGuideCat = (id: string) =>
  writeOk(() => request("delete", `/admin/guide-categories/${id}`));

export const listGuides = (page = 1, pageSize = 20, catId = "") =>
  getList<any>("/admin/guides", { page, pageSize, categoryId: catId });

export const saveGuide = (row: any) => {
  const payload = {
    categoryId: row.category_id,
    title: row.title,
    summary: row.summary || "",
    content: row.content || "",
    tags: row.tags || [],
    coverImage: row.cover_image || ""
  };
  return writeOk(() =>
    row.id
      ? request("patch", `/admin/guides/${row.id}`, undefined, payload)
      : request("post", "/admin/guides", undefined, payload)
  );
};

export const deleteGuide = (id: string) =>
  writeOk(() => request("delete", `/admin/guides/${id}`));

// ---------- 反馈管理 ----------
export const listFeedbacks = (page = 1, pageSize = 20) =>
  getList<any>("/admin/feedbacks", { page, pageSize });

export const setFeedbackDone = (id: string, done: boolean) =>
  writeOk(() =>
    request("patch", `/admin/feedbacks/${id}`, undefined, { done })
  );

// ---------- 通知下发 ----------
export const listNotifications = (page = 1, pageSize = 20) =>
  getList<any>("/admin/notifications", { page, pageSize });

export const createNotification = (payload: {
  user_id?: string | null;
  type: string;
  content: string;
  target_type?: string | null;
  target_id?: string | null;
}) =>
  writeOk(() =>
    request("post", "/admin/notifications", undefined, {
      userId: payload.user_id ?? undefined,
      type: payload.type,
      content: payload.content,
      targetType: payload.target_type ?? undefined,
      targetId: payload.target_id ?? undefined
    })
  );

// ---------- 操作审计（服务端已自动记录，保留导出以兼容旧调用） ----------
export const listAdminLogs = (page = 1, pageSize = 20) =>
  getList<any>("/admin/logs", { page, pageSize });

/** 旧版前端手动审计 → v2 已由服务端写操作统一落 admin_logs，此处为 no-op 兼容 */
export async function logAction(_action: string, _detail: string, _adminId?: string) {
  return;
}
