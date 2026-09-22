// 多校隔离机制（对应旧仓 miniprogram/config/school.js 的单点注入）
// 部署新学校：只需改这一个文件 + 重新构建
// 占位值：部署前替换为真实 CloudBase envId / 校名
const schoolConfig = {
  envId: '',          // 例如 'campushub-1a2b3c'
  schoolName: '未配置学校',
  schoolId: 'default',

  // CloudBase 云函数 HTTP 访问服务鉴权 Token（H5/App 端 REST 调用必填）
  // 在 CloudBase 控制台「访问控制 → HTTP 访问服务」中为该环境生成/查看
  // 小程序端走 wx.cloud（已绑 openid 自动鉴权），不需要 token
  restToken: ''
}

export default schoolConfig
