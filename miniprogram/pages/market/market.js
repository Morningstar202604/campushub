// pages/market/market.js
// 二手市场独立 tab 页：商品瀑布流 + 首页缓存 + 发布入口
const app = getApp()
const { callFunction } = require('../../utils/request.js')
const { ensureLogin, firstChar } = require('../../utils/auth.js')
const { getCache, setCache } = require('../../utils/cache.js')

// 首屏缓存：TTL 3 分钟；下拉刷新强制回源（降本 C2）
const FEED_CACHE_KEY = 'market_feed_v1'
const FEED_CACHE_TTL = 3 * 60 * 1000
const PAGE_SIZE = 20

Page({
  data: {
    leftList: [],
    rightList: [],
    page: 1,
    hasMore: true,
    loading: false,
    loadFail: false,
    showBackTop: false,
    schoolId: ''
  },

  onLoad() {
    this.syncSchool()
    this.loadList(true)
  },

  onShow() {
    // 登录/切换校区后 schoolId 变化：重置并强制回源（tab 页 onLoad 只走一次）
    if (this.syncSchool()) {
      this.setData({ page: 1, leftList: [], rightList: [], hasMore: true })
      this.loadList(true, { force: true })
      return
    }
    if (app.globalData.needRefresh) {
      app.globalData.needRefresh = false
      this.setData({ page: 1, leftList: [], rightList: [], hasMore: true })
      this.loadList(true, { force: true })
    }
  },

  // 同步 globalData 的校区过滤；返回是否有变化
  syncSchool() {
    const userInfo = app.globalData.userInfo
    const schoolId = (userInfo && userInfo.schoolId) || ''
    if (schoolId !== this.data.schoolId) {
      this.setData({ schoolId })
      return true
    }
    return false
  },

  onPullDownRefresh() {
    this.setData({ page: 1, leftList: [], rightList: [], hasMore: true })
    this.loadList(true, { force: true })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadList()
    }
  },

  getConditionText(condition) {
    const map = {
      'new': '全新',
      'almost_new': '几乎全新',
      'good': '8成新',
      'fair': '5成新'
    }
    return map[condition] || ''
  },

  applyItems(items) {
    const hydrated = items.map((item) => ({
      ...item,
      userNicknameFirst: firstChar(item.userNickname),
      conditionText: this.getConditionText(item.condition),
      images: item.images || []
    }))

    const leftList = [...this.data.leftList]
    const rightList = [...this.data.rightList]
    hydrated.forEach((item) => {
      if ((leftList.length + rightList.length) % 2 === 0) {
        leftList.push(item)
      } else {
        rightList.push(item)
      }
    })
    return { leftList, rightList }
  },

  async loadList(reset = false, opts = {}) {
    // 竞态防护：与首页一致——reset 可打断在途请求，旧响应凭序号丢弃
    if (this.data.loading && !reset) return
    this._seq = (this._seq || 0) + 1
    const seq = this._seq
    this.setData({ loading: true })

    const force = !!opts.force

    // 首屏缓存命中（仅无校区过滤时使用，避免串校数据）
    if (reset && !force && !this.data.schoolId) {
      const cachedItems = getCache(FEED_CACHE_KEY)
      if (cachedItems && cachedItems.length) {
        const lists = this.applyItems(cachedItems)
        this.setData({
          ...lists,
          page: 2,
          hasMore: cachedItems.length >= PAGE_SIZE,
          loading: false,
          loadFail: false
        })
        wx.stopPullDownRefresh()
        return
      }
    }

    try {
      const params = {
        page: reset ? 1 : this.data.page,
        pageSize: PAGE_SIZE
      }
      if (this.data.schoolId) params.schoolId = this.data.schoolId

      const res = await callFunction('product-list', params)
      if (seq !== this._seq) { wx.stopPullDownRefresh(); return } // 旧请求晚到，丢弃

      if (res.success && res.list) {
        if (reset && !this.data.schoolId) {
          setCache(FEED_CACHE_KEY, res.list, FEED_CACHE_TTL)
        }
        const lists = this.applyItems(res.list)
        this.setData({
          ...lists,
          hasMore: res.hasMore,
          page: (reset ? 1 : this.data.page) + 1,
          loading: false,
          loadFail: false
        })
      } else {
        this.setData({ loading: false, loadFail: this.data.leftList.length === 0 && this.data.rightList.length === 0 })
      }
    } catch (err) {
      if (seq !== this._seq) { wx.stopPullDownRefresh(); return }
      console.error('加载失败', err)
      this.setData({ loading: false, loadFail: this.data.leftList.length === 0 && this.data.rightList.length === 0 })
      wx.showToast({ title: '加载失败，请检查网络', icon: 'none' })
    }

    wx.stopPullDownRefresh()
  },

  onProductTap(e) {
    wx.navigateTo({
      url: `/pages/product-detail/product-detail?id=${e.currentTarget.dataset.id}`
    })
  },

  goSearch() {
    wx.navigateTo({ url: '/pages/search/search' })
  },

  goPublish() {
    if (!ensureLogin()) return
    wx.navigateTo({ url: '/pages/product-publish/product-publish' })
  },
  reloadList() {
    if (this.data.loading) return
    this.setData({ loadFail: false })
    this.loadList(true)
  },

  onPageScroll(e) {
    const show = (e.scrollTop || 0) > 600
    if (show !== this.data.showBackTop) this.setData({ showBackTop: show })
  },

  goBackTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 })
  },

  onShareAppMessage() {
    return { title: '二手市场 · 来淘点好物', path: '/pages/market/market' }
  }
})
