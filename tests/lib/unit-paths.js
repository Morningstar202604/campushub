// tests/lib/unit-paths.js — 测试侧复用生产脚本的同一份路由解析实现
// 之前测试与脚本各写一套"入口 → 文件"的映射，收敛后会各自出错且互相看不见；
// 这里只做薄封装，解析逻辑唯一来源是 scripts/lib/routes.js（即 gateway-routes.json）。
const path = require('path')
const R = require('../../scripts/lib/routes')

const ROOT = R.ROOT
const CF = R.CF
const DIST = path.join(ROOT, 'dist', 'cloudfunctions')
const ROUTES = R.load().routes

function productFile(unit) {
  return path.join(DIST, R.deployOf(unit), 'index.js')
}
function readProduct(unit) {
  return require('fs').readFileSync(productFile(unit), 'utf8')
}

module.exports = {
  ROOT,
  CF,
  DIST,
  ROUTES,
  unitNames: R.unitNames,
  deployNames: R.deployNames,
  deployOf: R.deployOf,
  sourceFile: R.sourceFile,
  readSource: R.readSource,
  productFile,
  readProduct
}
