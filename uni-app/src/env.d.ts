/// <reference types="@dcloudio/types" />
/// <reference types="vite/client" />

/**
 * .vue 单文件组件模块声明。
 * 原 env.d.ts 只有一行 DefinePage 类型导出，缺此声明时在未启用 vue-tsc 插件的
 * 编辑器/构建链路下 `import App from './App.vue'` 会报 TS2307。
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

/** uni-app 平台全局对象（uni.xxx）由 @dcloudio/types 声明；此处仅补充项目通用类型 */
export type DefinePage = Record<string, any>
