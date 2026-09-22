// config/constants.js — 前端魔法值收口（配合风格门禁 eslint）
//
// 仅收编高频、易错、跨页重复的魔法值。后端（cloudfunctions）因部署隔离无法 require 本文件，
// 其魔法值（如 login 的 creditScore 默认、post-list 的 pageSize / 7 天窗口）暂列入 docs 待办，
// 待架构层确定「跨层共享常量」机制后再统一迁移（见 docs/A11Y_ROADMAP.md 相关条目）。
const PAGE_SIZE = 20                                      // 列表分页默认每页条数（index / market 列表查询）
const CREDIT_SCORE_DEFAULT = 100                          // 新用户默认积分（需与 cloudfunctions/login 保持一致）
const VERIFY_STATUS = {                                   // 用户认证 / 封禁状态枚举
  UNVERIFIED: 'unverified',
  VERIFIED: 'verified',
  BANNED: 'banned'
}
const EXPIRE_WINDOW_7D = 7 * 24 * 60 * 60 * 1000          // 7 天过期窗口（毫秒）

module.exports = { PAGE_SIZE, CREDIT_SCORE_DEFAULT, VERIFY_STATUS, EXPIRE_WINDOW_7D }
