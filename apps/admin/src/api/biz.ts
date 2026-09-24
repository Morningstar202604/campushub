import { supabase, errMsg } from "./supabase";

/** 通用分页查询（RLS 已限定仅管理员） */
export async function pagedQuery<T = any>(
  table: string,
  opts: {
    select?: string;
    filters?: Record<string, any>;
    order?: { column: string; ascending?: boolean };
    page?: number;
    pageSize?: number;
  } = {}
): Promise<{ list: T[]; total: number }> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  let q = supabase
    .from(table)
    .select(opts.select || "*", { count: "exact" });
  if (opts.filters) {
    for (const [k, v] of Object.entries(opts.filters)) {
      if (v !== undefined && v !== null && v !== "") q = q.eq(k, v);
    }
  }
  if (opts.order) q = q.order(opts.order.column, { ascending: opts.order.ascending ?? false });
  const offset = (page - 1) * pageSize;
  const { data, error, count } = await q.range(offset, offset + pageSize - 1);
  if (error) throw new Error(errMsg(error));
  return { list: (data ?? []) as T[], total: count ?? 0 };
}

/** 记录管理员操作（写操作审计） */
export async function logAction(
  action: string,
  detail: string,
  adminId?: string
) {
  await supabase.from("admin_logs").insert({
    admin_id: adminId,
    action,
    detail
  });
}

// ---------- 帖子审核 ----------
export const auditPosts = (page = 1, pageSize = 20) =>
  pagedQuery("posts", {
    select: "id, title, content, kind, author_id, status, is_pinned, is_essence, resolved, like_count, comment_count, view_count, created_at",
    order: { column: "created_at" },
    page,
    pageSize
  });

export const setPostStatus = (id: string, status: string) =>
  supabase.from("posts").update({ status }).eq("id", id);

export const setPostPin = (id: string, isPinned: boolean) =>
  supabase.from("posts").update({ is_pinned: isPinned }).eq("id", id);

export const setPostEssence = (id: string, isEssence: boolean) =>
  supabase.from("posts").update({ is_essence: isEssence }).eq("id", id);

// ---------- 商品审核 ----------
export const auditProducts = (page = 1, pageSize = 20) =>
  pagedQuery("products", {
    select: "id, title, description, price, seller_id, status, view_count, created_at",
    order: { column: "created_at" },
    page,
    pageSize
  });

export const setProductStatus = (id: string, status: string) =>
  supabase.from("products").update({ status }).eq("id", id);

// ---------- 评论审核 ----------
export const auditComments = (page = 1, pageSize = 20) =>
  pagedQuery("comments", {
    select: "id, target_type, target_id, user_id, content, status, like_count, created_at",
    order: { column: "created_at" },
    page,
    pageSize
  });

export const setCommentStatus = (id: string, status: string) =>
  supabase.from("comments").update({ status }).eq("id", id);

// ---------- 举报处理 ----------
export const listReports = (page = 1, pageSize = 20) =>
  pagedQuery("reports", {
    select: "id, reporter_id, target_type, target_id, reason, detail, status, created_at, handled_at, handler_id, handler_note",
    order: { column: "created_at" },
    page,
    pageSize
  });

export const handleReport = async (
  id: string,
  status: "approved" | "rejected",
  note: string,
  adminId?: string
) => {
  const { error } = await supabase
    .from("reports")
    .update({
      status,
      handler_id: adminId,
      handler_note: note,
      handled_at: new Date().toISOString()
    })
    .eq("id", id);
  return error ? { error: errMsg(error) } : {};
};

// ---------- 用户管理 ----------
export const listUsers = (page = 1, pageSize = 20, keyword = "") => {
  const q = supabase
    .from("profiles")
    .select("id, nickname, avatar, college, major, grade, gender, bio, points, checkin_streak, is_banned, is_admin, created_at", { count: "exact" })
    .order("created_at", { ascending: false });
  const query = keyword ? q.ilike("nickname", `%${keyword}%`) : q;
  return query
    .range((page - 1) * pageSize, page * pageSize - 1)
    .then(({ data, error, count }) => ({
      list: (data ?? []) as any[],
      total: count ?? 0,
      error: error ? errMsg(error) : null
    }));
};

export const setUserBan = (id: string, isBanned: boolean) =>
  supabase.from("profiles").update({ is_banned: isBanned }).eq("id", id);

export const setUserAdmin = (id: string, isAdmin: boolean) =>
  supabase.from("profiles").update({ is_admin: isAdmin }).eq("id", id);

// ---------- 分类管理 ----------
export const listCategories = () =>
  supabase
    .from("categories")
    .select("id, name, icon, sort, enabled, created_at")
    .order("sort", { ascending: true })
    .then(({ data, error }) => ({
      list: (data ?? []) as any[],
      error: error ? errMsg(error) : null
    }));

export const saveCategory = (row: any) => {
  const payload = {
    name: row.name,
    icon: row.icon || "",
    sort: Number(row.sort ?? 0),
    enabled: row.enabled ?? true
  };
  return row.id
    ? supabase.from("categories").update(payload).eq("id", row.id)
    : supabase.from("categories").insert(payload);
};

export const deleteCategory = (id: string) =>
  supabase.from("categories").delete().eq("id", id);

// ---------- 公告管理 ----------
export const listAnnouncements = () =>
  supabase
    .from("announcements")
    .select("id, title, content, is_active, created_at")
    .order("created_at", { ascending: false })
    .then(({ data, error }) => ({
      list: (data ?? []) as any[],
      error: error ? errMsg(error) : null
    }));

export const saveAnnouncement = (row: any) => {
  const payload = {
    title: row.title,
    content: row.content,
    is_active: row.is_active ?? true
  };
  return row.id
    ? supabase.from("announcements").update(payload).eq("id", row.id)
    : supabase.from("announcements").insert(payload);
};

export const deleteAnnouncement = (id: string) =>
  supabase.from("announcements").delete().eq("id", id);

// ---------- 指南管理 ----------
export const listGuideCats = () =>
  supabase
    .from("guide_categories")
    .select("id, name, icon, sort, created_at")
    .order("sort", { ascending: true })
    .then(({ data, error }) => ({
      list: (data ?? []) as any[],
      error: error ? errMsg(error) : null
    }));

export const saveGuideCat = (row: any) => {
  const payload = { name: row.name, icon: row.icon || "", sort: Number(row.sort ?? 0) };
  return row.id
    ? supabase.from("guide_categories").update(payload).eq("id", row.id)
    : supabase.from("guide_categories").insert(payload);
};

export const deleteGuideCat = (id: string) =>
  supabase.from("guide_categories").delete().eq("id", id);

export const listGuides = (page = 1, pageSize = 20, catId = "") => {
  const filters = catId ? { category_id: catId } : {};
  return pagedQuery("guides", {
    select: "id, category_id, title, summary, tags, cover_image, view_count, created_at",
    filters,
    order: { column: "created_at" },
    page,
    pageSize
  });
};

export const saveGuide = (row: any) => {
  const payload = {
    category_id: row.category_id,
    title: row.title,
    summary: row.summary || "",
    content: row.content || "",
    tags: row.tags || [],
    cover_image: row.cover_image || ""
  };
  return row.id
    ? supabase.from("guides").update(payload).eq("id", row.id)
    : supabase.from("guides").insert(payload);
};

export const deleteGuide = (id: string) =>
  supabase.from("guides").delete().eq("id", id);

// ---------- 反馈管理 ----------
export const listFeedbacks = (page = 1, pageSize = 20) =>
  pagedQuery("feedbacks", {
    select: "id, user_id, content, contact, status, created_at",
    order: { column: "created_at" },
    page,
    pageSize
  });

export const setFeedbackDone = (id: string, done: boolean) =>
  supabase
    .from("feedbacks")
    .update({ status: done ? "done" : "pending" })
    .eq("id", id);

// ---------- 通知下发 ----------
export const listNotifications = (page = 1, pageSize = 20) =>
  pagedQuery("notifications", {
    select: "id, user_id, type, content, target_type, target_id, is_read, created_at",
    order: { column: "created_at" },
    page,
    pageSize
  });

export const createNotification = (payload: {
  user_id?: string | null;
  type: string;
  content: string;
  target_type?: string | null;
  target_id?: string | null;
}) => supabase.from("notifications").insert(payload);

// ---------- 操作审计 ----------
export const listAdminLogs = (page = 1, pageSize = 20) =>
  pagedQuery("admin_logs", {
    select: "id, admin_id, action, detail, created_at",
    order: { column: "created_at" },
    page,
    pageSize
  });
