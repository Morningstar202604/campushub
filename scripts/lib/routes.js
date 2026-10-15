// scripts/lib/routes.js — 业务入口 → 源码/部署单元 的解析（唯一事实来源：gateway-routes.json）
// 云函数收敛为资源型网关后，任何"按 cloudfunctions/<入口名>/ 找文件"的假设都会失效。
// 生产脚本（doctor / contract-check）与测试必须共用这一份解析逻辑，避免各写一套而各自出错。
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const CF = path.join(ROOT, 'cloudfunctions')
const ROUTE_FILE = path.join(ROOT, 'gateway-routes.json')

function load() {
  const raw = JSON.parse(fs.readFileSync(ROUTE_FILE, 'utf8'))
  return raw
}

function unitNames() {
  return Object.keys(load().routes).sort()
}
function deployNames() {
  return [...new Set(Object.values(load().routes))].sort()
}
function deployOf(unit) {
  const t = load().routes[unit]
  if (!t) throw new Error(`入口未登记进 gateway-routes.json：${unit}`)
  return t
}
/** 入口源码：直连函数为 index.js；网关成员为 handlers/<unit>.js */
function sourceFile(unit) {
  const t = deployOf(unit)
  return t === unit ? path.join(CF, unit, 'index.js') : path.join(CF, t, 'handlers', `${unit}.js`)
}
/** 部署目录（含 package.json / config.json 的那一层） */
function deployDir(unit) {
  return path.join(CF, deployOf(unit))
}
function readSource(unit) {
  return fs.readFileSync(sourceFile(unit), 'utf8')
}

module.exports = {
  ROOT,
  CF,
  ROUTE_FILE,
  load,
  unitNames,
  deployNames,
  deployOf,
  sourceFile,
  deployDir,
  readSource
}
