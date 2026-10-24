// tests/lib/memory-db.js — 内存版 wx-server-sdk
//
// 目的：让 handler 的业务逻辑能被真实执行（而不是只做源码字符串断言）。
// 之前 96 条测试里没有任何一条跑通 handler 的成功路径，把 post-create 从 199 行
// 删到 5 行测试依然全绿 —— 这个桩就是为了堵住这个洞。
//
// 实现范围：collection/doc/where/orderBy/skip/limit/field/get/count/add/update/remove，
// command: eq/neq/gt/gte/lt/lte/in/and/or/inc/exists，唯一索引冲突模拟。
// 不追求与云开发完全等价，但覆盖本项目用到的全部查询形态。
const Module = require('module')

/**
 * 为 handlers/ 目录生成 common-* 转发桩，使源码 handler 可被直接 require。
 *
 * 为什么需要：生产构建会把 common/ 内联进 dist/cloudfunctions 的网关产物里，
 * 源码 handler 的 `require('./common-bundle')` 在源码树中并不存在。
 * 测产物只能得到「整个网关一个文件」的覆盖率（34 个 handler 共用一份字节码），
 * 测源码才能得到每个 handler 的真实分支覆盖。桩在运行时生成，不入库。
 */
function ensureSourceShims() {
  const fs = require('fs')
  const path = require('path')
  const root = path.resolve(__dirname, '..', '..', 'cloudfunctions')
  const map = {
    'common-bundle.js': '../../common/common-bundle.js',
    'common-subscribe.js': '../../common/common-subscribe.js'
  }
  // 需要补桩的两类位置：
  //   ① api-*/handlers/    —— 网关内联的 handler
  //   ② 独立函数根目录（task-expire / backup-db / init-db）—— 直接 require('./common-bundle')
  const targets = []
  for (const unit of fs.readdirSync(root)) {
    const hdir = path.join(root, unit, 'handlers')
    if (fs.existsSync(hdir)) targets.push({ dir: hdir, rel: '../../common/' })
    if (fs.existsSync(path.join(root, unit, 'index.js')) && !unit.startsWith('common')) {
      targets.push({ dir: path.join(root, unit), rel: '../common/' })
    }
  }
  for (const { dir, rel } of targets) {
    for (const name of Object.keys(map)) {
      const target = path.join(dir, name)
      if (!fs.existsSync(target)) {
        fs.writeFileSync(
          target,
          `// 测试运行时生成（不入库）：转发到 common/，使源码可被 require。
module.exports = require('${rel}${name}')
`
        )
      }
    }
  }
}

let store = new Map() // collection -> Map<_id, doc>
let uniqueIndexes = new Map() // collection -> [[field,...]]
let seq = 0

function reset() {
  store = new Map()
  uniqueIndexes = new Map()
  seq = 0
}

function coll(name) {
  if (!store.has(name)) store.set(name, new Map())
  return store.get(name)
}

function setUnique(collection, fields) {
  if (!uniqueIndexes.has(collection)) uniqueIndexes.set(collection, [])
  uniqueIndexes.get(collection).push(fields)
}

function nextId(prefix = 'id') {
  seq++
  return `${prefix}_${seq}`
}

/* ---------------------------- command 实现 ---------------------------- */

const CMD = Symbol('cmd')

function cmd(op, value) {
  return { [CMD]: true, op, value }
}

const command = {
  eq: (v) => cmd('eq', v),
  neq: (v) => cmd('neq', v),
  gt: (v) => cmd('gt', v),
  gte: (v) => cmd('gte', v),
  lt: (v) => cmd('lt', v),
  lte: (v) => cmd('lte', v),
  in: (v) => cmd('in', v),
  nin: (v) => cmd('nin', v),
  exists: (v) => cmd('exists', v),
  inc: (v) => cmd('inc', v),
  // 云开发的 and/or 支持两种写法：可变参数 _.or(a,b) 与数组 _.or([a,b])
  and: (...args) => cmd('and', Array.isArray(args[0]) ? args[0] : args),
  or: (...args) => cmd('or', Array.isArray(args[0]) ? args[0] : args),
  set: (v) => cmd('set', v)
}

function isCmd(v) {
  return v && typeof v === 'object' && v[CMD] === true
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

function matchValue(actual, expected) {
  if (expected && expected.constructor && expected.constructor.name === 'DBRegExp') {
    return expected.test(actual)
  }
  if (isCmd(expected)) {
    switch (expected.op) {
      case 'eq':
        // 云开发语义：eq(null) 也匹配「字段不存在」（comment-list 用它查主楼层）
        if (expected.value === null) return actual === null || actual === undefined
        return JSON.stringify(actual) === JSON.stringify(expected.value)
      case 'neq':
        return JSON.stringify(actual) !== JSON.stringify(expected.value)
      case 'gt':
        return actual > expected.value
      case 'gte':
        return actual >= expected.value
      case 'lt':
        return actual < expected.value
      case 'lte':
        return actual <= expected.value
      case 'in':
        return (expected.value || []).some((v) => JSON.stringify(v) === JSON.stringify(actual))
      case 'nin':
        return !(expected.value || []).some((v) => JSON.stringify(v) === JSON.stringify(actual))
      case 'exists':
        return expected.value ? actual !== undefined : actual === undefined
      case 'or':
        // 嵌套在字段上的逻辑组合，如 { parentId: _.or(_.eq(null), _.exists(false)) }
        // 每个子条件是独立表达式，按当前字段值逐个判定
        return (expected.value || []).some((c) => matchValue(actual, c))
      case 'and':
        return (expected.value || []).every((c) => matchValue(actual, c))
      default:
        return false
    }
  }
  if (Array.isArray(expected)) return expected.includes(actual)
  return JSON.stringify(actual) === JSON.stringify(expected)
}

/** 条件匹配：支持 {a:1} 与 _.and([...]) / _.or([...]) 嵌套 */
function matches(doc, cond) {
  if (!cond || Object.keys(cond).length === 0) return true
  if (isCmd(cond)) {
    if (cond.op === 'and') return (cond.value || []).every((c) => matches(doc, c))
    if (cond.op === 'or') return (cond.value || []).some((c) => matches(doc, c))
    return false
  }
  for (const [key, expected] of Object.entries(cond)) {
    if (key === '_id' || !key.includes('.')) {
      if (!matchValue(doc[key], expected)) return false
    } else {
      if (!matchValue(getPath(doc, key), expected)) return false
    }
  }
  return true
}

/* ---------------------------- query 链 ---------------------------- */

class Query {
  constructor(name, cond = {}, opts = {}) {
    this.name = name
    this.cond = cond
    this.opts = { skip: 0, limit: 100, order: [], field: null, ...opts }
  }
  where(cond) {
    return new Query(this.name, cond, this.opts)
  }
  orderBy(field, dir) {
    const q = new Query(this.name, this.cond, this.opts)
    q.opts.order = [...q.opts.order, [field, dir]]
    return q
  }
  skip(n) {
    const q = new Query(this.name, this.cond, this.opts)
    q.opts.skip = n
    return q
  }
  limit(n) {
    const q = new Query(this.name, this.cond, this.opts)
    q.opts.limit = n
    return q
  }
  field(f) {
    const q = new Query(this.name, this.cond, this.opts)
    q.opts.field = f
    return q
  }
  _all() {
    let rows = [...coll(this.name).values()].filter((d) => matches(d, this.cond))
    for (const [f, dir] of [...this.opts.order].reverse()) {
      rows.sort((a, b) => {
        const av = getPath(a, f)
        const bv = getPath(b, f)
        if (av === bv) return 0
        const r = av > bv ? 1 : -1
        return dir === 'desc' ? -r : r
      })
    }
    return rows
  }
  async get() {
    let rows = this._all().slice(this.opts.skip, this.opts.skip + this.opts.limit)
    if (this.opts.field) {
      const keys = Object.keys(this.opts.field).filter((k) => this.opts.field[k])
      rows = rows.map((d) => {
        const out = {}
        for (const k of keys) if (k in d) out[k] = d[k]
        return out
      })
    }
    return { data: JSON.parse(JSON.stringify(rows)) }
  }
  async count() {
    return { total: this._all().length }
  }
  async update({ data }) {
    const targets = this._all()
    let updated = 0
    for (const d of targets) {
      const live = coll(this.name).get(d._id)
      if (!live) continue
      applyUpdate(live, data)
      updated++
    }
    return { stats: { updated } }
  }
  async remove() {
    const targets = this._all()
    let removed = 0
    for (const d of targets) if (coll(this.name).delete(d._id)) removed++
    return { stats: { removed } }
  }
}

function applyUpdate(doc, data) {
  for (const [k, v] of Object.entries(data)) {
    if (isCmd(v) && v.op === 'inc') {
      doc[k] = (Number(doc[k]) || 0) + Number(v.value)
    } else if (isCmd(v) && v.op === 'set') {
      doc[k] = v.value
    } else if (!isCmd(v)) {
      doc[k] = v
    }
  }
}

class DocRef {
  constructor(name, id) {
    this.name = name
    this.id = id
  }
  async get() {
    const d = coll(this.name).get(this.id)
    if (!d) {
      const e = new Error('document not exists')
      e.errCode = -1
      throw e
    }
    return { data: JSON.parse(JSON.stringify(d)) }
  }
  async update({ data }) {
    const d = coll(this.name).get(this.id)
    if (!d) return { stats: { updated: 0 } }
    applyUpdate(d, data)
    return { stats: { updated: 1 } }
  }
  async set({ data }) {
    coll(this.name).set(this.id, { ...data, _id: this.id })
    return { stats: { updated: 1 } }
  }
  async remove() {
    const ok = coll(this.name).delete(this.id)
    return { stats: { removed: ok ? 1 : 0 } }
  }
  field() {
    return this
  }
}

class Collection {
  constructor(name) {
    this.name = name
  }
  doc(id) {
    return new DocRef(this.name, id)
  }
  where(cond) {
    return new Query(this.name, cond)
  }
  orderBy(f, d) {
    return new Query(this.name).orderBy(f, d)
  }
  skip(n) {
    return new Query(this.name).skip(n)
  }
  limit(n) {
    return new Query(this.name).limit(n)
  }
  field(f) {
    return new Query(this.name).field(f)
  }
  async get() {
    return new Query(this.name).get()
  }
  async count() {
    return new Query(this.name).count()
  }
  async add({ data }) {
    const _id = data._id || nextId(this.name.slice(0, 2))
    const rows = coll(this.name)
    if (rows.has(_id)) {
      const e = new Error('duplicate key E11000')
      e.errMsg = 'duplicate key'
      throw e
    }
    // 唯一索引检查
    for (const fields of uniqueIndexes.get(this.name) || []) {
      const clash = [...rows.values()].some((d) => fields.every((f) => d[f] === data[f]))
      if (clash) {
        const e = new Error('duplicate key E11000')
        e.errMsg = 'duplicate key'
        throw e
      }
    }
    rows.set(_id, { ...data, _id })
    return { _id }
  }
}

/* ---------------------------- SDK 桩 ---------------------------- */

function makeSdk(opts = {}) {
  const wxContext = opts.wxContext || {}
  const openapi = opts.openapi || {}
  // db.RegExp：云开发的正则查询构造器。桩里用一个带标记的普通对象表示，
  // 匹配时按 substring 判断（与云开发 regexp 语义在本项目的用法等价）。
  // 云开发的 db.RegExp 是**可调用函数**（不是 class），必须支持 db.RegExp({...}) 无 new 调用
  function DBRegExp({ regexp, options } = {}) {
    if (!(this instanceof DBRegExp)) return new DBRegExp({ regexp, options })
    this.regexp = regexp || ''
    this.options = options || ''
  }
  DBRegExp.prototype.test = function (str) {
    try {
      return new RegExp(this.regexp, this.options).test(String(str ?? ''))
    } catch {
      return false
    }
  }
  const db = { collection: (n) => new Collection(n), command, RegExp: DBRegExp }

  return {
    DYNAMIC_CURRENT_ENV: 'test-env',
    init() {},
    database: () => db,
    getWXContext: () => wxContext,
    downloadFile:
      opts.downloadFile ||
      (async () => {
        // 默认给一个真实存在的临时文件：checkImage 会 fs.readFileSync 它。
        // 内容是一个最小 PNG 头，够大但不超过 1MB。
        const fsm = require('fs')
        const osm = require('os')
        const pathm = require('path')
        const tmp = pathm.join(osm.tmpdir(), `ch-img-${Date.now()}-${Math.random()}.png`)
        fsm.writeFileSync(tmp, Buffer.alloc(1024, 1))
        return { tempFilePath: tmp }
      }),
    deleteFile: opts.deleteFile || (async () => ({})),
    openapi
  }
}

/** 把 wx-server-sdk 换成内存桩，并返回清理函数 */
function install(opts) {
  const origLoad = Module._load
  const sdk = makeSdk(opts)
  Module._load = function (request, _parent, _isMain) {
    if (request === 'wx-server-sdk') return sdk
    return origLoad.apply(this, arguments)
  }
  return {
    sdk,
    restore() {
      Module._load = origLoad
    }
  }
}

/** 清空 require 缓存里的云函数模块，保证每次加载都读到最新桩 */
function purge(prefix) {
  for (const k of Object.keys(require.cache)) {
    if (k.includes(prefix)) delete require.cache[k]
  }
}

/** 清理所有测试期生成的 shim（构建门禁会检查源码目录不得有多余文件） */
function removeSourceShims() {
  const fs = require('fs')
  const path = require('path')
  const root = path.resolve(__dirname, '..', '..', 'cloudfunctions')
  const names = ['common-bundle.js', 'common-subscribe.js']
  for (const unit of fs.readdirSync(root)) {
    if (unit.startsWith('common')) continue
    const dirs = [path.join(root, unit), path.join(root, unit, 'handlers')]
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue
      for (const n of names) {
        const f = path.join(dir, n)
        if (fs.existsSync(f)) fs.unlinkSync(f)
      }
    }
  }
}

module.exports = {
  reset,
  install,
  purge,
  setUnique,
  store,
  nextId,
  command,
  coll,
  ensureSourceShims,
  removeSourceShims
}
