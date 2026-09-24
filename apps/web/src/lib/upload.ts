import { supabase } from '@/lib/supabase'
import { USE_MOCK } from '@/lib/mock'
import { mockUploadImages } from '@/mock/api'

const BUCKET = 'images'

/** 确保存储桶存在（首次使用前调用一次即可；失败不阻塞业务） */
export async function ensureBucket() {
  if (USE_MOCK) return
  const { data: buckets } = await supabase.storage.listBuckets()
  if (buckets?.some(b => b.name === BUCKET)) return
  await supabase.storage.createBucket(BUCKET, { public: true })
}

/** 上传图片文件，返回可公开访问的 URL 列表 */
export async function uploadImages(files: (File | Blob)[], prefix = 'u'): Promise<string[]> {
  if (USE_MOCK) return mockUploadImages(files as File[])
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('请先登录')
  if (!files.length) return []
  const urls: string[] = []
  for (const f of files) {
    const ext = (f.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    const path = `${prefix}/${user.id}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, f)
    if (error) throw new Error('图片上传失败：' + error.message)
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    urls.push(data.publicUrl)
  }
  return urls
}
