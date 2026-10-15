// build-pipeline.test.js — 部署态内核由构建期内联产生，不再往函数目录复制副本
// 动机（D1 的根因）：sync:common 把 9 个内核复制进 37 个目录（333 份），
// 而 common-bundle.js 运行时 require 的正是这些副本。任何人改了 cloudfunctions/common/
// 却漏跑一次同步，线上就跑旧内核 —— 本轮就是这么踩中的（限频器退化成 fail-open）。
// 复制到 37 个目录是"用一个流程纪律问题换另一个流程纪律问题"。
// 现在的不变式：内核只有一份源码；部署产物 dist/ 由 esbuild 内联生成，产物里不可能有旧内核。
const { test, before } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', 'cloudfunctions')
const DIST = path.resolve(__dirname, '..', 'dist', 'cloudfunctions')

const funcs = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'common' && d.name !== 'node_modules')
  .map((d) => d.name)

before(() => {
  // 产物不入库：先问构建脚本"现有产物是否已经等于当前源码"，只有不一致才重建。
  // 无条件重建会与其他并发读取产物的用例相撞。
  const cwd = path.resolve(__dirname, '..')
  const { spawnSync } = require('child_process')
  const check = spawnSync(process.execPath, ['scripts/build-functions.js', '--check'], {
    cwd,
    encoding: 'utf8'
  })
  if (check.status !== 0) {
    const build = spawnSync(process.execPath, ['scripts/build-functions.js'], {
      cwd,
      encoding: 'utf8'
    })
    if (build.status !== 0) throw new Error(`构建失败：${build.stderr || build.stdout}`)
  }
})

test('函数源码目录里不得存在内核副本（副本存在就意味着会漂移）', () => {
  const copies = []
  for (const fn of funcs) {
    for (const f of fs.readdirSync(path.join(ROOT, fn))) {
      if (/^common-[a-z]+\.js$/.test(f)) copies.push(`${fn}/${f}`)
    }
  }
  assert.deepEqual(copies, [], `仍有 ${copies.length} 份副本：${copies.slice(0, 5).join(', ')} ...`)
})

test('每个函数都必须产出单文件构建产物，且能被 Node 解析', () => {
  for (const fn of funcs) {
    const p = path.join(DIST, fn, 'index.js')
    assert.ok(fs.existsSync(p), `缺少产物 ${fn}/index.js`)
    const code = fs.readFileSync(p, 'utf8')
    assert.doesNotThrow(
      () => new Function('module', 'exports', 'require', code),
      `${fn} 产物语法不可解析`
    )
  }
})

test('产物必须内联当前内核（而不是残留旧副本内容）', () => {
  // post-create 收敛后住在 api-post 网关里，产物按部署单元而非入口名定位
  const U = require('./lib/unit-paths')
  const code = fs.readFileSync(U.productFile('post-create'), 'utf8')
  assert.match(code, /rateLimit 缺少 collection 参数/, '限频 fail-closed 文案未内联')
  assert.match(code, /function resolveCategoryPath/, '分类链推导未内联')
  assert.match(code, /IMAGE_TOO_LARGE/, '图片上限守卫未内联')
})

test('wx-server-sdk 必须保持 external（由云端注入，打进包会破坏云调用）', () => {
  for (const fn of funcs) {
    const code = fs.readFileSync(path.join(DIST, fn, 'index.js'), 'utf8')
    assert.match(code, /require\("wx-server-sdk"\)/, `${fn} 应保留对外部 wx-server-sdk 的 require`)
    assert.equal(/node_modules/.test(code), false, `${fn} 不得把依赖树打进产物`)
  }
})

test('产物必须随附 package.json，云调用权限/定时触发器不得在构建中丢失', () => {
  for (const fn of funcs) {
    assert.ok(
      fs.existsSync(path.join(DIST, fn, 'package.json')),
      `${fn} 缺 package.json（云端装依赖要用）`
    )
    const srcCfg = path.join(ROOT, fn, 'config.json')
    if (fs.existsSync(srcCfg)) {
      const built = JSON.parse(fs.readFileSync(path.join(DIST, fn, 'config.json'), 'utf8'))
      const src = JSON.parse(fs.readFileSync(srcCfg, 'utf8'))
      assert.deepEqual(built, src, `${fn} 的 config.json 未原样带到产物（权限/触发器会丢）`)
    }
  }
})

test('产物体积必须远小于"源码+全部副本"，证明内联而非复制', () => {
  const U = require('./lib/unit-paths')
  const size = fs.statSync(U.productFile('post-create')).size
  // 网关产物承载 7 个 handler，上限放宽到 120KB；仍远小于"每入口一份内核副本"的旧形态
  assert.ok(size < 120 * 1024, `api-post 产物 ${size} 字节异常偏大`)
})
