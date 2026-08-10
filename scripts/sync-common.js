#!/usr/bin/env node
/**
 * sync-common.js — 将 cloudfunctions/common/ 下的共享内核同步进每个云函数目录。
 *
 * 为什么需要它：
 *   微信云开发的每个云函数是独立部署单元，无法直接 require 父级目录。
 *   因此采用"单一事实来源(common/) + 部署前同步复制"的方式：
 *   - 共享逻辑只维护一份；
 *   - 各函数目录内自带副本，可直接上传部署，无需依赖特殊环境。
 *
 * 用法：
 *   node scripts/sync-common.js
 * 建议在"上传部署云函数"之前执行（npm run sync:common）。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const COMMON_DIR = path.join(ROOT, 'cloudfunctions', 'common')
const FUNC_DIR = path.join(ROOT, 'cloudfunctions')

const COMMON_PREFIX = 'common-' // 共享文件统一前缀，避免覆盖函数自身 index.js

function main() {
  if (!fs.existsSync(COMMON_DIR)) {
    console.error('未找到 cloudfunctions/common 目录')
    process.exit(1)
  }

  const commonFiles = fs.readdirSync(COMMON_DIR)
    .filter(f => f.startsWith(COMMON_PREFIX) && f.endsWith('.js'))

  if (commonFiles.length === 0) {
    console.error('common 目录下没有匹配', COMMON_PREFIX, '的共享文件')
    process.exit(1)
  }

  const funcDirs = fs.readdirSync(FUNC_DIR).filter(name => {
    const full = path.join(FUNC_DIR, name)
    return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'package.json'))
  })

  let copied = 0
  for (const dir of funcDirs) {
    for (const file of commonFiles) {
      const src = path.join(COMMON_DIR, file)
      const dest = path.join(FUNC_DIR, dir, file)
      fs.copyFileSync(src, dest)
      copied++
    }
  }

  console.log(`已同步 ${commonFiles.length} 个共享文件 → ${funcDirs.length} 个云函数（共 ${copied} 次复制）`)
}

main()
