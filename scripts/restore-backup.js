#!/usr/bin/env node
/**
 * restore-backup.js — 从 backups 集合恢复数据到原集合
 *
 * 背景：backup-db 每天把核心集合同步到 backups（JSON 分片），但仓库里**没有恢复工具**，
 * OPERATIONS.md 只写了「手动在控制台读取 records 字段再批量 add」。真出事时靠人手点
 * 控制台恢复 15 个集合不现实。这个脚本把恢复变成一条命令。
 *
 * 用法：
 *   # 1) 先空跑，确认要恢复什么（强烈建议先跑这个）
 *   WX_APPID=xxx WX_SECRET=yyy CLOUD_ENV=env-xxx \
 *     node scripts/restore-backup.js --date 2026-10-21 --dry-run
 *
 *   # 2) 真恢复（默认跳过已存在的 _id，不会覆盖线上新数据）
 *   node scripts/restore-backup.js --date 2026-10-21 --yes
 *
 *   # 只恢复单个集合
 *   node scripts/restore-backup.js --date 2026-10-21 --collection posts --yes
 *
 *   # 允许覆盖已存在的文档（危险，需显式确认）
 *   node scripts/restore-backup.js --date 2026-10-21 --overwrite --yes
 *
 * 认证：CloudBase 管理端 API 需要 appid + appsecret 换 access_token。
 * 这两个值属于密钥，只从环境变量读取，不接受命令行参数（避免进 shell history）。
 *
 * 退出码：0 成功；1 参数/认证/数据错误。
 */
const https = require('https')

const API = 'https://api.weixin.qq.com'
const TCB = 'https://api.weixin.qq.com/tcb'

const args = process.argv.slice(2)
const getArg = (name, def = '') => {
  const i = args.indexOf('--' + name)
  return i > -1 ? args[i + 1] : def
}
const hasFlag = (name) => args.includes('--' + name)

const DATE = getArg('date')
const ENV = process.env.CLOUD_ENV || getArg('env')
const APPID = process.env.WX_APPID
const SECRET = process.env.WX_SECRET
const ONLY = getArg('collection')
const DRY = hasFlag('dry-run')
const CONFIRMED = hasFlag('yes')
const OVERWRITE = hasFlag('overwrite')
const PAGE = 100

function die(msg) {
  console.error('✗ ' + msg)
  process.exit(1)
}

if (!DATE || !/^\d{4}-\d{2}-\d{2}$/.test(DATE)) die('必须指定 --date YYYY-MM-DD')
if (!ENV) die('必须指定 --env 或环境变量 CLOUD_ENV')
if (!APPID || !SECRET) die('必须提供环境变量 WX_APPID / WX_SECRET（不要用命令行参数传密钥）')
if (!DRY && !CONFIRMED) die('真实恢复必须显式加 --yes（先跑 --dry-run 确认范围）')

function request(url, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const u = new URL(url)
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: body ? 'POST' : 'GET',
        headers: data
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
          : {}
      },
      (res) => {
        let buf = ''
        res.on('data', (c) => (buf += c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(buf))
          } catch {
            reject(new Error('响应非 JSON: ' + buf.slice(0, 200)))
          }
        })
      }
    )
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

let TOKEN = ''

async function ensureToken() {
  if (TOKEN) return TOKEN
  const r = await request(
    `${API}/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(
      APPID
    )}&secret=${encodeURIComponent(SECRET)}`
  )
  if (!r.access_token) die('获取 access_token 失败: ' + JSON.stringify(r).slice(0, 200))
  TOKEN = r.access_token
  return TOKEN
}

/** 调用云开发数据库 HTTP 接口 */
async function dbQuery(query, dryRun) {
  const token = await ensureToken()
  const r = await request(`${TCB}/databasequery?access_token=${token}`, {
    env: ENV,
    query,
    ...(dryRun ? { limit: 1 } : {})
  })
  if (r.errcode) throw new Error(`databasequery ${r.errcode}: ${r.errmsg}`)
  return r
}

async function dbAdd(collection, docs) {
  const token = await ensureToken()
  const r = await request(`${TCB}/databaseadd?access_token=${token}`, {
    env: ENV,
    collection,
    data: docs
  })
  if (r.errcode) throw new Error(`databaseadd ${collection} ${r.errcode}: ${r.errmsg}`)
  return r
}

/** 逐页拉取 backups 里某个日期的分片 */
async function fetchParts(collection) {
  const parts = []
  let offset = 0
  for (;;) {
    const q = `db.collection("backups").where({date:"${DATE}",collection:"${collection}"}).orderBy("part","asc").skip(${offset}).limit(${PAGE}).get()`
    const r = await dbQuery(q)
    const rows = r.data || []
    parts.push(...rows)
    if (rows.length < PAGE) break
    offset += rows.length
  }
  return parts
}

async function main() {
  console.log(`[restore] date=${DATE} env=${ENV} mode=${DRY ? 'DRY-RUN' : 'REAL'}`)

  // 1) 列出该日期有哪些集合
  const head = await dbQuery(
    `db.collection("backups").where({date:"${DATE}"}).limit(${PAGE}).get()`
  )
  const all = new Set((head.data || []).map((d) => d.collection))
  if (all.size === 0) die(`日期 ${DATE} 没有任何备份分片`)
  const targets = ONLY ? [ONLY] : [...all]
  if (ONLY && !all.has(ONLY)) die(`集合 ${ONLY} 在该日期没有备份`)

  console.log(`[restore] 可用集合 ${all.size} 个，本次处理 ${targets.length} 个`)
  let totalDocs = 0
  let totalTruncated = []

  for (const col of targets) {
    const parts = await fetchParts(col)
    const docs = []
    let truncated = false
    for (const p of parts) {
      if (p.truncated) truncated = true
      try {
        const arr = JSON.parse(p.records || '[]')
        docs.push(...arr)
      } catch (e) {
        console.warn(`  跳过损坏分片 ${col}#${p.part}: ${e.message}`)
      }
    }
    if (truncated) totalTruncated.push(col)
    totalDocs += docs.length
    console.log(
      `  ${col}: ${parts.length} 分片 / ${docs.length} 条${truncated ? ' [备份本身被截断]' : ''}`
    )

    if (DRY) continue

    // 2) 恢复：按 _id 分批写入。默认不覆盖（已存在则跳过，避免踩掉线上新数据）
    const BATCH = 20
    let written = 0
    let skipped = 0
    for (let i = 0; i < docs.length; i += BATCH) {
      const batch = docs.slice(i, i + BATCH)
      let toWrite = batch
      if (!OVERWRITE) {
        const ids = batch.map((d) => `"${d._id}"`).join(',')
        const chk = await dbQuery(
          `db.collection("${col}").where({_id: db.command.in([${ids}])}).field({_id:true}).limit(${BATCH}).get()`
        )
        const exist = new Set((chk.data || []).map((d) => d._id))
        toWrite = batch.filter((d) => !exist.has(d._id))
        skipped += batch.length - toWrite.length
      }
      if (toWrite.length === 0) continue
      // 已有 _id 的文档用 set 覆盖；不存在的用 add（add 支持带 _id）
      if (OVERWRITE) {
        for (const d of toWrite) {
          const token = await ensureToken()
          const r = await request(`${TCB}/databaseset?access_token=${token}`, {
            env: ENV,
            collection: col,
            docId: d._id,
            data: d
          })
          if (r.errcode) throw new Error(`databaseset ${col}/${d._id} ${r.errcode}: ${r.errmsg}`)
          written++
        }
      } else {
        const r = await dbAdd(col, toWrite)
        written += r.inserted || toWrite.length
      }
    }
    console.log(`    → 写入 ${written} 条，跳过已存在 ${skipped} 条`)
  }

  console.log(
    `\n[restore] ${DRY ? 'DRY-RUN 完成（未写入任何数据）' : '恢复完成'}：共 ${totalDocs} 条`
  )
  if (totalTruncated.length) {
    console.warn(
      `[restore] ⚠ 以下集合的备份本身被截断（backup-db 达到分片上限），恢复不完整：${totalTruncated.join(', ')}`
    )
  }
  if (DRY) console.log('[restore] 确认无误后加 --yes 执行真实恢复')
}

main().catch((e) => {
  console.error('✗ 恢复失败:', e.message)
  process.exit(1)
})
