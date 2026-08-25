// components/category-picker/category-picker.js
// 多级分类选择器：分区 → 吧 → 子版块，逐级下钻，必须选到叶子
// 分类树 10 分钟本地缓存（降本 C2），缓存失效时自动回源刷新
const { callFunction } = require('../../utils/request.js')
const { getCache, setCache } = require('../../utils/cache.js')

const CATEGORY_CACHE_KEY = 'category_tree'
const CATEGORY_CACHE_TTL = 10 * 60 * 1000

Component({
  properties: {
    visible: { type: Boolean, value: false }
  },
  data: {
    allCats: null,
    path: [],        // 已选路径（分类对象数组）
    list: [],        // 当前层级可选项（带 hasChild）
    loading: false
  },
  observers: {
    visible(v) { if (v) this.open() }
  },
  methods: {
    async loadCategories() {
      // 命中缓存直接返回
      const cached = getCache(CATEGORY_CACHE_KEY)
      if (cached && cached.length) {
        this.setData({ allCats: cached })
        return
      }
      this.setData({ loading: true })
      try {
        const res = await callFunction('category-list', {})
        if (res && res.success) {
          const list = res.list || []
          setCache(CATEGORY_CACHE_KEY, list, CATEGORY_CACHE_TTL)
          this.setData({ allCats: list })
        }
      } catch (e) {
        console.error('加载分类失败', e)
      }
      this.setData({ loading: false })
    },
    async open() {
      if (!this.data.allCats) {
        await this.loadCategories()
      }
      this.setData({ path: [], pathText: '', list: this.renderList([]) })
    },
    childrenOf(id) {
      return (this.data.allCats || []).filter(c => c.parentId === id)
    },
    renderList(path) {
      let items
      if (path.length === 0) items = (this.data.allCats || []).filter(c => !c.parentId)
      else items = this.childrenOf(path[path.length - 1]._id)
      return items.map(c => ({ ...c, hasChild: this.childrenOf(c._id).length > 0 }))
    },
    levelName(len) {
      return ['选择分区', '选择吧', '选择子版块'][len] || '选择分类'
    },
    onSelect(e) {
      const cat = e.currentTarget.dataset.cat
      const path = [...this.data.path, cat]
      const hasChild = this.childrenOf(cat._id).length > 0
      if (path.length < 3 && hasChild) {
        this.setData({ path, pathText: path.map(c => c.name).join(' / '), list: this.renderList(path) })
      } else {
        // 终选（叶子或无子分类）
        this.triggerEvent('select', {
          categoryId: cat._id,
          categoryPath: path.map(c => c._id),
          categoryName: path.map(c => c.name).join(' / ')
        })
        this.close()
      }
    },
    onBack() {
      const path = this.data.path.slice(0, -1)
      this.setData({ path, pathText: path.map(c => c.name).join(' / '), list: this.renderList(path) })
    },
    close() {
      this.triggerEvent('close')
    },
    noop() {}
  }
})
