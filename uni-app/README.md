# CampusHub · uni-app 三端（墨荧 · Acid Campus）

> 由微信原生小程序 `../campushub` 迁移而来的 **uni-app（Vue3 + Vite）** 工程。
> 一套代码 → 微信小程序 / H5 网站 / **安卓 APK**，后端 37 个云函数 + CloudBase **零改动复用**。
> 视觉体系：《墨荧 · Acid Campus》去 AI 味设计系统（见 `campushub/docs/DESIGN_SYSTEM.md`）。

---

## 一、这个项目「最大的作用」是什么

它不是"校园论坛"，而是一套**可复制的校园私域基础设施**：

| 层次 | 作用 |
|---|---|
| 表层 | 聚合校园五大高频场景：表白墙、二手市集、失物招领、任务悬赏、课程指南——把学生零散的信息需求收进一个入口 |
| 里层（护城河） | **多校隔离机制**：`src/config/school.config.js` 一个文件换一所校 + 37 云函数 + CloudBase。一所校的部署成本 ≈ 改一个 envId + 一套图标。它做的是"校园版模板"，不是一个 App |
| 本质 | 把"校园信息孤岛"问题工业化。每接一所校多一个数据飞轮：用户越多 → 帖子越多 → 新用户越离不开。这是它与"普通论坛"的本质区别，也是开源天花板 |

## 二、当前进度（P0–P5 已落地）

| 阶段 | 状态 | 说明 |
|---|---|---|
| P0 脚手架 | ✅ | uni-app Vue3 + Vite + pinia + wot-design-uni + z-paging + 墨荧 tokens |
| P1 API 分流层 | ✅ | `utils/api.ts` 三路分发：小程序 `wx.cloud` / H5+App 走 CloudBase HTTP 访问服务 REST（`{envId}.api.tcloudbasegateway.com/v1/functions/{name}?webfn=true` + Bearer token）；登录态真接 `login` 云函数；`school.config.js` 新增 `restToken` 单点注入 |
| P2 四个 tab 页 | ✅ | index（推荐流+公告）/ market（分类筛选）/ wall（kind=confession）/ lost-found（kind=lost/found），全部经 `composables/use-paged-list.ts` + `adapters/index.ts` 接真实云函数 |
| P3 详情+发布+互动 | ✅ | post-detail / product-detail（评论楼中楼 + 点赞收藏 + resolve + 图片预览）；post-create / product-create（`clientReqId` 幂等 + 图片上传 + 分类叶子校验）；新增 `use-action` / `use-comments` 组合器；`api.ts` 补 `uploadImage` + `fileIDToTempUrl` 三端真实实现；列表页卡片 → 详情导航 + 悬浮发布入口 |
| P4 其余页（15→12 注册） | ✅ | my-list / user-profile / user-update / guide-list / guide-detail / notification / search / follow / checkin / points / feedback / report；`adapters/index.ts` 补 `adaptMyItem` / `adaptProfile` / `adaptGuide` / `adaptNotice` / `adaptSearchHit`；`pages.json` 注册至 20 页，全部结构+模板校验通过 |
| P5 安卓打包 | ✅ | manifest.json 补 `app-plus.distribute.android`（包名 com.campushub.app / minSdk 21 / target 34 / 双 ABI / 8 项全限定权限）；`docs/ANDROID_BUILD.md` HBuilderX 云打包手册 + 证书 + 回滚 + 验收 checklist；`docs/versions.json` 版本/证书基线 |
| P6 新视觉全面上妆 | ⬜ 待做 | 按 DESIGN_SYSTEM.md 验收清单逐项过 |

## 三、轮子替代（已并入本仓，不再自研）

| 旧自研轮子 | 替换为 |
|---|---|
| eventBus.js | uni-app 原生 `uni.$on/$emit`（直接用，无需再封装） |
| cache.js | **pinia + pinia-plugin-persistedstate**（已装） |
| request.js | **luch-request**（待 P1 引入）+ 30 行平台分流 |
| image.js | uni 原生 `chooseMedia/compressImage` |
| category-picker | **wot-design-uni 的 Picker** |
| 6 页分页三件套 | **z-paging**（已装，`easycom` 已配） |
| tdesign-miniprogram | **wot-design-uni**（已装，暗黑模式内置） |
| 后端 37 云函数 | **一个都不换**，零改动 |

## 四、设计系统（去 AI 味）

`src/styles/tokens.scss` 是**单一事实源**：墨黑 `#0D110E` 底 + 荧光青柠 `#C8F135` 主色（14.2:1），
圆角只许 8/28 两档、无软投影、硬边框 + 贴纸投影、斜切角标签品牌签名。
8 条反 AI 味铁律与验收清单见 `campushub/docs/DESIGN_SYSTEM.md`。

## 五、运行方式

```bash
cd campushub-uni
npm install            # 首次装依赖
npm run dev:h5         # 本地跑 H5（浏览器看墨荧视觉）
npm run dev:mp-weixin  # 编译到 dist/dev/mp-weixin，导入微信开发者工具
npm run build:app      # 编译安卓端（HBuilderX 云打包出 APK）
```

> 依赖版本已锁真实官方值（@dcloudio `3.0.0-4060420250429001` / vue `3.5.13` / z-paging `2.8.8` /
> wot-design-uni `1.14.0`），安装前请用 `npm view <pkg> version` 再核一次以防上游跳版。

## 六、上线前运营动作（代码不能自动完成）

1. 填 `src/manifest.json` 的 `mp-weixin.appid` + `src/config/school.config.js` 的 `envId` **和 `restToken`**（H5/App REST 鉴权）；
2. CloudBase 控制台为对应云函数开启「HTTP 访问服务」，鉴权方式设为匿名或自定义 Token（否则 H5/App 端 REST 调用 401）；
3. CloudBase 控制台建 4 索引 + 1 TTL（`idempotency`×2 / `rate_limits` / `view_logs`，全清单见 `../docs/INDEXES.md`）；
4. 安卓打包前把 `src/static/tabbar/` 占位图标换成正式品牌图标。

> ⚠️ **后端源码不在本工程内。** 37 个云函数存放在**同级**的 `../campushub/cloudfunctions/`（原小程序仓库），
> 本工程的 `cloudfunctions/` 是空目录，仅作占位。原因：uni-app 工程只承载三端前端，云函数沿用原仓库统一维护，
> 避免两处同一份代码漂移。因此：
> - 部署/更新云函数请在 `../campushub/` 下用微信开发者工具或 CloudBase CLI 操作；
> - 本工程 `src/manifest.json` 的 `mp-weixin` 未设 `cloudfunctionRoot`，构建产物在微信开发者工具里**不会显示云函数面板**，属预期行为；
> - 下面各章节出现的 `cloudfunctions/xxx` 路径，均指 `../campushub/cloudfunctions/xxx`。

## 七、P2 新增数据层文件

```
src/utils/api.ts                       # 三路分发（wx.cloud / REST），含业务 success 标志兜底 + uploadImage + fileIDToTempUrl
src/stores/user.ts                     # 真实 callFunction('login') 恢复 + 降级
src/stores/school.ts                   # 增加 restToken 单点注入
src/composables/use-paged-list.ts      # 通用分页 hook（z-paging + callFunction 解耦）
src/adapters/index.ts                  # raw→视图模型映射 + fmtTime + loadAnnouncements + 详情模型
src/pages/{index,market,wall,lost-found}/*.vue  # 四 tab 页接真实云函数
```

> 后端契约：`cloudfunctions/common/common-error.js` 的 `ok(data)` → `{ success:true, ...data }`，
> 前端 `callFunction` 统一返回该展开体；列表函数额外带 `list` / `hasMore`。

## 八、P3 详情+发布+互动文件（本次落地）

```
src/composables/use-action.ts          # 点赞/收藏/resolve 响应式封装（幂等契约）
src/composables/use-comments.ts        # 楼层 + 楼中楼 + 评论点赞/删除
src/utils/api.ts                       # uploadImage（选图→云存储 fileID）+ fileIDToTempUrl（三端真实）
src/adapters/index.ts                  # + adaptPostDetail / adaptProductDetail
src/pages/post-detail/post-detail.vue  # 帖子详情 + 评论 + 点赞收藏 + resolve + 图片预览
src/pages/product-detail/product-detail.vue # 商品详情 + 收藏 + 联系（拨号/复制）
src/pages/post-create/post-create.vue  # 发帖：5 种 kind + 叶子分类 + 图片 + clientReqId 幂等
src/pages/product-create/product-create.vue # 发布好物：图片≥1 + 价格/原价 + 成色/交易方式
src/pages.json                         # 注册 4 个 P3 新页面
src/pages/index/index.vue              # + 卡片→详情导航 + 悬浮发布入口（两枚硬投影方块）
src/pages/market/market.vue            # + 商品卡→详情导航
src/pages/wall/wall.vue                # + 卡片→详情导航
```

> 幂等说明：`post-create` / `product-create` 提交时前端生成 `clientReqId`（`post-` / `prod-` 前缀 + 时间戳 + 随机数），
> 后端 `idempotency` 表唯一索引 + 轮询兜底，闪断/重试不会产生双帖/双商品。
> 图片链路：选图（`uni.chooseImage` 三端通用）→ `uploadImage` 压传云存储 → 返回 `fileID` → 后端 `checkImages` 安全校验 → 详情/列表用 `fileIDToTempUrl` 转可访问 URL。

## 九、P4 其余 12 页（本次落地）

```
src/adapters/index.ts                    # + adaptMyItem / adaptProfile / adaptGuide / adaptNotice / adaptSearchHit
src/pages/my-list/my-list.vue            # 我的列表：帖子/好物/收藏三 tab + 统计行 + 删除（post-delete/product-delete）
src/pages/user-profile/user-profile.vue  # 用户主页：self/other + 关注/取关（follow）+ 编辑资料入口 + 近期帖子
src/pages/user-update/user-update.vue    # 编辑资料：昵称/简介/学院/专业/年级/性别/标签 + 头像上传 + RENAME_LIMITED 提示
src/pages/guide-list/guide-list.vue      # 指南列表：guide-list 返回 {categories, guides, hasMore} 非标准 list，自定义 queryGuides
src/pages/guide-detail/guide-detail.vue  # 指南详情：guide-detail → rich-text 正文（内联样式）+ 浏览量 + 标签
src/pages/notification/notification.vue  # 通知：list + markRead/markAllRead + 未读徽标
src/pages/search/search.vue              # 搜索：action=hot 热搜词 + keyword 搜索（posts/products/guides 三组）
src/pages/follow/follow.vue              # 关注/粉丝双 tab + 关注/取关 + 跳转 user-profile
src/pages/checkin/checkin.vue            # 每日签到：连续天数 + 7 格周历 + 积分奖励
src/pages/points/points.vue              # 积分商城：products + redeem（改名卡）
src/pages/feedback/feedback.vue          # 反馈：type（suggest/bug/other）+ 内容 + 联系方式 → feedback-create
src/pages/report/report.vue              # 举报：理由 + 补充说明 → report（post/product/comment）
src/pages.json                           # 注册至 20 页
```

> P4 全部页面均通过**脚本（花括号配平）+ 模板（标签开闭平衡）双向校验**；`guide-list` 因后端返回 `ok({categories, guides, hasMore})`（非标准 `list`），改用自定义 `queryGuides` 而非 `usePagedList`。
> 后端契约零改动：所有 P4 页面仅消费既有云函数（my-list / user-profile / user-update / guide-list / guide-detail / notification / search / follow / checkin / points / feedback-create / report）。

## 十、全量代码优化（2026-09-22：通读全部源码 + 逐条回源核对契约）

> 动因：早期由弱模型生成的代码存在大量「漏写 / 写错 / 写得不好」的问题，本次做**全量通读 + 逐条回云函数源码核对**后集中修复。**后端 37 个云函数零改动**，全部为前端侧修复。

### 10.1 致命 bug（修复前必然不可用）

| # | 位置 | 问题 | 后果 |
|---|---|---|---|
| 1 | `main.ts` | 用 `createApp` + `app.mount('#app')`（纯 Vue SPA 写法） | uni-app 不认该入口，`onLaunch` 不触发、页面拿不到 pinia |
| 2 | `main.ts` | **完全缺少 `wx.cloud.init()`** | 小程序端每个云函数都抛 `Cloud API isn't enabled`，20 页集体失效 |
| 3 | `stores/user.ts` | 用 `user.openid` 判登录态，但后端 `stripOpenid()` 已剥掉 openid | `isLoggedIn` 恒为 false，登录态永不生效 |
| 4 | `stores/school.ts` | `load()` 用动态 `import().then()` 且不返回 Promise | `await load()` 等了个 undefined，`envId` 仍为空串 → 首启 login 必失败 |
| 5 | `adapters/index.ts` | 读 `authorNickname`／`anonymous`，后端落库实为 `userNickname`／`isAnonymous` | 所有作者名恒为「匿名同学」 |
| 6 | `adapters/index.ts` | `adaptProfile` 读 `res.user`，后端返回键名是 `profile` | 用户主页永远空白 |
| 7 | `adapters/index.ts` | `adaptMyItem` 把收藏项全标成 `collect` | 收藏点进去跳错详情页 |
| 8 | `composables/use-paged-list.ts` | 调用**不存在**的 `completeByData` / `completeError` | 列表首屏直接抛 TypeError |
| 9 | 6 个列表页 | 用 `watch(pagingRef.value?.dataList)` 同步数据 | 依赖组件内部实现，首屏时机不可靠 |
| 10 | `utils/api.ts` | MP 上传 `const { filePath } = localPath`（把字符串当对象解构） | 小程序端上传必抛错 |
| 11 | `utils/api.ts` | js-sdk 返回字段写成 `fileData`（实为 `fileList`） | 图片转链失败 |
| 12 | `tsconfig.json` | `extends: "@vue/tsconfig/..."` 但该依赖不在 `package.json` | 类型检查必失败 |
| 13 | `manifest.json` | 引用的 `static/app-icons/**` 5 个图标**根本不存在** | 安卓云打包直接失败 |
| 14 | `manifest.json` | 权限清单重复声明两遍 | 冗余申请 |

### 10.2 架构层改进

- **样式分层**：`tokens.scss` 原混着 `page{}` / `.sticker{}` 等 CSS 规则，却被 vite `additionalData` 注入进**每一个**页面的 `<style>`，同一份令牌被复制 20 遍且在 scoped 下被改写。现拆为 `tokens.scss`（只放变量）+ `global.scss`（只放全局规则），由 `App.vue` 全局 `@import` 一次，`additionalData` 移除。
- **`.tabular-nums` 修正**：该类原被塞入 `color: var(--accent)`，导致**所有时间戳都变荧光青柠**，破坏「每页只允许一个荧光焦点」铁律 —— 已改为纯等宽工具类。
- **`usePagedList` 支持 `listKey` / `hasMoreKey`**：后端列表契约键名并不统一（`list` / `guides` / `posts`），原先固定读 `res.list` 导致这些页面只能放弃 hook 手写一套 z-paging 逻辑。
- **`useComments` 入参放宽**：由只收 `string` 改为 `string | Ref<string> | (() => string)`，与 `useAction` 统一；并修掉「目标未就绪时仍发无效请求」。
- **`PostDetail.authorNickname` → `author`**：与 `adaptWall.author` 统一命名。

### 10.3 页面层修复（20 页）

`z-paging` 统一改 `v-model="list"`；`index` 公告点击补实现并消除首屏对 `post-list` 的双请求；`lost-found` 卡片补点击跳转；`post-detail` 补 `null` 守卫（原首屏取 `post.title` 必崩）+ 去掉点赞数里恒为 0 的死项；`guide-detail` 修正「HTML 正文被转义后当纯文本显示」；`post-create`／`product-create` 修 `clientReqId` 每次重生成导致的**幂等失效**（会产生双帖）与分类下钻不足；`my-list` 补商品删除入口与收藏项正确跳转；`user-profile` 改用 `profile` 键 + `_id` 判本人 + 关注用后端真名 `targetUserId`；`notification` 修 `markRead` 参数（`notificationId`）并补 `targetType='user'`（关注通知）跳转；`report` 用 `description`；`checkin` 去掉臆测的 `action` 参数。

### 10.4 校验结果

- 全量 20 个 `.vue`：花括号配平 + `<template>`/`<script>`/`<style>` 三段标签开闭**全部通过**。
- 禁用 API / 废弃字段 / 违规色值扫描：`completeByData`、`completeError`、`pagingRef.value?.dataList`、`authorNickname`、`raw.anonymous`、`#35E0C8`、`#161B14` **全部归零**（`use-paged-list.ts` 内 4 处命中位于警示注释中，非调用）。
- 4 个 JSON 配置（`manifest.json` / `pages.json` / `package.json` / `tsconfig.json`）解析**全部通过**。
- **契约交叉校验**：前端 22 处 `callFunction('字面量')`（去重 27 个函数）+ 5 处 `fnName` 间接调用，与 `../campushub/cloudfunctions/` 的 37 个云函数逐一比对 → **0 缺失**。
- **路由校验**：全仓 `url: '/pages/...'` 跳转目标与 `pages.json` 页面表比对 → **0 缺失**。
- 尚未执行：本项目当前无 `node_modules`，**未跑** `vue-tsc` / 构建 / 真机验证 —— 上线前需补 `npm install` 后跑 `npm run type-check` 与三端构建。

**可复跑的校验脚本**（纯标准库，无需装包；均在 `campushub-uni/` 目录下执行）：

```bash
python scripts/verify_pages.py        # 页面/样式终验：结构+反模式+样式分层+一致性+z-paging+图标
python scripts/verify_contracts.py    # 契约交叉校验：前端 callFunction/fnName ↔ ../campushub/cloudfunctions 对比
python scripts/check_vue.py <file.vue>  # 单文件：花括号配平 + 顶层标签开闭 + CSS 花括号
```

> `verify_pages.py` 会**先剥离注释再扫描**，所以它报出的命中都是真实代码，不会把
> 「注释里提到的旧 API」误报成问题。结论输出到 `scripts/verify_pages.out.txt`。
> 当前基线：`real_code_hits=0  struct_failures=0  consistency_failures=0`。

### 10.5 已知限制与缺口

**后端侧（本次不改后端）：**

- `comment-create` 生成通知时 `targetType` 直接写死 `'post'`，因此**商品评论的通知会跳到帖子详情**，前端无法区分（需后端补 `targetType` 回填）。
- 他人主页的粉丝/关注数被后端脱敏，页面只能展示发帖数。
- `my-list` 收藏 tab 目前只支持查看与跳转，暂无「取消收藏」入口。

**功能缺口（后端已就绪，前端未接入）：**

- `post-update` / `product-update` 两个云函数已存在于后端，但**前端全仓 0 引用**，也没有任何编辑入口 ——
  即目前「发帖 / 发商品」只能创建与删除，**不能修改**。属于未做的功能，不是本次改动的回归；若要补齐，需在
  `my-list` 增加「编辑」动作并新增/复用 `post-create`、`product-create` 页的编辑模式（复用 `clientReqId` 幂等逻辑即可）。
- 后端另有 `admin` / `backup-db` / `category-manage` / `init-db` / `task-expire` / `verify` 等运维与定时型函数，
  前端不调用属预期。

**工程侧（需人工确认）：**

- `src/manifest.json` 的 `mp-weixin.appid` 为空字符串，小程序上传前必须填真实 AppID（H5 不受影响）。
- 本工程 `cloudfunctions/` 为空目录，37 个云函数实际在 `../campushub/cloudfunctions/`，部署动作请在原仓库执行（详见 §六 提示）。

