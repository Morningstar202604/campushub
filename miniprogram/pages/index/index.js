// pages/index/index.js
const app = getApp()
const { callFunction } = require('../../utils/request.js')
const { ensureLogin } = require('../../utils/auth.js')

Page({
  data: {
    tabs: [
      { key: 'recommend', name: '推荐' },
      { key: 'latest', name: '最新' },
      { key: 'products', name: '二手' }
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
    showCatPicker: false
  },

  onLoad() {
    this.loadList(true)
  },

  onShow() {
    if (app.globalData.needRefresh) {
      app.globalData.needRefresh = false
      this.setData({ page: 1, leftList: [], rightList: [], hasMore: true })
      this.loadList(true)
    }
  },

  onPullDownRefresh() {
    this.setData({ page: 1, leftList: [], rightList: [], hasMore: true })
    this.loadList(true)
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadList()
    }
  },

  async loadList(reset = false) {
    if (this.data.loading) return
    this.setData({ loading: true })

    const funcName = this.data.activeTab === 'products' ? 'product-list' : 'post-list'
    
    try {
      const params = {
        tab: this.data.activeTab,
        page: reset ? 1 : this.data.page,
        pageSize: 20
      }
      // 分类筛选只作用于帖子流；二手 tab 用商品自有分类，不传 categoryId
      if (funcName === 'post-list') {
        params.categoryId = this.data.selectedCategoryId || undefined
      } else {
        // 二手 tab：传用户 schoolId（可选）
        const userInfo = app.globalData.userInfo
        if (userInfo && userInfo.schoolId) {
          params.schoolId = userInfo.schoolId
        }
      }

      const res = await callFunction(funcName, params)
      
      if (res.success && res.list) {
        // 为每个 item 添加 itemType 字段，用于区分帖子/商品
        const items = res.list.map(item => {
          const isProduct = this.data.activeTab === 'products'
          return {
            ...item,
            itemType: isProduct ? 'product' : 'post',
            conditionText: this.getConditionText(item.condition),
            // 确保 tags 是数组
            tags: item.tags || [],
            // 确保 images 是数组
            images: item.images || []
          }
        })

        // 分列：奇偶索引分配到左右列
        let leftList = reset ? [] : [...this.data.leftList]
        let rightList = reset ? [] : [...this.data.rightList]
        
        items.forEach((item, idx) => {
          const globalIdx = leftList.length + rightList.length
          if (globalIdx % 2 === 0) {
            leftList.push(item)
          } else {
            rightList.push(item)
          }
        })

        this.setData({
          leftList,
          rightList,
          hasMore: res.hasMore,
          page: (reset ? 1 : this.data.page) + 1,
          loading: false
        })
      } else {
        this.setData({ loading: false })
      }
    } catch (err) {
      console.error('加载失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败，请检查网络', icon: 'none' })
    }
    
    wx.stopPullDownRefresh()
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

  onProductTap(e) {
    wx.navigateTo({
      url: `/pages/product-detail/product-detail?id=${e.currentTarget.dataset.id}`
    })
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
    }
  }
})
