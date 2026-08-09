// utils/format.js — 格式化工具

/**
 * 格式化价格
 * @param {number} price
 * @returns {string}
 */
function formatPrice(price) {
  if (price === 0) return '免费'
  return '¥' + Number(price).toFixed(2).replace(/\.00$/, '')
}

/**
 * 截取文本
 */
function truncate(text, maxLen = 50) {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

/**
 * 获取成色标签文本
 */
function getConditionText(condition) {
  const map = {
    'new': '全新',
    'almost_new': '几乎全新',
    'good': '8成新',
    'fair': '5成新'
  }
  return map[condition] || condition
}

/**
 * 获取分类标签文本
 */
function getCategoryText(category) {
  const map = {
    'daily': '日常',
    'study': '学习',
    'life': '生活',
    'rant': '吐槽',
    'help': '求助',
    'share': '分享'
  }
  return map[category] || category
}

module.exports = {
  formatPrice,
  truncate,
  getConditionText,
  getCategoryText
}
