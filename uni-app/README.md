# CampusHub · uni-app 三端（墨荧 · Acid Campus）

> 一套代码 → 微信小程序 / H5 网站 / 安卓 APK。后端微信云开发（10 个部署单元 / 44 个业务入口），前端零第三方 UI 库。
> 视觉体系：《墨荧 · Acid Campus》去 AI 味设计系统（见 `../docs/DESIGN_SYSTEM.md`）。

---

## 一、这个项目「最大的作用」是什么

它不是「校园论坛」，而是一套**可复制的校园私域基础设施**：

| 层次 | 作用 |
|---|---|
| 表层 | 聚合校园高频场景：表白墙、二手市集、失物招领、任务悬赏、校园指南——把学生零散的信息需求收进一个入口 |
| 里层 | **一校一部署**：`src/config/school.config.js` 一个文件换一所校；分类树在管理台维护，不发版即可调整 |
| 本质 | 把「校园信息孤岛」问题模板化：每接一所校多一个数据飞轮 |

## 二、技术栈（全部锁版本）

| 层 | 选型 |
|---|---|
| 框架 | uni-app `3.0.0-4060420250429001`（Vue 3.5.13 + Vite 5.2.8 + TS 5.8.3） |
| 状态 | pinia 2.2.4 + pinia-plugin-persistedstate 4.1.3 |
| 列表 | z-paging 2.8.8（分页 / 下拉刷新 / 上拉加载） |
| 存储 | @cloudbase/js-sdk 2.32.0（H5/App 上传与临时链接） |
| UI | 无第三方组件库；`src/styles/tokens.scss` 是唯一视觉令牌来源 |

## 三、目录

```
src/
├── pages/            32 个页面（含管理台 6 页：admin / announcements / categories / dashboard / words / recycle）
├── adapters/         云函数原始记录 → 视图模型（字段映射唯一入口）
├── composables/      跨页复用逻辑（分页 / 评论 / 点赞收藏 / 主题 / 网络 / 守卫）
├── stores/           pinia（用户 / 学校配置）
├── config/           school.config.js（一校一署单点注入）+ gateway-routes.ts（自动生成）
├── styles/           tokens.scss（令牌）+ global.scss（全局规则，只由 App.vue 引一次）
└── utils/            api.ts（三端分流 + 身份令牌 + 图片压缩上传）+ demo-data.ts（本地演示层）
```

## 四、运行方式

```bash
cd uni-app
npm install
npm run dev:h5           # 本地 H5
npm run dev:mp-weixin    # 产物在 dist/dev/mp-weixin，导入微信开发者工具
npm run build:h5         # H5 构建
npm run build:mp-weixin  # 小程序构建
npm run build:app        # App 资源（再由 HBuilderX 云打包，见 docs/ANDROID_BUILD.md）
npm run type-check       # vue-tsc 全量类型检查
```

首次跑不加任何配置也能浏览：未填 `envId` 时自动进入**本地演示模式**（数据存在本机，可发帖 / 点赞 / 评论 / 签到 / 进管理台）。

## 五、三端差异（务必知道）

| 能力 | 小程序 | H5 | APK |
|---|---|---|---|
| 身份 | 平台注入 OPENID | HMAC 设备令牌（30 天） | 同 H5 |
| 图片上传 | `wx.cloud.uploadFile` | @cloudbase/js-sdk 匿名登录 + uploadFile | 同 H5 |
| 分享 | 原生分享卡片 | 浏览器分享 / 复制链接 | 浏览器分享 |
| 主题 | 导航栏 + tabBar 跟随，页面内容深色（WXSS 不支持属性选择器） | 完整深浅色 | 完整深浅色 |
| 原生能力 | 完整 | 浏览器 API | WebView 壳：相机降级为 `<input type=file>` |

## 六、门禁

```bash
npm run type-check                 # 0 错误
npm run build:h5                   # DONE Build complete.
npm run build:mp-weixin            # 同上
node ../scripts/verify-release.js  # 页面映射 / 版本徽章 / 治理文件 / 云函数结构
```
