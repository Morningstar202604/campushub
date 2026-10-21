import { defineStore } from 'pinia'
// 静态导入：school.config.js 是编译期常量，没有异步加载的必要。
// 原实现用 `import(...).then()` 且不返回 Promise，导致 App.vue 的 `schoolStore.load()`
// 无法等待 → restore() 调 login 云函数时 envId 仍是空串（首启竞态，小程序端必现）。
import schoolConfig from '@/config/school.config.js'

export const useSchoolStore = defineStore('school', {
  state: () => ({
    envId: '',
    schoolName: '',
    schoolId: '',
    configured: false,
    restToken: '',
    /** 演示模式：envId 为空时用本地数据层（见 utils/api.ts shouldUseDemo） */
    demoMode: true
  }),
  actions: {
    /** 同步加载多校配置（单点注入：只改一份 school.config.js，对应旧仓 miniprogram/config/school.js） */
    load() {
      const c: any = schoolConfig || {}
      this.envId = c.envId || ''
      this.schoolName = c.schoolName || ''
      this.schoolId = c.schoolId || ''
      this.restToken = c.restToken || ''
      this.demoMode = c.demoMode !== false
      this.configured = Boolean(this.envId)
      if (!this.configured && this.demoMode) {
        console.info('[CampusHub] 未配置 envId，已启用本地演示数据（界面可完整浏览；接真实环境请填 src/config/school.config.js）')
      } else if (!this.configured) {
        console.warn('[CampusHub] 未配置 school.config.js（envId 为空）且已关闭演示模式，接口将全部失败')
      }
      return this
    }
  },
  persist: false
})
