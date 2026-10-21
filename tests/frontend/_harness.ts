// frontend 测试引导：用 esbuild（项目已有 devDependency）把源码打成 ESM，
// 解析 '@/' 别名并剔除 uni-app 的条件编译宏，使 Node 能直接加载真实模块。
//
// 为什么要这么做：前端 10769 行代码此前 0 条测试，导致「分页方向写反」这种
// 影响 8 个页面的缺陷在 96 个绿灯下存活了很久。绕过 @/ 别名是唯一的技术障碍，
// 用 esbuild 解决它，而不是靠「读源码字符串」糊弄过去。
import { build } from 'esbuild'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const SRC = path.resolve(__dirname, '..', '..', 'uni-app', 'src')

const UNI_STUBS = {
  name: 'uni-stubs',
  setup(build) {
    // pinia / uni 运行时 / cloudbase：测试里不需要真实实现，统一桩掉
    build.onResolve({ filter: /^pinia$/ }, () => ({ path: 'pinia-stub', namespace: 'stub' }))
    build.onResolve({ filter: /^@dcloudio\/uni-app$/ }, () => ({
      path: 'uni-app-stub',
      namespace: 'stub'
    }))
    build.onResolve({ filter: /^@cloudbase\/js-sdk$/ }, () => ({
      path: 'cloudbase-stub',
      namespace: 'stub'
    }))
    // vue 只提供被测代码用到的最小响应式 API（ref/computed/isRef/nextTick）
    build.onResolve({ filter: /^vue$/ }, () => ({ path: 'vue-stub', namespace: 'stub' }))
    build.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => {
      if (args.path === 'vue-stub') {
        return {
          contents: `
            export function ref(v) {
              const box = { value: v }
              return box
            }
            export function computed(fn) {
              return {
                get value() { return fn() }
              }
            }
            export function isRef(v) {
              return !!v && typeof v === 'object' && 'value' in v
            }
            export function nextTick(fn) { return Promise.resolve().then(fn) }
            export function reactive(o) { return o }
            export function onMounted(fn) { globalThis.__VUE_ONMOUNTED__ = fn }
            export function onUnmounted() {}
            export function watch() {}
            export function toRefs(o) { return o }
          `,
          loader: 'js'
        }
      }
      if (args.path === 'pinia-stub') {
        return {
          contents: `
            const state = {}
            export function defineStore(id, opts) {
              return function useStore() {
                if (!globalThis.__PINIA__[id]) {
                  globalThis.__PINIA__[id] = typeof opts.state === 'function' ? opts.state() : {}
                  for (const [k, fn] of Object.entries(opts.actions || {})) {
                    globalThis.__PINIA__[id][k] = fn.bind(globalThis.__PINIA__[id])
                  }
                }
                return globalThis.__PINIA__[id]
              }
            }
            export function storeToRefs(store) { return store }
          `,
          loader: 'js'
        }
      }
      if (args.path === 'uni-app-stub') {
        return {
          contents: `
            export function onLoad(fn) { globalThis.__UNI_ONLOAD__ = fn }
            export function onShow(fn) { globalThis.__UNI_ONSHOW__ = fn }
            export function onHide() {}
            export function onShareAppMessage() {}
            export function onUnload() {}
          `,
          loader: 'js'
        }
      }
      return {
        contents: `export default { init(){ return {} }, default: {} }; export const init = () => ({})`,
        loader: 'js'
      }
    })
  }
}

/**
 * 打包单个源模块并加载。
 * @param {string} entryRel 相对 uni-app/src 的路径
 * @param {object} define 额外的编译期常量替换
 */
export async function loadModule(entryRel, define = {}) {
  const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-test-'))
  const outfile = path.join(outdir, 'bundle.mjs')

  await build({
    entryPoints: [path.join(SRC, entryRel)],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    outfile,
    logLevel: 'silent',
    // uni-app 条件编译宏：默认按 H5 分支展开（测试关注的是业务逻辑，非平台差异）
    define: {
      'import.meta.env': '{}',
      ...define
    },
    plugins: [UNI_STUBS],
    // 用虚拟模块提供 vue 的 API 子集，而不是 alias 到真实 vue：
    // 真实 vue 的 ESM 入口会连带引入 @vue/compiler-*（依赖 @babel/parser 等），
    // 在干净克隆里解析不到，CI 首次跑就 6 条全红。被测代码只用到 ref/computed 等少数 API。
    alias: {
      '@': SRC,
      vue: 'vue-stub'
    },
    external: ['node:*']
  })

  return import(pathToFileURL(outfile).href)
}

/** 每个测试前重置 pinia 桩状态 */
export function resetStores() {
  globalThis.__PINIA__ = {}
}
