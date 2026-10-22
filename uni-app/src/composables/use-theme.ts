/**
 * 主题切换（深色 / 浅色）。
 *
 * 设计约束：全站颜色都走 tokens.scss 的 CSS 变量，浅色主题早已定义在
 * `[data-theme='light']` 下，但此前没有任何代码去设置这个属性 —— 浅色主题写了等于没写。
 * 这里负责把选择落到 DOM 并持久化。
 *
 * 平台差异：
 *  - H5：直接给 document.documentElement 设 data-theme，CSS 变量立即生效；
 *  - 小程序 / App：没有 document，主题只能通过页面级 class 或 App.vue 的全局状态实现。
 *    当前实现退化为「记住选择但不改变外观」，并在设置页明确提示。
 *    （小程序端做主题切换需给每页根节点绑 class，属独立改造，见 README 待办）
 */
import { ref, watch } from 'vue'

export type ThemeName = 'dark' | 'light'

const STORAGE_KEY = 'campushub.theme'

/** 全局单例：多个页面读到的必须是同一个 ref，否则切换后其他页面不同步 */
const theme = ref<ThemeName>('dark')

let inited = false

const NAV_COLORS: Record<ThemeName, { bg: string; fg: 'white' | 'black' }> = {
  dark: { bg: '#0D110E', fg: 'white' },
  light: { bg: '#F4F2EA', fg: 'black' }
}

function applyToDom(name: ThemeName) {
  // #ifdef H5
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', name)
    // 让浏览器 UI（滚动条、输入框）跟随主题
    document.documentElement.style.colorScheme = name
  }
  // #endif
  const c = NAV_COLORS[name]

  // 原生导航栏：pages.json 里是编译期常量，切主题后必须运行时改写，
  // 否则浅色主题下顶部仍是黑条（实测踩到）。
  // H5 端 uni.setNavigationBarColor 对页面级导航栏无效（样式由 uni-h5 内联渲染），
  // 所以 H5 直接改 DOM；小程序/App 走官方 API。
  // #ifdef H5
  if (typeof document !== 'undefined') {
    const paint = () => {
      const heads = document.querySelectorAll('.uni-page-head')
      heads.forEach((el: any) => {
        el.style.backgroundColor = c.bg
        el.style.color = c.fg === 'white' ? '#ffffff' : '#000000'
        el.querySelectorAll('.uni-page-head__title, .uni-page-head-btn').forEach((t: any) => {
          t.style.color = c.fg === 'white' ? '#ffffff' : '#000000'
        })
        // 返回箭头是 svg，用 currentColor 时跟随父级
        el.querySelectorAll('svg').forEach((svg: any) => {
          svg.style.color = c.fg === 'white' ? '#ffffff' : '#000000'
          svg.querySelectorAll('path').forEach((pth: any) => {
            pth.setAttribute('fill', c.fg === 'white' ? '#ffffff' : '#000000')
          })
        })
      })
    }
    paint()
    // 新页面挂载后再刷一次（导航栏是每次页面创建时渲染的）
    setTimeout(paint, 60)
    setTimeout(paint, 320)
    // 路由切换时重绘
    if (!(globalThis as any).__themeNavHooked) {
      ;(globalThis as any).__themeNavHooked = true
      window.addEventListener('hashchange', () => setTimeout(paint, 80))
    }
  }
  // #endif
  // #ifndef H5
  uni.setNavigationBarColor({
    frontColor: c.fg === 'white' ? '#ffffff' : '#000000',
    backgroundColor: c.bg,
    fail: () => {
      /* 页面未就绪时忽略 */
    }
  })
  // #endif
}

function initTheme() {
  if (inited) return
  inited = true
  try {
    const saved = uni.getStorageSync(STORAGE_KEY)
    // uni.setStorageSync 会把字符串包成 {type:'string', data:'...'}
    const raw = saved && typeof saved === 'object' && 'data' in saved ? (saved as any).data : saved
    if (raw === 'light' || raw === 'dark') theme.value = raw
  } catch {
    /* 存储不可用则用默认深色 */
  }
  applyToDom(theme.value)

  watch(theme, (v) => {
    applyToDom(v)
    try {
      uni.setStorageSync(STORAGE_KEY, v)
    } catch {
      /* 存不了不影响本次会话 */
    }
  })
}

export function useTheme() {
  initTheme()
  return {
    theme,
    setTheme(v: ThemeName) {
      theme.value = v
    }
  }
}
