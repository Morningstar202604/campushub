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
    restToken: ''
  }),
  actions: {
    /** 同步加载多校配置（单点注入：只改一份 school.config.js，对应旧仓 miniprogram/config/school.js） */
    load() {
      const c: any = schoolConfig || {}
      this.envId = c.envId || ''
      this.schoolName = c.schoolName || ''
      this.schoolId = c.schoolId || ''
      this.restToken = c.restToken || ''
      this.configured = Boolean(this.envId)
      if (!this.configured) {
        console.warn('[CampusHub] 未配置 school.config.js（envId 为空），部署新学校前请填入')
      }
      return this
    }
  },
  persist: false
})
