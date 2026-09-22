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
 * 指纹机制：
 *   每次同步写入 cloudfunctions/common/.sync-manifest.json，记录每个 common-* 的
 *   SHA-1 哈希与同步时间。doctor / CI 的预同步校验用它快速判定是否漂移。
 *   若 common/ 下的源文件未变，再次同步是幂等的（指纹不变）。
 *
 * 用法：
 *   node scripts/sync-common.js           # 同步
 *   node scripts/sync-common.js --check   # 仅校验漂移，不同步（CI/部署前用）
 * 建议在"上传部署云函数"之前执行（npm run sync:common）。
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..')
const COMMON_DIR = path.join(ROOT, 'cloudfunctions', 'common')
const FUNC_DIR = path.join(ROOT, 'cloudfunctions')
const MANIFEST = path.join(COMMON_DIR, '.sync-manifest.json')

const COMMON_PREFIX = 'common-' // 共享文件统一前缀，避免覆盖函数自身 index.js

function sha1(file) {
  return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex')
}

// SHA-256 指纹（文件不存在返回 null）—— 用于正常同步路径的"复制前漂移告警"
function sha256(file) {
  if (!fs.existsSync(file)) return null
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function listCommonFiles() {
  if (!fs.existsSync(COMMON_DIR)) {
    console.error('未找到 cloudfunctions/common 目录')
    process.exit(1)
  }
  return fs.readdirSync(COMMON_DIR)
    .filter(f => f.startsWith(COMMON_PREFIX) && f.endsWith('.js'))
}

function listFuncDirs() {
  // 显式排除 common 源目录：common/ 是共享内核"源"，不是部署单元。
  // 注意：一旦给 common/ 加了 package.json（作为依赖锁定基准，见档位2改造③），
  // 若不在此排除，common 会被当成"函数目录"，sync 时自我复制 → 死循环/崩溃。
  const dirs = fs.readdirSync(FUNC_DIR).filter(name => {
    if (name === 'common') return false
    const full = path.join(FUNC_DIR, name)
    return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'package.json'))
  })
  return dirs
}

function writeManifest(files) {
  const m = {
    generatedAt: new Date().toISOString(),
    files: files.map(f => ({ name: f, sha1: sha1(path.join(COMMON_DIR, f)) }))
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n')
  return m
}

function main() {
  const checkOnly = process.argv.includes('--check')
  const commonFiles = listCommonFiles()
  if (commonFiles.length === 0) {
    console.error('common 目录下没有匹配', COMMON_PREFIX, '的共享文件')
    process.exit(1)
  }
  const funcDirs = listFuncDirs()

  if (checkOnly) {
    // 漂移校验：读 manifest，对比各函数副本 sha1
    let manifest = null
    if (fs.existsSync(MANIFEST)) {
      try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) } catch (e) { /* ignore */ }
    }
    if (!manifest || !Array.isArray(manifest.files)) {
      console.error('✗ 未找到 .sync-manifest.json（未执行过 sync），无法校验')
      process.exit(1)
    }
    const shaMap = new Map(manifest.files.map(f => [f.name, f.sha1]))
    let drift = 0
    for (const dir of funcDirs) {
      for (const file of commonFiles) {
        const dst = path.join(FUNC_DIR, dir, file)
        const expected = shaMap.get(file)
        if (!expected) { drift++; continue }
        if (!fs.existsSync(dst)) {
          console.error(`✗ 缺失副本：${dir}/${file}`)
          drift++
          continue
        }
        const actual = sha1(dst)
        if (actual !== expected) {
          console.error(`✗ 漂移：${dir}/${file} sha1=${actual} 期望=${expected}`)
          drift++
        }
      }
    }
    if (drift > 0) {
      console.error(`\n检测到 ${drift} 处漂移，请执行：node scripts/sync-common.js`)
      process.exit(1)
    }
    console.log(`✓ 全部 ${funcDirs.length} 个云函数的 common 副本与 manifest 一致（${commonFiles.length} 文件 × ${funcDirs.length} = ${commonFiles.length * funcDirs.length} 副本）`)
    return
  }

  // 正常同步（带复制前漂移告警 + 残留旧文件检测）
  const srcSha = new Map(commonFiles.map(f => [f, sha256(path.join(COMMON_DIR, f))]))
  const srcSet = new Set(commonFiles)
  const drifted = []   // 复制前目标与源 SHA-256 不一致的函数目录
  const orphans = []   // 残留的旧 common-*.js（源已删、目标仍在）

  let copied = 0
  for (const dir of funcDirs) {
    let dirDrift = false
    for (const file of commonFiles) {
      const src = path.join(COMMON_DIR, file)
      const dest = path.join(FUNC_DIR, dir, file)
      const oldDest = sha256(dest)          // 复制前取目标旧指纹
      if (oldDest !== null && oldDest !== srcSha.get(file)) dirDrift = true
      fs.copyFileSync(src, dest)
      copied++
    }
    if (dirDrift) drifted.push(dir)
    // 残留旧 common-*.js（源目录已删该文件、此函数目录还留着）
    for (const existing of fs.readdirSync(path.join(FUNC_DIR, dir))) {
      if (existing.startsWith(COMMON_PREFIX) && existing.endsWith('.js') && !srcSet.has(existing)) {
        orphans.push(`${dir}/${existing}`)
      }
    }
  }
  const m = writeManifest(commonFiles)
  console.log(`已同步 ${commonFiles.length} 个共享文件 → ${funcDirs.length} 个云函数（共 ${copied} 次复制）`)
  console.log(`manifest 写入 ${path.relative(ROOT, MANIFEST)}：${m.files.length} 个文件，SHA1 指纹 + 时间戳`)

  // 复制前漂移告警（复制后统一提示，不阻断；杜绝"静默漂移被上传"）
  if (drifted.length) {
    console.warn(`[sync-common] 警告：${COMMON_PREFIX}*.js 在 ${drifted.length} 个函数目录与源不一致，已强制覆盖：${drifted.join(', ')}`)
  }
  if (orphans.length) {
    console.warn(`[sync-common] 警告：检测到残留旧 ${COMMON_PREFIX}*.js（源已删、目标仍在），请确认是否删除：${orphans.join(', ')}`)
  }
}

main()
