// 多校隔离机制（单点注入）
// 部署新学校：只需改这一个文件 + 重新构建
const schoolConfig = {
  envId: '',          // 例如 'campushub-1a2b3c'；留空 = 演示模式
  schoolName: '示例大学',
  schoolId: 'demo',

  // CloudBase 云函数 HTTP 访问服务鉴权 Token（H5/App 端 REST 调用必填）
  // 在 CloudBase 控制台「访问控制 → HTTP 访问服务」中为该环境生成/查看
  // 小程序端走 wx.cloud（已绑 openid 自动鉴权），不需要 token
  restToken: '',

  // 演示模式开关（详见 src/utils/api.ts 的 shouldUseDemo）：
  //   envId 为空 且 demoMode 不为 false → 使用本地演示数据（可浏览、可操作，数据存本机）
  //   envId 一旦填入 → 自动切到真实云环境，本开关不再生效
  //   想接真实环境但 envId 暂缺时，设为 false 可强制走云端并看到真实错误
  demoMode: true
}

export default schoolConfig
