#!/usr/bin/env node
// scripts/gen-gateways.js — 从 gateway-routes.json 生成资源型网关（单一事实来源）
//
// 为什么需要它：云函数数量有配额（微信云开发 50 个），而 37 个细粒度函数还带来
// 37 份部署配置、37 次冷启动、逐个声明 openapi 权限的负担。收敛为按资源分组的网关后，
// 可调用单元不变（前端仍用原函数名寻址），部署单元变少。
//
// 关键约束：
//  - 业务逻辑只有一份源码：迁移是"移动 + 改导出形态"，不是复制。旧函数目录会被删除。
//  - 网关入口、权限声明、前端路由表全部由本脚本从路由表推导；手改生成物会被 --check 拦下。
//  - 定时触发器（task-expire / backup-db）与 init-db 保持独立函数：触发器绑定在函数上，
//    且它们由控制台/定时器调用，没有前端调用点，塞进网关只会让绑定更难核对。
//
// 用法：node scripts/gen-gateways.js          迁移 + 生成
//       node scripts/gen-gateways.js --check  只校验生成物是否与路由表一致（CI/gate 用）
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const CF = path.join(ROOT, 'cloudfunctions')
const ROUTE_FILE = path.join(ROOT, 'gateway-routes.json')
const FE_ROUTE_FILE = path.join(ROOT, 'uni-app', 'src', 'config', 'gateway-routes.ts')
const CHECK_ONLY = process.argv.includes('--check')

const routes = JSON.parse(fs.readFileSync(ROUTE_FILE, 'utf8')).routes
const SDK_DEP = { 'wx-server-sdk': '~2.6.3' }

function members(gw) {
  return Object.keys(routes)
    .filter((k) => routes[k] === gw && k !== gw)
    .sort()
}
function gateways() {
  return [...new Set(Object.values(routes))].filter((gw) => members(gw).length).sort()
}
function standalones() {
  return Object.keys(routes)
    .filter((k) => routes[k] === k)
    .sort()
}

/** 扫描一段代码，推导它运行时会用到的 openapi */
function apisIn(code) {
  const need = new Set()
  for (const m of code.matchAll(/cloud\.openapi\.([a-zA-Z]+\.[a-zA-Z]+)/g)) need.add(m[1])
  if (/await\s+checkContents?\(/.test(code)) need.add('security.msgSecCheck')
  if (/await\s+checkImages?\(|await\s+checkImage\(/.test(code)) need.add('security.imgSecCheck')
  if (/sendSubscribe\(/.test(code)) need.add('subscribeMessage.send')
  return need
}

function routerSource(gw, list) {
  const table = list.map((n) => `  '${n}': require('./handlers/${n}'),`).join('\n')
  return `// cloudfunctions/${gw}/index.js
// ⚠️ 自动生成，请勿手改：唯一事实来源是仓库根目录 gateway-routes.json
//    改路由表后执行 npm run gen:gateways；手改会被 npm run gate 的 --check 拦下。
//
// 网关只做三件事：按 event.fn 分发、拒绝未登记的 fn、把请求原样交给 handler。
// 鉴权 / 限频 / 内容安全全部留在各 handler 内部 —— 收敛部署单元不等于收敛校验点。
// 客户端直连网关，getWXContext().OPENID 仍是真实用户身份（不经云函数转发，不存在身份丢失）。
const { fail } = require('./common-bundle')

const HANDLERS = {
${table}
}

exports.main = async (event, context) => {
  const fn = event && event.fn
  const handler = typeof fn === 'string' ? HANDLERS[fn] : undefined
  if (!handler) {
    // 明确错误码：前端可据此区分"调用方传错"与"服务异常"
    return fail('不支持的操作', 'UNKNOWN_FUNCTION')
  }
  return handler(event, context)
}
`
}

function feRoutesSource() {
  const entries = Object.keys(routes)
    .sort()
    .map((k) => `  '${k}': '${routes[k]}',`)
    .join('\n')
  return `// uni-app/src/config/gateway-routes.ts
// ⚠️ 自动生成，请勿手改：唯一事实来源是仓库根目录 gateway-routes.json（npm run gen:gateways）
// 页面层继续用原函数名调用 callFunction；本表只决定"这个入口落在哪个云函数上"。
// useGateway=false 时全部走原名直连 —— 灰度与回滚开关，无需回滚代码。

export const USE_GATEWAY = ${JSON.stringify(!!JSON.parse(fs.readFileSync(ROUTE_FILE, 'utf8')).useGateway)}

/** 原函数名 → 实际部署的云函数名（等于原名时为直连） */
export const GATEWAY_ROUTES: Record<string, string> = {
${entries}
}

export function resolveTarget(name: string): string {
  if (!USE_GATEWAY) return name
  return GATEWAY_ROUTES[name] || name
}

/** 命中网关时注入 fn，让网关知道要分发给哪个 handler；直连时保持原样 */
export function buildPayload(name: string, data: any): any {
  const target = resolveTarget(name)
  if (target === name) return data || {}
  return { ...(data || {}), fn: name }
}
`
}

// 生成物先过一遍 Prettier 再落盘/比对：格式规范归 Prettier 说了算。
// 否则生成器写 'admin': require(...)，Prettier 改成 admin: require(...)，
// 两个工具会就着同一个文件互相"打架"，--check 永远红 —— 这不是代码问题，是口径重复。
async function formatWithPrettier(file, content) {
  if (!/\.(js|ts)$/.test(file)) return content
  let prettier
  try {
    prettier = require('prettier')
  } catch {
    return content // 未安装 devDeps 时保持原样（gate 会因 format 步骤另行报错）
  }
  // 必须显式解析仓库配置：只传 filepath 时 v3 并未按预期吃到 .prettierrc，
  // 生成器就会按默认（双引号 + 分号 + 尾逗号）落盘，与 `npm run format` 长期互相判红。
  const resolved = (await prettier.resolveConfig(file)) || {}
  return prettier.format(content, { ...resolved, filepath: file })
}

async function writeIfChanged(file, content) {
  const formatted = await formatWithPrettier(file, content)
  if (CHECK_ONLY) {
    const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
    if (cur !== formatted) throw new Error(`生成物与路由表不一致：${path.relative(ROOT, file)}`)
    return
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, formatted)
}

function migrateMember(gw, name) {
  const legacyDir = path.join(CF, name)
  const handlerFile = path.join(CF, gw, 'handlers', `${name}.js`)
  if (CHECK_ONLY) {
    // 校验模式只读：handler 必须已就位，否则说明忘了跑 gen:gateways
    if (!fs.existsSync(handlerFile))
      throw new Error(`${gw}/handlers/${name}.js 缺失，请执行 npm run gen:gateways`)
    if (fs.existsSync(legacyDir))
      throw new Error(`旧函数目录 ${name}/ 未清理，业务逻辑会出现两份源码`)
    return
  }
  if (fs.existsSync(handlerFile)) return
  const legacyIndex = path.join(legacyDir, 'index.js')
  if (!fs.existsSync(legacyIndex)) {
    throw new Error(`既无 ${handlerFile} 也无 ${legacyIndex}：路由表引用了不存在的入口 ${name}`)
  }
  const code = fs.readFileSync(legacyIndex, 'utf8')
  // 只改导出形态：exports.main = X  →  module.exports = X（分发由网关负责）
  const hits = code.match(/exports\.main\s*=/g) || []
  if (hits.length !== 1)
    throw new Error(`${name}/index.js 的 exports.main 出现 ${hits.length} 次，无法安全迁移`)
  const moved = code.replace(/exports\.main\s*=/, 'module.exports =')
  fs.mkdirSync(path.dirname(handlerFile), { recursive: true })
  fs.writeFileSync(handlerFile, moved)
}

async function main() {
  const gws = gateways()
  let migrated = 0
  for (const gw of gws) {
    for (const name of members(gw)) {
      const had = fs.existsSync(path.join(CF, name, 'index.js'))
      migrateMember(gw, name)
      if (had && !CHECK_ONLY) migrated++
    }
    // 权限并集：从已就位的 handler 源码推导（不引入第二份声明）
    const union = new Set()
    for (const name of members(gw)) {
      for (const a of apisIn(fs.readFileSync(path.join(CF, gw, 'handlers', `${name}.js`), 'utf8')))
        union.add(a)
    }
    await writeIfChanged(path.join(CF, gw, 'index.js'), routerSource(gw, members(gw)))
    await writeIfChanged(
      path.join(CF, gw, 'config.json'),
      JSON.stringify({ permissions: { openapi: [...union].sort() } }, null, 2) + '\n'
    )
    await writeIfChanged(
      path.join(CF, gw, 'package.json'),
      JSON.stringify(
        {
          name: gw,
          version: '1.0.0',
          description: `${gw} 资源网关（自动生成）`,
          main: 'index.js',
          dependencies: SDK_DEP
        },
        null,
        2
      ) + '\n'
    )
  }

  for (const fn of standalones()) {
    if (!fs.existsSync(path.join(CF, fn, 'index.js'))) {
      throw new Error(`独立函数 ${fn} 缺失，但路由表仍把它当作可调用单元`)
    }
  }

  writeIfChanged(FE_ROUTE_FILE, feRoutesSource())

  if (!CHECK_ONLY) {
    // 旧函数目录只有在 handler 已就位后才删除，保证任何时刻都有一份可部署源码
    for (const gw of gws) {
      for (const name of members(gw)) {
        const handlerFile = path.join(CF, gw, 'handlers', `${name}.js`)
        const legacyDir = path.join(CF, name)
        if (fs.existsSync(handlerFile) && fs.existsSync(legacyDir)) {
          fs.rmSync(legacyDir, { recursive: true, force: true })
        }
      }
    }
    console.log(
      `✓ 网关：${gws.length} 个（本轮迁移 handler ${migrated} 个）；独立函数 ${standalones().length} 个；` +
        `部署单元合计 ${gws.length + standalones().length} 个（原 ${Object.keys(routes).length} 个）`
    )
  } else {
    console.log(
      `✓ 网关生成物与 gateway-routes.json 一致（${gws.length} 网关 + ${standalones().length} 独立函数）`
    )
  }
}

function reportFail(e) {
  console.error(`✗ ${e && e.message ? e.message : e}`)
  process.exit(1)
}

try {
  main().catch(reportFail)
} catch (e) {
  reportFail(e)
}
