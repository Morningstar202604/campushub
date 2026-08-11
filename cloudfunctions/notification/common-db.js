// common-db.js — 云环境初始化与数据库访问（单一事实来源）
// 所有云函数通过 require('./common-db') 使用，避免重复初始化与不一致。
const cloud = require('wx-server-sdk')

let _inited = false

function initCloud() {
  if (!_inited) {
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    _inited = true
  }
  return cloud
}

function getCloud() {
  initCloud()
  return cloud
}

function getDB() {
  initCloud()
  return cloud.database()
}

function getCmd() {
  return getDB().command
}

module.exports = { cloud, initCloud, getCloud, getDB, getCmd }
