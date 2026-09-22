// config/school.js — 多校部署「单点配置」
//
// ⚠️ 多校隔离说明（部署时只需改本文件）：
//   每所高校 clone 本仓库后，仅需修改本文件中的 envId / schoolName / schoolId 三处，
//   即可把同一套代码部署到该校独立的云开发环境。云函数名保持全局命名空间不变，
//   不同学校通过不同的 envId 实现数据隔离（与架构层「不合并云函数」决策一致）。
//
// 前端所有云函数调用都经由 utils/request.js 的 wx.cloud.callFunction，
// 而 wx.cloud 的 env 在 app.js 的 wx.cloud.init({ env }) 时即确定，
// 因此只需在 app.js 初始化处引用本配置即可，无需改动分散的 76 处 callFunction 调用。
function getSchoolConfig() {
  return {
    envId: 'campushub',        // 云开发环境 ID（每校不同；app.js 的 wx.cloud.init 用它）
    schoolName: '示例大学',     // 展示用校名（可用于首页标题 / 关于页）
    schoolId: ''               // 本校 schoolId；若后端按 schoolId 隔离数据则填入，留空=全国默认
  }
}

module.exports = { getSchoolConfig }
