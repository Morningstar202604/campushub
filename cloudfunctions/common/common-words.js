// common-words.js — 本地敏感词库（分级：block / replace / flag）
//
// 为什么需要它：微信 msgSecCheck 只给「通过 / 拒绝」，无法表达「替换后放行」或
// 「先发布、进人审队列」。社区运营真正需要的是可维护的三级词表：
//   block   —— 命中即拒绝发布（与 msgSecCheck 同级，fail-closed）
//   replace —— 命中片段替换为 *，其余内容正常发布
//   flag    —— 内容照常发布，但写一条 reports(source=word_filter) 进审核队列
//
// 词表存 sensitive_words 集合，管理员在管理台维护；内核按 5 分钟缓存读取，
// 避免每次发帖都多打一次数据库。缓存只影响生效延迟，不影响 fail-closed：
// 读词表异常时按「无词表」继续，微信 msgSecCheck 仍是最后一道强制审核。
const { AppError } = require('./common-error')

const CACHE_TTL_MS = 5 * 60 * 1000
const MAX_RULES = 500
const VALID_ACTIONS = ['block', 'replace', 'flag']

let cache = { at: 0, rules: [] }

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function loadRules(db) {
  const now = Date.now()
  if (now - cache.at < CACHE_TTL_MS) return cache.rules
  try {
    const res = await db
      .collection('sensitive_words')
      .where({ status: 'active' })
      .limit(MAX_RULES)
      .get()
    cache = {
      at: now,
      rules: (res.data || [])
        .map((r) => ({
          word: String(r.word || '').trim(),
          action: VALID_ACTIONS.includes(r.action) ? r.action : 'block',
          replacement: String(r.replacement || '').slice(0, 20)
        }))
        .filter((r) => r.word)
        .sort((a, b) => b.word.length - a.word.length)
    }
  } catch (e) {
    console.warn('[words] 词表读取失败，按空词表继续（msgSecCheck 仍生效）:', e && e.message)
    cache = { at: now, rules: [] }
  }
  return cache.rules
}

/** 单段文本筛查：返回 { text, blocked, flags }，不抛错（便于聚合多字段后再决定） */
function screenOne(text, rules) {
  let out = String(text == null ? '' : text)
  const blocked = []
  const flags = []
  for (const rule of rules) {
    const re = new RegExp(escapeRegExp(rule.word), 'gi')
    if (!re.test(out)) continue
    if (rule.action === 'block') {
      blocked.push(rule.word)
      continue
    }
    if (rule.action === 'flag') {
      flags.push(rule.word)
      continue
    }
    const mask = rule.replacement || '*'.repeat(Math.max(2, rule.word.length))
    out = out.replace(re, mask)
  }
  return { text: out, blocked, flags }
}

/**
 * 批量筛查。调用方拿到 texts 后必须用返回值回写字段（替换才真正生效），
 * 若 blocked 非空则必须拒绝发布。
 */
async function screenTexts(db, texts = []) {
  const rules = await loadRules(db)
  const blocked = new Set()
  const flags = new Set()
  const out = (texts || []).map((t) => {
    const r = screenOne(t, rules)
    r.blocked.forEach((w) => blocked.add(w))
    r.flags.forEach((w) => flags.add(w))
    return r.text
  })
  return { texts: out, blocked: [...blocked], flags: [...flags] }
}

/** 批量筛查并在命中 block 时抛错（发布链路统一入口） */
async function enforceTexts(db, texts = []) {
  const r = await screenTexts(db, texts)
  if (r.blocked.length) {
    throw new AppError('内容包含禁止发布的词，请修改后重试', 'CONTENT_RISKY')
  }
  return r
}

/**
 * 命中 flag 规则的内容发布后写审核队列。
 * 复用 reports 集合（source=word_filter），不新增集合，管理台与用户举报同一入口处置。
 * 失败仅告警：审核队列是运营增强，不应阻断用户发布。
 */
async function recordWordFlags(db, { flags = [], targetType, targetId, snippet = '' } = {}) {
  if (!flags.length || !targetId) return
  try {
    await db.collection('reports').add({
      data: {
        targetId,
        targetType,
        reporterId: 'system',
        reason: `敏感词命中：${flags.join('、')}`,
        description: String(snippet || '').slice(0, 120),
        source: 'word_filter',
        status: 'pending',
        createdAt: new Date()
      }
    })
  } catch (e) {
    console.warn('[words] 审核队列写入失败(已忽略):', e && (e.errMsg || e.message))
  }
}

/** 管理台改动词表后清缓存，保证 5 分钟内生效（管理台自己的下一次请求立即生效） */
function invalidateWordCache() {
  cache = { at: 0, rules: [] }
}

module.exports = {
  VALID_ACTIONS,
  screenTexts,
  enforceTexts,
  recordWordFlags,
  invalidateWordCache
}
