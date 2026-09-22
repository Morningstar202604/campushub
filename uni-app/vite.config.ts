import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig({
  plugins: [uni()],
  // ⚠️ 这里**故意不配** css.preprocessorOptions.scss.additionalData。
  //
  // 历史问题：早期实现用 additionalData 把 @import "@/styles/tokens.scss" 注入到每一个
  // scss 片段，而 tokens.scss 当时混着 page{} / .sticker{} 等 CSS 规则 —— 于是 20 个页面
  // 的 <style> 里各输出一份相同规则，体积冗余、作用域混乱（且在 scoped 下会被改写成
  // .sticker[data-v-xxx]，同一份设计令牌被复制 20 遍）。
  //
  // 现在的架构：tokens.scss 只放变量、global.scss 只放全局规则，
  // 二者由 App.vue 的 <style lang="scss"> @import 一次即可 —— CSS 自定义属性
  // 经 :root 全局继承，页面组件无需重复引入。
  //
  // 若将来确实需要注入 SCSS 的 $变量 / mixin，请新建一个纯 mixin 文件再配置此处，
  // 不要把带 CSS 输出的文件塞进来。
  css: {
    preprocessorOptions: {
      scss: {
        // 允许页面使用 @import '@/styles/xxx' 这类别名路径
        additionalData: ''
      }
    }
  }
})
