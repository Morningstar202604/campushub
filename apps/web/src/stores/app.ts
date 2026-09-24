import { defineStore } from 'pinia'
import { USE_MOCK } from '@/lib/mock'
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
      if (USE_MOCK) {
        this.categories = await fetchCategories()
        return this.categories
      }
      try {
        this.categories = await fetchCategories()
      } catch (e: any) {
        console.warn('[app] 分类加载失败', e?.message)
      }
      return this.categories
    },
    async loadAnnouncements() {
      if (USE_MOCK) {
        this.announcements = await fetchAnnouncements()
        return this.announcements
      }
      try {
        this.announcements = await fetchAnnouncements()
      } catch (e: any) {
        console.warn('[app] 公告加载失败', e?.message)
      }
      return this.announcements
    }
  }
})
