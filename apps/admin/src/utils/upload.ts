import { API_BASE, errMsg } from "@/api/client";
import { getToken, formatToken } from "@/utils/auth";

/**
 * 图片上传：自家服务端 /api/upload/images（multipart 字段 files，最多 9 张）
 * 返回相对路径 /static/xxx.jpg（开发由 Vite 代理，生产由 nginx 反代）
 */
export async function uploadImages(
  files: File[],
  _type = "general"
): Promise<string[]> {
  const fd = new FormData();
  files.forEach(f => fd.append("files", f));
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(API_BASE + "/upload/images", {
      method: "POST",
      headers: token?.accessToken
        ? { Authorization: formatToken(token.accessToken) }
        : {},
      body: fd
    });
  } catch {
    throw new Error("图片上传失败，请检查网络");
  }
  if (!res.ok) {
    let msg = "图片上传失败";
    try {
      const d = await res.json();
      msg = d?.message || msg;
    } catch {
      /* 忽略解析失败 */
    }
    throw new Error(msg);
  }
  const d = await res.json();
  return d?.urls ?? [];
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
