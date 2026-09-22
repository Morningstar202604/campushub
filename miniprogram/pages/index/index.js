// pages/index/index.js
const app = getApp()
const { callFunction } = require('../../utils/request.js')
const { ensureLogin, firstChar } = require('../../utils/auth.js')
const { getCache, setCache } = require('../../utils/cache.js')
const { PAGE_SIZE } = require('../../config/constants.js')
const eventBus = require('../../utils/eventBus.js')

// 首屏缓存：TTL 5 分钟；下拉刷新/发布后强制走网络并回写缓存（降本 C2）
const FEED_CACHE_KEY = 'index_feed_v1'
const FEED_CACHE_TTL = 5 * 60 * 1000

Page({
  data: {
    tabs: [
      { key: 'recommend', name: '推荐' },
      { key: 'hot', name: '热门' },
      { key: 'latest', name: '最新' }
    ],
    activeTab: 'recommend',
    leftList: [],
    rightList: [],
    page: 1,
    hasMore: true,
    loading: false,
    showPublishMenu: false,
    // 分类筛选（多级目录，传节点 id 即可按任意层级筛选）
    selectedCategoryId: '',
    selectedCategoryName: '',
    showCatPicker: false,
    loadFail: false,
    showBackTop: false,
    announcements: [],
    schoolId: ''
  },

  onLoad() {
    // 多校：记录初始校区，避免 onShow 首次误判为"变化"触发回源
    this.syncSchool()
    // 首屏：列表 + 公告并行加载，统一 await 后再分别 setData（减少空态闪烁）
    Promise.all([
      this.loadList(true),
      this.loadAnnouncements()
    ]).catch(() => {})
    // 事件总线：发布成功后刷新（替代全局 needRefresh 标志被首个消费页清零的竞态）
    this._onDataChanged = (payload) => {
      if (payload && (payload.type === 'post' || payload.type === 'all')) {
        this.setData({ page: 1, leftList: [], rightList: [], hasMore: true })
        this.loadList(true, { force: true })
      }
    }
    eventBus.on('data-changed', this._onDataChanged)
  },

  onUnload() {
    if (this._onDataChanged) eventBus.off('data-changed', this._onDataChanged)
  },

  // 同步 globalData 的校区过滤；返回是否有变化（抄自 market 的脏检查模式）
  syncSchool() {
    const userInfo = app.globalData.userInfo
    const schoolId = (userInfo && userInfo.schoolId) || ''
    if (schoolId !== this.data.schoolId) {
      this.setData({ schoolId })
      return true
    }
    return false
  },

  loadAnnouncements() {
    callFunction('announcement', { action: 'list' })
      .then(res => {
        if (res.success && res.list && res.list.length) {
          this.setData({ announcements: res.list.slice(0, 3) })
        }
      })
      .catch(() => { /* 公告拉取失败静默，不阻塞首页 */ })
  },

  onAnnouncementTap(e) {
    const idx = e.currentTarget.dataset.index
    const item = this.data.announcements[idx]
    if (!item) return
    wx.showModal({
      title: item.title,
      content: item.content,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  onShow() {
    // 校区变化（切换账号/校区）才回源，避免每次 onShow 无谓刷新
    if (this.syncSchool()) {
      this.setData({ page: 1, leftList: [], rightList: [], hasMore: true })
      this.loadList(true, { force: true })
    }
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

  /**
   * 将接口返回的 items 水合成双列瀑布流数据
   */
  applyItems(items) {
    const hydrated = items.map((item) => ({
      ...item,
      itemType: 'post',
      userNicknameFirst: firstChar(item.userNickname),
      tags: item.tags || [],
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
    // 竞态防护：翻页受 loading 守卫；reset（切tab/下拉/刷新）允许打断在途请求，
    // 旧响应回来后凭序号丢弃，不会污染新视图
    if (this.data.loading && !reset) return
    this._seq = (this._seq || 0) + 1
    const seq = this._seq
    this.setData({ loading: true })

    const force = !!opts.force
    const isFeedFirstPage = reset && this.data.activeTab === 'recommend' && !this.data.selectedCategoryId

    // 首屏缓存命中：直接渲染，跳过本次网络请求（下拉刷新强制绕过）
    if (isFeedFirstPage && !force) {
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
        tab: this.data.activeTab,
        page: reset ? 1 : this.data.page,
        pageSize: PAGE_SIZE,
        categoryId: this.data.selectedCategoryId || undefined
      }

      const res = await callFunction('post-list', params)
      if (seq !== this._seq) { wx.stopPullDownRefresh(); return } // 旧请求晚到，丢弃

      if (res.success && res.list) {
        if (isFeedFirstPage) {
          // 只缓存无筛选的推荐流第一页
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

  onTabChange(e) {
    const key = e.currentTarget.dataset.key
    if (key === this.data.activeTab) return
    this.setData({
      activeTab: key,
      leftList: [],
      rightList: [],
      page: 1,
      hasMore: true
    })
    this.loadList(true)
  },

  onPostTap(e) {
    wx.navigateTo({
      url: `/pages/post-detail/post-detail?id=${e.currentTarget.dataset.id}`
    })
  },

  // 图片加载失败兜底
  onImgError(e) {
    const { side, index } = e.currentTarget.dataset
    if (side === undefined || index === undefined) return
    this.setData({ [`${side}List[${index}]._coverFail`]: true })
  },
  onAvatarError(e) {
    const { side, index } = e.currentTarget.dataset
    if (side === undefined || index === undefined) return
    this.setData({ [`${side}List[${index}]._avatarFail`]: true })
  },

  goSearch() {
    wx.navigateTo({ url: '/pages/search/search' })
  },

  // 打开分类筛选（多级目录）
  onCategoryTap() {
    this.setData({ showCatPicker: true })
  },
  onCatSelect(e) {
    const { categoryId, categoryName } = e.detail
    this.setData({
      selectedCategoryId: categoryId,
      selectedCategoryName: categoryName,
      showCatPicker: false,
      page: 1, leftList: [], rightList: [], hasMore: true
    })
    this.loadList(true)
  },
  onCatClose() {
    this.setData({ showCatPicker: false })
  },
  clearCategory() {
    if (!this.data.selectedCategoryId) return
    this.setData({
      selectedCategoryId: '',
      selectedCategoryName: '',
      page: 1, leftList: [], rightList: [], hasMore: true
    })
    this.loadList(true)
  },

  goExpired() {
    wx.navigateTo({ url: '/pages/expired/expired' })
  },

  goWall() {
    wx.navigateTo({ url: '/pages/wall/wall' })
  },

  goLostFound() {
    wx.navigateTo({ url: '/pages/lost-found/lost-found' })
  },

  goPublish() {
    if (!ensureLogin()) return
    this.setData({ showPublishMenu: true })
  },

  togglePublishMenu() {
    this.setData({ showPublishMenu: false })
  },

  onPublishSelect(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ showPublishMenu: false })

    if (type === 'post') {
      wx.navigateTo({ url: '/pages/post-publish/post-publish' })
    } else if (type === 'product') {
      wx.navigateTo({ url: '/pages/product-publish/product-publish' })
    } else if (type === 'lostfound') {
      this.goLostFound()
    } else if (type === 'confession') {
      if (ensureLogin()) {
        wx.navigateTo({ url: '/pages/post-publish/post-publish?kind=confession' })
      }
    }
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
    return { title: 'CampusHub 校园社区，看看新鲜事', path: '/pages/index/index' }
  }
})
