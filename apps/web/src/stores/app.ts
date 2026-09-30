import { defineStore } from 'pinia'
import { categories as fetchCategories, announcements as fetchAnnouncements } from '@/api/misc'
import type { Category, Announcement } from '@/types'

export const useAppStore = defineStore('app', {
  state: () => ({
    categories: [] as Category[],
    announcements: [] as Announcement[],
    siteName: import.meta.env.VITE_SITE_NAME || '校园社区'
  }),
  actions: {
    async loadCategories(force = false) {
      if (this.categories.length && !force) return this.categories
      try {
        this.categories = await fetchCategories()
      } catch (e: any) {
        console.warn('[app] 分类加载失败', e?.message)
      }
      return this.categories
    },
    async loadAnnouncements() {
      try {
        this.announcements = await fetchAnnouncements()
      } catch (e: any) {
        console.warn('[app] 公告加载失败', e?.message)
      }
      return this.announcements
    }
  }
})
