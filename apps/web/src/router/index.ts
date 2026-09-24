import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// Hash 路由：静态托管（COS/OSS）无需任何 rewrite 配置
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/pages/home/index.vue'), meta: { tab: 'home' } },
    { path: '/market', name: 'market', component: () => import('@/pages/market/index.vue'), meta: { tab: 'market' } },
    { path: '/publish', name: 'publish', component: () => import('@/pages/publish/index.vue'), meta: { tab: 'publish' } },
    { path: '/messages', name: 'messages', component: () => import('@/pages/messages/index.vue'), meta: { tab: 'messages', auth: true } },
    { path: '/profile', name: 'profile', component: () => import('@/pages/profile/index.vue'), meta: { tab: 'profile' } },

    { path: '/post/:id', name: 'post-detail', component: () => import('@/pages/post-detail/index.vue') },
    { path: '/product/:id', name: 'product-detail', component: () => import('@/pages/product-detail/index.vue') },
    { path: '/search', name: 'search', component: () => import('@/pages/search/index.vue') },
    { path: '/checkin', name: 'checkin', component: () => import('@/pages/checkin/index.vue'), meta: { auth: true } },
    { path: '/my-list', name: 'my-list', component: () => import('@/pages/my-list/index.vue'), meta: { auth: true } },
    { path: '/user-update', name: 'user-update', component: () => import('@/pages/user-update/index.vue'), meta: { auth: true } },
    { path: '/login', name: 'login', component: () => import('@/pages/login/index.vue') },
    { path: '/guide', name: 'guide', component: () => import('@/pages/guide/index.vue') },
    { path: '/guide/:id', name: 'guide-detail', component: () => import('@/pages/guide/detail.vue') }
  ],
  scrollBehavior: () => ({ top: 0 })
})

// 登录守卫：需要登录的页面未登录时跳登录页，登录后回跳
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (to.meta.auth && !auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
})

export default router
