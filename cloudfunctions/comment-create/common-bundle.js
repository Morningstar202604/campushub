// common-bundle.js — 统一出口，供各云函数一行引入
// 用法：const { requireActiveUser, checkContents, ok, wrap, getDB, getCmd } = require('./common-bundle')
const db = require('./common-db')
const error = require('./common-error')
const context = require('./common-context')
const security = require('./common-security')
const rate = require('./common-rate')
const content = require('./common-content')

module.exports = {
  ...db,
  ...error,
  ...context,
  ...security,
  ...rate,
  ...content
}
