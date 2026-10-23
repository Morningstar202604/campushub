# 安卓路线：uni-app 迁移 + 开源轮子替代审计

> 决策：确定走 **安卓 App 路线**，技术底座选 **uni-app（Vue3 + Vite）**——一套代码同时编译
> 微信小程序 / H5 网站 / 安卓 APK，后端（37 个云函数 + CloudBase）**零改动复用**。
> 本文档回答两个问题：① 哪些自研轮子可以扔掉换开源；② 迁移怎么分阶段落地。

---

## 一、轮子清点结果（先说实话：轮子很少，这项目底子干净）

全仓自研代码量盘点：

| 层 | 自研代码 | 行数 | 结论 |
|---|---|---|---|
| 前端 utils | 6 个文件 | **401 行** | 半数可被开源替代 |
| 前端组件 | category-picker | 1 个 | 可被组件库替代 |
| 后端 kernel | 9 个 common-* | **629 行** | **保留**（这是项目核心资产，鉴权/幂等/限流/审核逻辑，开源没有等价物且与 CloudBase 深度绑定） |
| 页面层 | 23 页 | 分页/刷新模式重复 6 次 | 用 z-paging 一把替代 |

### 1.1 前端轮子替代映射表

| 自研轮子 | 行数 | 替代方案 | 替代理由 | 动作 |
|---|---|---|---|---|
| `utils/eventBus.js` | 29 | **删除，用 uni 原生 `uni.$on/$off/$emit`** | uni-app 自带全局事件总线，语义一模一样 | 直接删 |
| `utils/cache.js` | 55 | **pinia + pinia-plugin-persistedstate** | Vue3 官方状态管理，持久化插件替代手写 storage 封装，响应式比裸 storage 强一代 | 直接删 |
| `utils/request.js` | 99 | **luch-request**（uni 生态标准请求库，axios 同款 API）+ 保留 30 行平台分流封装 | 拦截器/重试/上传队列全内置；但 `wx.cloud.callFunction` 在 App 端不可用，需保留薄封装层做平台分流 | 替换 + 薄封装 |
| `utils/image.js` | 77 | **uni 原生 `uni.chooseMedia(sizeType:compressed)` + `uni.compressImage`** | 手写压缩链路在 App 端 API 不同，原生能力各端都有 | 直接删 |
| `utils/auth.js` | 104 | **保留**（薄改） | 登录态模型绑定 CloudBase AUTH，uni-id 是 uniCloud 专属，用不上 | 保留 |
| `utils/subscribe.js` | 37 | **保留**（条件编译） | 微信订阅消息是小程序专属，App 端用条件编译隔离 | 保留 |
| `components/category-picker` | 1 个 | **wot-design-uni 的 Picker/PickerView** | 成熟组件库自带级联选择 | 直接删 |
| 6 个页面的分页/刷新模式 | ~300 行重复 | **z-paging**（uni 生态分页神器，5k+ star） | 下拉刷新/上拉加载/空态/骨架屏全内置，替代每页手写的 page/hasMore/loadList 三件套 | 强烈推荐 |

### 1.2 UI 组件库迁移：TDesign 小程序版 → **wot-design-uni**

| 对比项 | tdesign-miniprogram（现用） | wot-design-uni（推荐） | uview-plus（备选） |
|---|---|---|---|
| uni-app 支持 | ❌ 仅小程序 | ✅ Vue3 + TS 原生支持 | ✅ 但 Vue2 血统重 |
| 维护活跃度 | 小程序侧活跃 | 活跃（2024-2026 持续更新） | 活跃但 issue 积压多 |
| 主题定制 | CSS 变量 | **CSS 变量 + 完整主题令牌** | SCSS 变量（改起来重） |
| 组件数 | 60+ | 70+ | 60+ |
| 深色模式 | 需手搓 | ✅ 内置 | 需手搓 |

选 wot-design-uni 的核心理由：**主题令牌系统正好承载我们新的设计系统**（见 DESIGN_SYSTEM.md），深色模式内置。

### 1.3 后端：一个都不换

- 37 个云函数 + CloudBase 数据库/存储/登录 **原样保留**。
- 各端调用方式：小程序/App 走 `wx.cloud.callFunction`（App 端用 CloudBase Android SDK 或云函数 HTTP 访问服务），H5 走 `@cloudbase/js-sdk`。
- 在 `utils/api.js` 里做**一个 30 行的平台分流封装**，23 个页面对此无感知。

---

## 二、目标工程结构

```
campushub-uni/
├── src/
│   ├── pages/            # 23 页 1:1 迁移（WXML→Vue 模板）
│   ├── components/       # 业务组件（约 2-3 个自研，其余组件库）
│   ├── stores/           # pinia：user / school / ui 三店
│   ├── utils/
│   │   ├── api.js        # ★ 30 行平台分流（cloud / http）
│   │   ├── auth.js       # 保留迁移
│   │   └── format.js     # dayjs（本来就有）
│   ├── styles/
│   │   ├── tokens.scss   # ★ 设计令牌（来自 DESIGN_SYSTEM.md）
│   │   └── base.scss
│   ├── config/school.js  # 多校机制原样保留
│   ├── pages.json        # 路由 + tabBar
│   └── App.vue
├── cloudfunctions/       # 原样拷入，零改动
└── package.json
```

## 三、分阶段迁移计划

| 阶段 | 内容 | 验收标准 | 预估 |
|---|---|---|---|
| **P0 脚手架** | uni-app Vue3 + Vite + pinia + wot-design-uni + z-paging + tokens.scss 落地 | 空壳 APK 能装能跑，设计令牌生效 | 2 天 |
| **P1 API 分流层** | utils/api.js 平台分流 + auth 迁移 + school 多校机制接入 | H5 与小程序双端登录跑通 | 3 天 |
| **P2 四个 tab 页** | index / market / wall / lost-found 迁移（z-paging 重写列表） | 双端列表流畅，下拉/上拉/骨架屏齐 | 1 周 |
| **P3 详情+发布** | post-detail / product-detail / 两个 publish（含幂等 clientReqId） | 发帖发品双端闭环，图片上传压缩正常 | 1 周 |
| **P4 其余 15 页** | profile 系 / search / admin / notifications 等 | 全功能对齐旧版 | 1.5 周 |
| **P5 安卓打包** | HBuilderX 云打包 APK + 应用图标/启动图（新视觉）+ 应用市场材料 | APK 可安装、可上架 | 3 天 |
| **P6 新视觉全面上妆** | 按 DESIGN_SYSTEM.md 替换全部令牌 + 深色模式 | 对照验收清单逐项过 | 1 周 |

**总计约 6 周**（单人熟练开发）。关键顺序原则：**先迁功能（长得像旧版），再整体换肤**——两件事混着做会两头失控。

## 四、风险与对策

| 风险 | 等级 | 对策 |
|---|---|---|
| CloudBase Android SDK 文档较薄 | M | App 端优先用**云函数 HTTP 访问服务**（REST 化），绕开 SDK |
| 订阅消息仅小程序可用 | L | App 端用 uni-push 2.0 替代（条件编译隔离） |
| 图片 fileID 在 H5 端需转临时 URL | M | api.js 封装 `getTempUrl()` 统一处理 |
| 双端 UI 细节漂移 | L | tokens.scss 单一事实源 + 每阶段双端截图对比 |

---

*配套文档：《DESIGN_SYSTEM.md》——去 AI 味视觉体系，P0 阶段就要落地 tokens。*
