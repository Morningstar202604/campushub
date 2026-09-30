import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from '@/stores/auth'
import { initTelemetry, track, captureError } from '@/lib/telemetry'
import './styles/index.css'

initTelemetry({ endpoint: import.meta.env.VITE_TELEMETRY_ENDPOINT || undefined })

const app = createApp(App)
app.use(createPinia())
app.use(router)

// 全局错误兜底（组件渲染 / 生命周期内未捕获异常）
app.config.errorHandler = (err, _instance, info) => {
  captureError(err, { info })
}

// 未处理的 Promise 拒绝 / 全局运行时错误
window.addEventListener('unhandledrejection', (e) => {
  captureError(e.reason, { source: 'unhandledrejection' })
})
window.addEventListener('error', (e) => {
  captureError(e.error ?? e.message, { source: 'window.error' })
})

// 页面浏览埋点
router.afterEach((to) => {
  track('page_view', { path: to.fullPath })
})

// 启动时恢复登录态（不阻塞渲染）
useAuthStore().restore()

app.mount('#app')
