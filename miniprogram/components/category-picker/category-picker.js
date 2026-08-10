// components/category-picker/category-picker.js
// 多级分类选择器：分区 → 吧 → 子版块，逐级下钻，必须选到叶子
const { callFunction } = require('../../utils/request.js')

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
    async open() {
      if (!this.data.allCats) {
        this.setData({ loading: true })
        try {
          const res = await callFunction('category-list', {})
          if (res && res.success) this.setData({ allCats: res.list || [] })
        } catch (e) {
          console.error('加载分类失败', e)
        }
        this.setData({ loading: false })
      }
      this.setData({ path: [], list: this.renderList([]) })
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
        this.setData({ path, list: this.renderList(path) })
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
      this.setData({ path, list: this.renderList(path) })
    },
    close() {
      this.triggerEvent('close')
    },
    noop() {}
  }
})
