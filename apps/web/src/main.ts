import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from '@/stores/auth'
import './styles/index.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// 启动时恢复登录态（不阻塞渲染）
useAuthStore().restore()

app.mount('#app')
