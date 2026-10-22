/**
 * 小程序更新检查。
 *
 * 微信小程序发布新版本后，用户不会立即拿到新代码 —— 客户端会继续用旧版本，
 * 直到冷启动若干次后才静默更新。官方提供 UpdateManager 让开发者主动提示。
 * 不接入的后果：修了紧急 bug，用户仍跑旧版本，投诉「明明修了还是坏的」。
 *
 * 仅小程序端有效，H5/App 为空实现。
 */
export function initUpdateCheck() {
  // #ifdef MP-WEIXIN
  // 用 globalThis 取 wx：本项目未引入 miniprogram-api-typings，
  // 直接引用 wx 会让 vue-tsc 报「Cannot find name 'wx'」。
  const w: any = (globalThis as any).wx
  if (!w || !w.getUpdateManager) return
  const um = w.getUpdateManager()
  um.onUpdateReady(() => {
    uni.showModal({
      title: '发现新版本',
      content: '新版本已准备好，重启后生效。',
      confirmText: '立即重启',
      cancelText: '稍后',
      success: (r) => {
        if (r.confirm) {
          um.applyUpdate()
        }
      }
    })
  })
  um.onUpdateFailed(() => {
    console.warn('[更新] 新版本下载失败，将在下次启动时重试')
  })
  // #endif
}

/**
 * 隐私协议弹窗（小程序合规必需）。
 *
 * 微信自 2023-09 起要求：小程序在调用任何收集用户信息的接口前，
 * 必须让用户主动同意《隐私保护指引》，否则接口会被拒绝（errno 112）。
 * 未接入的典型症状：真机上 chooseImage / getUserProfile 全部失败，开发者工具里却正常。
 *
 * 这里用 wx.requirePrivacyAuthorize 触发官方弹窗；用户拒绝则提示并停留在当前页。
 * 隐私政策文本在「设置 → 隐私政策」可查（pages/legal/legal）。
 */
export function initPrivacyGuard() {
  // #ifdef MP-WEIXIN
  const w: any = (globalThis as any).wx
  if (!w) return
  if (!w.onNeedPrivacyAuthorization) return

  w.onNeedPrivacyAuthorization((resolve: any) => {
    uni.showModal({
      title: '隐私保护提示',
      content: '使用本服务需要你同意《隐私政策》，我们仅收集提供服务所必需的信息。',
      confirmText: '同意',
      cancelText: '查看政策',
      success: (r) => {
        if (r.confirm) {
          resolve({ buttonId: 'agree-btn', event: 'agree' })
        } else {
          resolve({ event: 'disagree' })
          uni.navigateTo({ url: '/pages/legal/legal?type=privacy' })
        }
      },
      fail: () => resolve({ event: 'disagree' })
    })
  })
  if (w.requirePrivacyAuthorize) {
    w.requirePrivacyAuthorize({
      success: () => {},
      fail: () => {}
    })
  }
  // #endif
}
