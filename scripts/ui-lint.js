#!/usr/bin/env node
/**
 * CampusHub UI 层 lint（ui-lint）
 *
 * 原 WXML/WXSS 检查已随原生小程序客户端退役。本脚本不再是占位符，改为执行
 * 三条在 uni-app 工程上仍然成立、且能真实失败的规则：
 *
 *  1. 隐私接口清单：扫描 uni-app/src 实际调用的隐私接口并打印（提审时照抄到
 *     「用户隐私保护指引」）。清单为空说明扫描失效，判失败。
 *  2. 全局原子类不得在页面里重写：`.empty-state` / `.empty-cta` / `.empty-shape`
 *     / `.empty-title` / `.empty-sub` 由 `styles/global.scss` 唯一定义，页面 `<style>`
 *     里再定义就是重复样式的复发（见 CHANGELOG 0.10.0 / F-003）。
 *  3. 空态禁用 emoji：设计系统铁律「空态用文字海报，不用 emoji」。
 *
 * 用法：node scripts/ui-lint.js
 * 退出码：0 = 通过，1 = 有违规。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'uni-app', 'src')

/** 隐私接口 → 用途（提审勾选依据）。多写一条只是多扫一次，不会误报成"已使用"。 */
const PRIVACY_APIS = [
  ['chooseImage', '发帖/发商品/改头像时选图'],
  ['chooseMedia', '校园认证上传证件照（wx.chooseMedia）'],
  ['saveImageToPhotosAlbum', '保存分享海报到相册'],
  ['getLocation', '按位置筛选内容'],
  ['getPhoneNumber', '手机号快捷登录'],
  ['startRecord', '录音'],
  ['getUserProfile', '获取微信昵称头像']
]

/** 全局原子类：只在 global.scss 定义 */
const GLOBAL_ATOMS = [
  'empty-state',
  'empty-cta',
  'empty-shape',
  'empty-title',
  'empty-sub',
  'empty-kicker'
]

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(vue|ts|js)$/.test(e.name)) out.push(p)
  }
  return out
}

/** 去掉 <script> 里的注释与字符串字面量，避免注释里提到 API 被算作"已使用" */
function stripNonCode(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

function collectPrivacyUsage(files) {
  const used = new Map()
  for (const f of files) {
    const code = stripNonCode(fs.readFileSync(f, 'utf8'))
    for (const [api, purpose] of PRIVACY_APIS) {
      const re = new RegExp(`(?:wx|uni)\\.${api}\\s*\\(`)
      if (re.test(code)) {
        if (!used.has(api)) used.set(api, { purpose, files: [] })
        used.get(api).files.push(path.relative(ROOT, f).split(path.sep).join('/'))
      }
    }
  }
  return used
}

/** 取 SFC 的 <style> 段（只查页面，避免把 global.scss 自己算进去） */
function styleBlocks(src) {
  const out = []
  const re = /<style[^>]*>([\s\S]*?)<\/style>/g
  let m
  while ((m = re.exec(src))) out.push(m[1])
  return out.join('\n')
}

function lintPageAtoms(files) {
  const bad = []
  for (const f of files.filter((x) => x.endsWith('.vue'))) {
    const style = styleBlocks(fs.readFileSync(f, 'utf8'))
    if (!style) continue
    for (const atom of GLOBAL_ATOMS) {
      const re = new RegExp(`\\.${atom}\\s*\\{`)
      if (re.test(style)) {
        bad.push(`${path.relative(ROOT, f).split(path.sep).join('/')} 重定义了全局原子类 .${atom}`)
      }
    }
  }
  return bad
}

function lintEmptyStateEmoji(files) {
  const bad = []
  for (const f of files.filter((x) => x.endsWith('.vue'))) {
    const src = fs.readFileSync(f, 'utf8')
    // 只看空态块内的文本节点
    const re = /<view[^>]*class="[^"]*empty-state[^"]*"[\s\S]*?<\/view>/g
    let m
    while ((m = re.exec(src))) {
      if (EMOJI_RE.test(m[0])) {
        bad.push(`${path.relative(ROOT, f).split(path.sep).join('/')} 的空态含 emoji`)
      }
    }
  }
  return bad
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`✗ 找不到前端源码目录：${SRC}`)
    process.exit(1)
  }
  const files = walk(SRC)
  const problems = []

  console.log('CampusHub UI 层 lint')
  console.log('====================')

  const used = collectPrivacyUsage(files)
  if (used.size === 0) {
    problems.push('隐私接口扫描结果为空：扫描逻辑失效或源码目录不对（提审清单会失真）')
  } else {
    console.log('实际使用的隐私接口（提审时按此勾选「用户隐私保护指引」）：')
    for (const [api, info] of [...used].sort()) {
      console.log(`  - ${api}：${info.purpose}（${info.files.length} 处）`)
    }
  }

  const atoms = lintPageAtoms(files)
  if (atoms.length) problems.push(...atoms)
  else console.log('✓ 全局原子类只在 styles/global.scss 定义')

  const emoji = lintEmptyStateEmoji(files)
  if (emoji.length) problems.push(...emoji)
  else console.log('✓ 空态无 emoji')

  if (problems.length) {
    console.log('\n✗ 发现违规：')
    for (const p of problems) console.log(`  - ${p}`)
    process.exit(1)
  }
  console.log('\n✓ UI 层 lint 通过')
}

main()
