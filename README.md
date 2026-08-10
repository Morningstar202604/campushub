# 韩师校园通 (CampusHub)

> 面向韩山师范学院师生的校园信息服务平台（微信小程序 + 云开发）

## 功能模块

- **首页信息流**：帖子 + 商品瀑布流，推荐/最新/二手 Tab 切换
- **贴吧式发帖**：支持图文帖子、分类、标签、匿名发布
- **二手交易**：商品发布、分类筛选、联系方式展示（纯信息展示，不做担保交易）
- **校园指南**：新生入学、学习攻略、生活指南等分类指南（按 `categoryId` 正确筛选）
- **搜索**：全站搜索帖子、商品、指南（关键字已转义 + 限长，防正则注入）
- **个人中心**：资料管理、我的发布/收藏、反馈、删除自己内容
- **内容安全**：所有 UGC 经微信内容安全 API，**fail-closed（审核失败即拒绝发布）**
- **账号治理**：`admin` 云函数支持封禁/解封，对所有写操作统一拦截
- **管理员审核台**：`pages/admin` 列出待处理举报，支持删除违规内容、封禁作者、标记已处理（权限始终云端校验，前端仅按 `isAdmin` 显示入口）

## 技术栈

- **前端**：原生微信小程序（WebView 渲染）
- **UI 组件**：TDesign 微信小程序组件库
- **后端**：微信云开发（云函数 + 云数据库 + 云存储）
- **架构**：`cloudfunctions/common/` 共享内核层（鉴权 / 内容安全 / 封禁 / 限流 / 返回格式 / 内容删除 单一事实来源）

## 目录结构

```
campushub/
├── miniprogram/              # 小程序前端
│   ├── app.js               # 应用入口（云开发初始化）
│   ├── app.json             # 全局配置
│   ├── app.wxss             # 全局样式 + Design Token
│   ├── pages/               # 页面
│   │   ├── index/           # 首页（信息流瀑布流）
│   │   ├── login/           # 登录页
│   │   ├── post-publish/    # 发帖页
│   │   ├── post-detail/     # 帖子详情+评论（作者可删帖/删评论）
│   │   ├── product-publish/ # 商品发布
│   │   ├── product-detail/  # 商品详情（作者可下架）
│   │   ├── guide/           # 校园指南列表（分类筛选）
│   │   ├── guide-detail/    # 指南详情
│   │   ├── search/          # 搜索
│   │   ├── profile/         # 个人中心（管理员显示管理入口）
│   │   ├── profile-edit/    # 编辑资料（含头像）
│   │   ├── my-list/         # 我的发布/收藏（可直接删除）
│   │   ├── feedback/        # 意见反馈（经云函数，带内容安全）
│   │   ├── agreement/       # 用户协议
│   │   └── admin/           # 管理员审核台（举报列表/删内容/封禁/标记处理）
│   └── utils/               # 工具函数
│       ├── request.js       # 云函数调用封装
│       ├── auth.js          # 登录态管理
│       └── format.js        # 格式化工具
├── cloudfunctions/           # 云函数
│   ├── common/              # ★ 共享内核层（被同步进每个函数目录）
│   │   ├── common-db.js      # 云环境/数据库初始化
│   │   ├── common-error.js   # 统一错误模型 + wrap()
│   │   ├── common-context.js # 用户上下文与鉴权（requireActiveUser）
│   │   ├── common-security.js# fail-closed 内容安全
│   │   ├── common-rate.js    # 统一频率限制
│   │   ├── common-content.js # 内容删除单一事实来源（软删除+回收图片+计数回退+管理员越权）
│   │   └── common-bundle.js  # 统一出口
│   ├── login/               # 登录/注册
│   ├── post-list/           # 帖子列表
│   ├── post-create/         # 创建帖子
│   ├── post-detail/         # 帖子详情
│   ├── post-delete/         # ★ 删除帖子（仅作者/管理员）
│   ├── product-list/        # 商品列表
│   ├── product-create/      # 创建商品
│   ├── product-detail/      # 商品详情
│   ├── product-delete/      # ★ 下架商品（仅作者/管理员）
│   ├── comment-list/        # 评论列表
│   ├── comment-create/      # 创建评论
│   ├── comment-delete/      # ★ 删除评论（仅作者/管理员）
│   ├── like/                # 点赞/取消
│   ├── collect/             # 收藏/取消、举报
│   ├── guide-list/          # 指南列表（按 categoryId 筛选）
│   ├── guide-detail/        # 指南详情
│   ├── search/              # 全站搜索（关键字转义+限长）
│   ├── user-update/         # 更新用户信息
│   ├── my-list/             # 我的列表（软删除过滤）
│   ├── report/              # 举报
│   ├── feedback-create/     # ★ 反馈提交（经内容安全）
│   ├── admin/               # ★ 管理员封禁/解封 + 审核台(list-reports/delete/resolve)
│   └── init-db/             # 初始化集合与种子数据（含 categoryId）
├── scripts/
│   └── sync-common.js       # 将 common/ 同步进每个云函数目录
├── docs/
│   └── DATABASE_INDEXES.md  # 必须的数据库复合索引清单
├── project.config.json      # 项目配置（请填真实 appid）
└── package.json             # npm 依赖 + sync:common 脚本
```

## 架构要点：共享内核层

所有云函数的鉴权、内容安全、封禁拦截、频率限制、返回格式、内容删除都收敛到
`cloudfunctions/common/`。每个云函数用一行引入：

```js
const { getDB, ok, wrap, requireActiveUser, checkContents, rateLimit, removeContent } = require('./common-bundle')
```

**部署前**，运行一次同步脚本，把内核层复制进每个函数目录
（已配置为 `prepublishOnly`，`npm install`/上传时自动执行）：

```bash
npm run sync:common
```

这样仓库里"一份源码"即为唯一事实来源，避免重复实现导致的不一致。

## 快速开始

### 1. 安装依赖并同步内核层

```bash
cd campushub
npm install            # 会触发 prepublishOnly → 自动同步 common 层
# 或手动：npm run sync:common
```

### 2. 构建 npm

在微信开发者工具中：菜单 → 工具 → 构建 npm（用于 TDesign 等 npm 组件）

### 3. 配置云开发

1. 开通云开发，创建云环境（如 `campushub`）
2. 修改 `miniprogram/app.js` 中的 `env` 为你的云环境 ID
3. 修改 `project.config.json` 的 `appid` 为真实小程序 AppID
4. **上传部署全部 23 个云函数**（含 `common-*` 文件已随同步脚本进入各函数目录）

### 4. 创建数据库集合

在云开发控制台创建以下集合：
`users`、`posts`、`products`、`comments`、`likes`、`collects`、
`guides`、`guide_categories`、`reports`、`feedbacks`、`config`

### 5. 建立必须的索引

多字段排序与高频查询依赖复合/单字段索引，详见 **`docs/DATABASE_INDEXES.md`**。
**不建索引，推荐流与指南列表会直接查询报错。**

### 6. 初始化数据

在云开发控制台手动调用 `init-db` 云函数一次：创建集合 + 导入分类与指南种子数据。
（该函数已做幂等保护，重复调用安全。）

### 7. 配置管理员（启用封禁 + 审核台）

`admin` 云函数识别管理员优先级：
1. 云函数环境变量 `ADMIN_OPENIDS`（逗号分隔的 openid 列表）——**推荐**；
2. 或数据库 `config` 集合 `doc('global').adminOpenids` 数组。

在微信云开发控制台给 `admin` 函数配置环境变量后，对应用户在"我的"页会出现
"管理后台"入口，进入 `pages/admin` 审核台（列出待处理举报、删除违规内容、封禁作者、标记已处理）。
**真实权限始终在 `admin` 云函数云端校验**，前端 `isAdmin` 仅控制入口显隐，不可绕过。

## 设计要点

- **匿名机制**：帖子/评论可匿名，商品不可匿名（信任隔离）
- **内容安全 fail-closed**：内容安全 API 未开通/超限/命中违规 → 一律拒绝发布，宁可拦错不漏放
- **封禁一致性**：`requireActiveUser()` 统一拦截被封禁用户，所有写操作必经过
- **内容删除单一事实来源**：`removeContent()` 统一软删除 + 云存储图片回收 + 计数回退 + 管理员越权，消除多份近似实现
- **软删除**：删除仅置 `status='deleted'`，保留数据可追溯，计数同步回退
- **安全搜索**：关键字正则转义 + 限长 20 字，杜绝正则注入与 ReDoS
- **零成本**：云开发免费额度足够 1000 日活 MVP 阶段使用

## 更新日志

- **v0.4** — 管理员前端审核台（开 A）：① 抽 `common-content.js` 的 `removeContent` 作内容删除单一事实来源，消除 4 处重复删除逻辑，并修复原"管理员删除"死代码分支（`users` 从不写 `role`，管理员实际删不了内容）；② `admin` 云函数扩展 `check`/`list-reports`/`delete`/`resolve`，举报列表 join 目标内容摘要与作者；③ 新增 `pages/admin` 审核台（删内容/封禁作者/标记处理 + 手动封禁框）；④ `profile` 调 `admin.check` 按 `isAdmin` 显示入口，真实权限始终云端校验。
- **v0.3** — 小版本完善：① 修复图片上传一律存 `.jpg` 的 bug（按真实扩展名存储）；② 编辑资料补全头像能力（`chooseAvatar` 上传云存储）；③ 删除帖子/商品时回收云存储图片，避免孤儿文件累积；④ 发布页增加单张图片 9MB 大小校验。
- **v0.2** — 架构重构：引入 `cloudfunctions/common/` 共享内核层，根本性修复内容安全 fail-closed、封禁一致性、指南分类、删除功能等 13 项问题。
- **v0.1** — 初始版本：微信小程序 + 云开发基础功能（贴吧、二手、指南、搜索、个人中心）。

## 后续规划

- [x] 管理员前端页面（封禁/解封/内容审核台）— v0.4 已完成
- [x] 图片内容安全（`imgSecCheck`：发帖 / 商品图片上传后经云函数 fail-closed 二次校验）
- [ ] 多校扩展
- [ ] 自建后端迁移（Node.js + PostgreSQL）
- [ ] 实时消息通知
- [ ] 校园活动模块
