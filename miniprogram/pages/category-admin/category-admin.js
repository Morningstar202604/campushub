// pages/category-admin/category-admin.js — 内容分类运营管理（仅管理员）
// 真实权限在云端校验（category-manage 云函数 requireActiveUser + checkAdmin），
// 前端仅用 admin.check 隐藏入口、拦截非管理员访问。
const { callFunction } = require('../../utils/request.js')
const { clearCache } = require('../../utils/cache.js')

const KIND_OPTIONS = [
  { value: 'zone', label: '分区' },
  { value: 'forum', label: '吧' },
  { value: 'board', label: '子版块' }
]

Page({
  data: {
    isAdmin: false,
    loading: false,
    list: [],
    kindOptions: KIND_OPTIONS,
    parentOptions: [{ value: '', label: '顶级分区（无父级）' }],
    parentIndex: 0,
    kindIndex: 1,
    form: {
      show: false,
      mode: 'create', // create | edit
      id: '',
      name: '',
      emoji: '',
      parentId: '',
      kind: 'forum',
      schoolId: '',
      order: ''
    }
  },

  onLoad() {
    this.checkAdmin()
  },

  async checkAdmin() {
    try {
      const res = await callFunction('admin', { action: 'check' })
      const okAdmin = !!(res && res.success && res.isAdmin)
      this.setData({ isAdmin: okAdmin })
      if (okAdmin) this.loadTree()
    } catch (e) {
      this.setData({ isAdmin: false })
    }
  },

  async loadTree() {
    this.setData({ loading: true })
    try {
      const res = await callFunction('category-list', {})
      this.setData({ list: (res && res.list) || [] })
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
    this.setData({ loading: false })
  },

  // 收集某节点的所有后代 _id（用于在"选择父级"时排除自己及子孙，防止成环）
  collectDescendantIds(list, rootId) {
    const result = new Set()
    let frontier = [rootId]
    while (frontier.length) {
      const children = list.filter(x => frontier.indexOf(x.parentId) !== -1)
      const ids = children.map(c => c._id)
      if (!ids.length) break
      ids.forEach(i => result.add(i))
      frontier = ids
    }
    return result
  },

  // 构建"父级"下拉项：排除自身及其后代
  buildParentOptions(excludeId) {
    const list = this.data.list
    const exclude = new Set()
    if (excludeId) {
      exclude.add(excludeId)
      this.collectDescendantIds(list, excludeId).forEach(i => exclude.add(i))
    }
    const candidates = list.filter(x => !exclude.has(x._id))
    const options = [{ value: '', label: '顶级分区（无父级）' }].concat(
      candidates.map(x => ({
        value: x._id,
        label: `${'　'.repeat(Math.max(0, x.level - 1))}${x.emoji || ''} ${x.name}（${x.kind === 'zone' ? '分区' : x.kind === 'forum' ? '吧' : '子版块'}）`
      }))
    )
    this.setData({ parentOptions: options, parentIndex: 0 })
  },

  onAdd() {
    this.buildParentOptions('')
    this.setData({
      parentIndex: 0,
      kindIndex: 1,
      form: { show: true, mode: 'create', id: '', name: '', emoji: '', parentId: '', kind: 'forum', schoolId: '', order: '' }
    })
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.list.find(x => x._id === id)
    if (!item) return
    this.buildParentOptions(id)
    const kindIndex = Math.max(0, KIND_OPTIONS.findIndex(k => k.value === item.kind))
    const parentIndex = Math.max(0, this.data.parentOptions.findIndex(o => o.value === (item.parentId || '')))
    this.setData({
      kindIndex,
      parentIndex,
      form: {
        show: true, mode: 'edit', id: item._id,
        name: item.name, emoji: item.emoji || '',
        parentId: item.parentId || '', kind: item.kind,
        schoolId: item.schoolId || '', order: item.order != null ? String(item.order) : ''
      }
    })
  },

  onName(e) { this.setData({ 'form.name': e.detail.value }) },
  onEmoji(e) { this.setData({ 'form.emoji': e.detail.value }) },
  onSchool(e) { this.setData({ 'form.schoolId': e.detail.value }) },
  onOrder(e) { this.setData({ 'form.order': e.detail.value }) },
  onParentChange(e) {
    const idx = Number(e.detail.value)
    const opt = this.data.parentOptions[idx] || { value: '' }
    this.setData({ parentIndex: idx, 'form.parentId': opt.value })
  },
  onKindChange(e) {
    const idx = Number(e.detail.value)
    const opt = this.data.kindOptions[idx] || { value: 'forum' }
    this.setData({ kindIndex: idx, 'form.kind': opt.value })
  },

  onCancel() { this.setData({ 'form.show': false }) },

  async onSubmit() {
    if (this._saving) return // 防重复提交（showLoading 默认无遮罩，可被点穿）
    const f = this.data.form
    if (!f.name || !f.name.trim()) {
      return wx.showToast({ title: '请输入分类名称', icon: 'none' })
    }
    this._saving = true
    const payload = {
      action: f.mode,
      name: f.name.trim(),
      emoji: f.emoji.trim(),
      parentId: f.parentId || null,
      kind: f.kind,
      schoolId: (f.schoolId || '').trim(),
      order: f.order === '' ? undefined : Number(f.order)
    }
    if (f.mode === 'edit') payload.id = f.id
    wx.showLoading({ title: '保存中', mask: true })
    try {
      const res = await callFunction('category-manage', payload)
      wx.hideLoading()
      if (res && res.success) {
        // 分类树已变更：清掉本地缓存，选择器下次打开拉新树
        clearCache('category_tree')
        wx.showToast({ title: '已保存', icon: 'success' })
        this.setData({ 'form.show': false })
        this.loadTree()
      } else {
        wx.showToast({ title: (res && res.message) || '保存失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      this._saving = false
    }
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.list.find(x => x._id === id)
    if (!item) return
    wx.showModal({
      title: '删除分类',
      content: `确认删除「${item.emoji || ''} ${item.name}」？该分类下的历史内容不会被删除，但分类入口将隐藏（软删除）。`,
      success: async (r) => {
        if (!r.confirm) return
        wx.showLoading({ title: '处理中' })
        try {
          const res = await callFunction('category-manage', { action: 'delete', id })
          wx.hideLoading()
          if (res && res.success) {
            clearCache('category_tree') // 分类树变更，清本地缓存
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadTree()
          } else {
            wx.showToast({ title: (res && res.message) || '删除失败', icon: 'none' })
          }
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  }
})
