/**
 * 主题切换（深色 / 浅色）。
 *
 * 设计约束：全站颜色都走 tokens.scss 的 CSS 变量，浅色主题早已定义在
 * `[data-theme='light']` 下，但此前没有任何代码去设置这个属性 —— 浅色主题写了等于没写。
 * 这里负责把选择落到 DOM 并持久化。
 *
 * 平台差异：
 *  - H5：给 document.documentElement 设 data-theme，`[data-theme='light']` 的 CSS 变量立即生效；
 *  - 小程序 / App：没有 document，WXSS 也不支持属性选择器，页面内容仍是深色令牌；
 *    但原生导航栏与 tabBar 会经 uni.setNavigationBarColor / setTabBarStyle 跟随主题。
 *    页面内容跟随主题需逐页根节点绑 class（26 个页面），未在本轮范围内。
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

/**
 * 底部 tabBar 配色。pages.json 里写死的是深色，切浅色后底部还是一条黑带，
 * 与页面割裂。H5 端 tabBar 是 uni-h5 渲染的 DOM（内联背景色 + 黑色 border），
 * 只能运行时改写；文字/图标颜色通过 uni.setTabBarStyle 改（该 API H5 支持）。
 */
const TAB_COLORS: Record<ThemeName, { bg: string; border: string; color: string; selected: string }> =
  {
    dark: { bg: '#0D110E', border: 'rgba(0,0,0,0.33)', color: '#9AA39A', selected: '#C8F135' },
    light: { bg: '#F4F2EA', border: 'rgba(0,0,0,0.10)', color: '#6B7268', selected: '#5E7A10' }
  }

/**
 * 当前生效主题（供 H5 导航栏重绘读取）。
 * 必须放模块级而不是闭包捕获：hashchange 监听器只注册一次，
 * 若它闭包捕获首次的 paint，切到浅色后每次路由跳转都会被旧的深色重绘覆盖回去
 * （实测现象：设置页切浅色 → 回首页，导航栏又变黑）。
 */
let activeTheme: ThemeName = 'dark'

function paintNavH5() {
  const c = NAV_COLORS[activeTheme]
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

function paintTabBarH5() {
  if (typeof document === 'undefined') return
  const t = TAB_COLORS[activeTheme]
  const bar = document.querySelector('.uni-tabbar')
  if (!bar) return
  ;(bar as any).style.backgroundColor = t.bg
  const border = bar.querySelector('.uni-tabbar-border')
  if (border) (border as any).style.backgroundColor = t.border
  // 文字色：uni-h5 把颜色内联在 .uni-tabbar__label 上
  bar.querySelectorAll('.uni-tabbar__label').forEach((el: any) => {
    const isOn = el.closest('.uni-tabbar__item')?.classList.contains('uni-tabbar__item--active')
    el.style.color = isOn ? t.selected : t.color
  })
}

function applyToDom(name: ThemeName) {
  activeTheme = name
  // #ifdef H5
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', name)
    // 让浏览器 UI（滚动条、输入框）跟随主题
    document.documentElement.style.colorScheme = name
  }
  // #endif

  // 原生导航栏：pages.json 里是编译期常量，切主题后必须运行时改写，
  // 否则浅色主题下顶部仍是黑条（实测踩到）。
  // H5 端 uni.setNavigationBarColor 对页面级导航栏无效（样式由 uni-h5 内联渲染），
  // 所以 H5 直接改 DOM；小程序/App 走官方 API。
  // #ifdef H5
  if (typeof document !== 'undefined') {
    paintNavH5()
    paintTabBarH5()
    // 新页面挂载后再刷一次（导航栏是每次页面创建时渲染的）
    setTimeout(() => {
      paintNavH5()
      paintTabBarH5()
    }, 60)
    setTimeout(() => {
      paintNavH5()
      paintTabBarH5()
    }, 320)
    // 路由切换时重绘（两个 paint 都读模块级 activeTheme，永远用最新主题）
    if (!(globalThis as any).__themeNavHooked) {
      ;(globalThis as any).__themeNavHooked = true
      window.addEventListener('hashchange', () =>
        setTimeout(() => {
          paintNavH5()
          paintTabBarH5()
        }, 80)
      )
    }
  }
  // #endif
  // #ifndef H5
  {
    const c = NAV_COLORS[name]
    uni.setNavigationBarColor({
      frontColor: c.fg === 'white' ? '#ffffff' : '#000000',
      backgroundColor: c.bg,
      fail: () => {
        /* 页面未就绪时忽略 */
      }
    })
    const t = TAB_COLORS[name]
    uni.setTabBarStyle({
      backgroundColor: t.bg,
      color: t.color,
      selectedColor: t.selected,
      borderStyle: name === 'dark' ? 'black' : 'white',
      fail: () => {
        /* 非 tabBar 页面调用会失败，忽略 */
      }
    })
  }
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
