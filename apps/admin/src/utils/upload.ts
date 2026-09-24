import { supabase, errMsg } from "@/api/supabase";

/** 上传目录命名：按类型分区 */
function folderOf(type: string) {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `${type}/${ym}`;
}

/** 确保存储桶存在（首次上传自动创建，Public） */
export async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some(b => b.name === "images")) {
    const { error } = await supabase.storage.createBucket("images", {
      public: true
    });
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(errMsg(error, "存储桶创建失败"));
    }
  }
}

/** 批量上传图片到 Supabase Storage，返回公开 URL 列表 */
export async function uploadImages(files: File[], type = "general"): Promise<string[]> {
  await ensureBucket();
  const urls: string[] = [];
  for (const file of files) {
    const ext = file.name.includes(".")
      ? file.name.split(".").pop()!.toLowerCase()
      : "jpg";
    const safeExt = /^(jpg|jpeg|png|gif|webp|bmp)$/.test(ext) ? ext : "jpg";
    const path = `${folderOf(type)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
    const { error } = await supabase.storage.from("images").upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });
    if (error) throw new Error(errMsg(error, "图片上传失败"));
    urls.push(supabase.storage.from("images").getPublicUrl(path).data.publicUrl);
  }
  return urls;
}

/** vditor 图片上传回调：返回 vditor 约定格式 */
export async function vditorUploadHandler(files: File[]) {
  const succMap: Record<string, string> = {};
  const errFiles: string[] = [];
  for (const f of files) {
    try {
      const urls = await uploadImages([f], "guide");
      succMap[f.name] = urls[0];
    } catch {
      errFiles.push(f.name);
    }
  }
  return { msg: "", code: 0, data: { succMap, errFiles } };
}
