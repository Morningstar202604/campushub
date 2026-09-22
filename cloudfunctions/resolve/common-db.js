// common-db.js — 云环境初始化与数据库访问（单一事实来源）
// 所有云函数通过 require('./common-db') 使用，避免重复初始化与不一致。
const cloud = require('wx-server-sdk')

let _inited = false

function initCloud() {
  if (!_inited) {
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    _inited = true
  }
  return cloud
}

function getCloud() {
  initCloud()
  return cloud
}

function getDB() {
  initCloud()
  return cloud.database()
}

function getCmd() {
  return getDB().command
}

// 判断一个数据库异常是否为唯一键冲突（依赖控制台唯一索引）
function isDuplicateKeyError(e) {
  const msg = String((e && (e.errMsg || e.message)) || '')
  return /duplicate|E11000|-502001/i.test(msg)
}

// 幂等插入：配合唯一索引使用。插入成功返回 true；
// 唯一键冲突返回 false（调用方按"已存在"幂等处理）；其他异常原样抛出。
async function insertIdempotent(collection, data) {
  const db = getDB()
  try {
    await db.collection(collection).add({ data })
    return true
  } catch (e) {
    if (isDuplicateKeyError(e)) return false
    throw e
  }
}

// 客户端输入进 where 的「字段白名单 + 标量类型断言」工具。
// 背景：部分读函数把客户端字段直接拼进 .where()，攻击者可塞入对象/RegExp/命令对象
// 导致查询报错或异常匹配。此函数只保留白名单内的 key，且只接受标量值
// （string/number/boolean/null），把其余一律丢弃——非破坏性地收敛查询面。
// 用法：const safe = sanitizeQuery(event, ['schoolId', 'categoryId'])
//       db.collection('x').where(safe)
function sanitizeQuery(input, allowedKeys) {
  const out = {}
  if (!input || typeof input !== 'object' || !Array.isArray(allowedKeys)) return out
  for (const k of allowedKeys) {
    const v = input[k]
    if (v === undefined) continue
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v
    }
  }
  return out
}

module.exports = { cloud, initCloud, getCloud, getDB, getCmd, isDuplicateKeyError, insertIdempotent, sanitizeQuery }
