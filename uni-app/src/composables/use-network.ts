/**
 * 网络状态监听。
 *
 * 为什么要做成全局：项目里 8 个页面会调云函数，断网时每个页面都弹一次
 * 「网络连接失败」toast，用户看到的是连续多次提示。全局只提示一次更合理。
 *
 * 同时在断网时把状态存到 ref，页面可选择展示顶部条（当前仅首页用）。
 */
import { ref } from 'vue'

const online = ref(true)
let inited = false
let lastToastAt = 0

function toastOnce(msg: string) {
  // 5 秒内不重复提示，避免网络抖动时刷屏
  const now = Date.now()
  if (now - lastToastAt < 5000) return
  lastToastAt = now
  uni.showToast({ title: msg, icon: 'none', duration: 2000 })
}

export function initNetworkWatcher() {
  if (inited) return
  inited = true

  uni.getNetworkType({
    success: (res: any) => {
      online.value = res.networkType !== 'none'
    },
    fail: () => {
      /* 取不到则按在线处理，避免误报 */
    }
  })

  uni.onNetworkStatusChange((res: any) => {
    const wasOnline = online.value
    online.value = res.isConnected
    if (!res.isConnected && wasOnline) {
      toastOnce('网络已断开，部分功能暂不可用')
    } else if (res.isConnected && !wasOnline) {
      toastOnce('网络已恢复')
    }
  })
}

export function useNetwork() {
  initNetworkWatcher()
  return { online }
}
