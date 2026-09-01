// cloudfunctions/backup-db/index.js
// 数据备份（P0 数据安全兜底）
// 微信云开发无自动备份，本函数每天 03:00 定时触发，将核心业务集合
// 快照写入 backups 集合（JSON 分片），并清理超过保留期的旧备份。
// 保留天数由环境变量 BACKUP_RETENTION_DAYS 控制（默认 7）。
// 恢复方法见 docs/OPERATIONS.md「数据备份与恢复」。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 备份集合清单：排除超大日志表 view_logs（可重建）
const BACKUP_COLLECTIONS = [
  'users', 'posts', 'products', 'comments', 'likes', 'collects',
  'guides', 'guide_categories', 'categories', 'reports', 'feedbacks',
  'follows', 'checkins', 'notifications', 'verify_requests'
]
const DEFAULT_RETENTION_DAYS = 7
const PAGE_SIZE = 500
const MAX_PARTS_PER_COLLECTION = 40 // 单集合最多备份 2 万条，防定时任务失控

function pad(n) { return n < 10 ? '0' + n : '' + n }
function dateKey(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

// 导出单个集合：按 _id 升序分页，返回完整分片（含 records）
async function dumpCollection(name, date) {
  const col = db.collection(name)
  const countRes = await col.count()
  const total = countRes.total || 0
  const parts = []
  let offset = 0
  let part = 0
  while (offset < total && part < MAX_PARTS_PER_COLLECTION) {
    const res = await col.orderBy('_id', 'asc').skip(offset).limit(PAGE_SIZE).get()
    const data = res.data || []
    if (data.length === 0) break
    parts.push({
      date,
      collection: name,
      part: part + 1,
      totalParts: Math.ceil(total / PAGE_SIZE),
      recordCount: data.length,
      records: JSON.stringify(data),
      createdAt: new Date()
    })
    offset += data.length
    part++
  }
  return { name, total, partCount: parts.length, parts }
}

exports.main = async () => {
  const retention = Number(process.env.BACKUP_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS
  const now = new Date()
  const date = dateKey(now)
  const backupCol = db.collection('backups')
  const summary = []

  // 1. 逐个集合导出并写入（容错：单集合失败不中断整体）
  for (const name of BACKUP_COLLECTIONS) {
    try {
      const r = await dumpCollection(name, date)
      for (const part of r.parts) {
        await backupCol.add({ data: part })
      }
      summary.push({ collection: name, total: r.total, parts: r.partCount })
    } catch (e) {
      summary.push({ collection: name, error: String(e && (e.errMsg || e.message)).slice(0, 120) })
    }
  }

  // 2. 清理超过保留期的旧备份（每次最多清 500 条，剩余留给后续触发）
  let removed = 0
  try {
    const since = new Date(now.getTime() - retention * 86400000)
    const oldRes = await backupCol.where({ createdAt: _.lt(since) }).limit(500).get()
    for (const doc of oldRes.data || []) {
      await backupCol.doc(doc._id).remove()
      removed++
    }
  } catch (e) {
    // 清理失败不阻断备份本身
  }

  return { success: true, date, retentionDays: retention, summary, removed }
}
