# CampusHub

> 全国性校园 / 兴趣内容社区（微信小程序 + 云开发）——一个新时代的开源贴吧。
> *Originally prototyped for a single campus (韩山师范学院); now open and national by design.*

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.5.0-green.svg)](CHANGELOG.md)

## 这是什么

CampusHub 是一个基于**微信小程序 + 微信云开发**的内容社区，定位是「新时代的贴吧」：
用户可以在**多级分类目录**下自由发帖、提问、交易、找同好，并按分类快速找到想要的内容。

- 内容**默认全国可见**，不再钉死在某一所学校（早期以韩师作为示例校区，现已去除单校限制）；
- 分类树可无限下钻到「分区 → 吧 → 板块」三级，加学校、开新吧**由管理员在后台点几下完成**，无需改代码重部署；
- 任务类内容支持**自动过期**与**已解决标注**，长期沉淀不淹没首页。

## 功能特性

- **多级分类目录**：分区 → 吧 → 板块三级；每帖记录 `categoryPath` 祖先路径，点任意父节点可捞出其下全部内容；仅允许发到叶子节点，避免内容堆在笼统大类。
- **信息流首页**：帖子 + 商品瀑布流，推荐 / 最新 / 二手 Tab 切换；顶部支持分类筛选与过期页入口。
- **贴吧式发帖**：图文帖子、分类、标签、匿名发布。
- **任务与过期机制**：任务帖可选有效期 3/7/15/30 天；定时函数每小时扫描，过期自动沉入「过期页」且不再推首页；作者 / 管理员可标「已解决」。
- **分类管理后台**：`category-manage` 云函数（管理员 CRUD）+ `category-admin` 小程序页，加学校、开新吧、改分区结构变为运营动作。
- **二手交易**：商品发布、分类筛选、联系方式展示（纯信息展示，不做担保交易）。
- **校园指南**：新生入学、学习攻略、生活指南等分类指南。
- **搜索**：全站搜索帖子、商品、指南（关键字已转义 + 限长，防正则注入）。
- **个人中心**：资料管理、我的发布 / 收藏、反馈、删除自己内容。
- **内容安全**：所有 UGC 经微信内容安全 API，**fail-closed（审核失败即拒绝发布）**。
- **账号治理**：`admin` 云函数支持封禁 / 解封，对所有写操作统一拦截；管理员审核台处理举报。

## 技术栈

- **前端**：原生微信小程序（WebView 渲染）
- **UI 组件**：TDesign 微信小程序组件库
- **后端**：微信云开发（云函数 + 云数据库 + 云存储）
- **架构**：`cloudfunctions/common/` 共享内核层（鉴权 / 内容安全 / 封禁 / 限流 / 返回格式 / 内容删除 / 索引定义 单一事实来源）

## 目录结构

```
campushub/
├── miniprogram/              # 小程序前端
│   ├── app.js               # 应用入口（云开发初始化）
│   ├── app.json             # 全局配置
│   ├── app.wxss             # 全局样式 + Design Token
│   ├── pages/
│   │   ├── index/           # 首页（信息流 + 分类筛选 + 过期入口）
│   │   ├── login/           # 登录页
│   │   ├── post-publish/    # 发帖页（分类选择 + 任务/有效期）
│   │   ├── post-detail/     # 帖子详情 + 评论（作者可删帖/删评论/标记已解决）
│   │   ├── expired/         # 过期页（已过期任务归档）
│   │   ├── category-admin/  # 分类管理后台（树形增删改，管理员）
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
│   │   └── admin/           # 管理员审核台（举报列表/删内容/封禁/标记处理/分类管理入口）
│   └── utils/               # 工具函数（request / auth / format）
├── cloudfunctions/           # 云函数（共 27 个可部署函数）
│   ├── common/              # ★ 共享内核层（被同步进每个函数目录）
│   │   ├── common-db.js      # 云环境/数据库初始化
│   │   ├── common-error.js   # 统一错误模型 + wrap()
│   │   ├── common-context.js # 用户上下文与鉴权（requireActiveUser）
│   │   ├── common-security.js# fail-closed 内容安全 + checkAdmin
│   │   ├── common-rate.js    # 统一频率限制
│   │   ├── common-content.js # 内容删除单一事实来源（软删除+回收图片+计数回退+管理员越权）
│   │   ├── common-indexes.js # ★ 数据库索引定义（单一事实来源）
│   │   └── common-bundle.js  # 统一出口
│   ├── category-list/       # 分类列表（按 parentId 下钻）
│   ├── category-manage/     # ★ 分类 CRUD（仅管理员）
│   ├── resolve/            # ★ 标记任务「已解决」（作者/管理员）
│   ├── task-expire/        # ★ 定时过期扫描（timer 触发）
│   ├── login/               # 登录/注册
│   ├── post-list/           # 帖子列表（支持 categoryPath 包含筛选）
│   ├── post-create/        # 创建帖子（校验叶子节点 + 任务有效期）
│   ├── post-detail/         # 帖子详情
│   ├── post-delete/         # 删除帖子（仅作者/管理员）
│   ├── product-list/        # 商品列表
│   ├── product-create/      # 创建商品
│   ├── product-detail/      # 商品详情
│   ├── product-delete/      # 下架商品（仅作者/管理员）
│   ├── comment-list/        # 评论列表
│   ├── comment-create/      # 创建评论
│   ├── comment-delete/      # 删除评论（仅作者/管理员）
│   ├── like/                # 点赞/取消
│   ├── collect/             # 收藏/取消、举报
│   ├── guide-list/          # 指南列表（按 categoryId 筛选）
│   ├── guide-detail/        # 指南详情
│   ├── search/              # 全站搜索（关键字转义+限长）
│   ├── user-update/         # 更新用户信息
│   ├── my-list/             # 我的列表（软删除过滤）
│   ├── report/              # 举报
│   ├── feedback-create/     # 反馈提交（经内容安全）
│   ├── admin/               # 管理员封禁/解封 + 审核台 + checkAdmin
│   └── init-db/             # 初始化集合与种子数据（含索引自检）
├── scripts/
│   ├── sync-common.js       # 将 common/ 同步进每个云函数目录
│   └── sync-mirrors.sh      # 三端（GitCode/Gitee/GitHub）同步脚本（受限网下用 /etc/hosts 指回真实 IP）
├── docs/
│   ├── INDEXES.md           # ★ 数据库索引必建清单 + 控制台步骤（权威，引用 common-indexes.js）
│   └── SYNC.md              # 三端同步说明
├── project.config.json      # 项目配置（请填真实 appid）
├── package.json             # npm 依赖 + sync:common 脚本 + 开源元信息
├── LICENSE                  # Apache License 2.0
├── NOTICE                   # Apache NOTICE
├── CODE_OF_CONDUCT.md       # 贡献者行为准则
├── CONTRIBUTING.md          # 贡献指南
├── SECURITY.md              # 安全漏洞报告策略
└── CHANGELOG.md             # 版本变更记录
```

## 架构要点：共享内核层

所有云函数的鉴权、内容安全、封禁拦截、频率限制、返回格式、内容删除、索引定义都收敛到
`cloudfunctions/common/`。每个云函数用一行引入：

```js
const { getDB, ok, wrap, requireActiveUser, checkContents, rateLimit, removeContent, checkAdmin } = require('./common-bundle')
```

**部署前**，运行同步脚本，把内核层复制进每个函数目录
（已配置为 `prepublishOnly`，`npm install`/上传时自动执行）：

```bash
npm run sync:common
```

这样仓库里「一份源码」即为唯一事实来源，避免重复实现导致的不一致。当前仓库共 **27 个**可部署云函数，全部携带内核层副本。

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
4. **上传部署全部 27 个云函数**（含 `common-*` 文件已随同步脚本进入各函数目录）

### 4. 创建数据库集合

在云开发控制台创建以下集合：
`users`、`posts`、`products`、`comments`、`likes`、`collects`、
`guides`、`guide_categories`、`categories`、`reports`、`feedbacks`、`config`

### 5. 建立必须的索引

微信云开发的 `wx-server-sdk` **没有 `createIndex` API**，索引只能在控制台手动创建（平台硬限制）。
本项目把索引定义固化为单一事实来源 `cloudfunctions/common/common-indexes.js`，
并在 `init-db` 部署时**自动检测缺失并回显 `missingIndexes`**。

建索引的字段清单与控制台步骤见 **`docs/INDEXES.md`**。
运行一次 `init-db` 后，查看返回结果里的 `missingIndexes`——为空即建全，绝不会静默漏建。

### 6. 初始化数据

在云开发控制台手动调用 `init-db` 云函数一次：创建集合 + 导入分类与指南种子数据
（含 4 个一级分区、若干吧与板块，韩师作为示例校区）。该函数已做幂等保护，重复调用安全。

### 7. 配置管理员（启用封禁 + 审核台 + 分类管理）

`admin` / `category-manage` 云函数识别管理员优先级：
1. 云函数环境变量 `ADMIN_OPENIDS`（逗号分隔的 openid 列表）——**推荐**；
2. 或数据库 `config` 集合 `doc('global').adminOpenids` 数组。

在微信云开发控制台给 `admin` 函数配置环境变量后，对应用户在「我的」页会出现
「管理后台」入口，进入 `pages/admin` 审核台与 `pages/category-admin` 分类管理。
**真实权限始终在云函数云端校验**，前端 `isAdmin` 仅控制入口显隐，不可绕过。

## 分类管理（运营动作）

加学校、开新吧、调整分区结构，不再需要改代码重部署：

1. 管理员在「管理后台」点击「📂 分类管理」进入 `category-admin`；
2. 树形列表展示全部分区 / 吧 / 板块，支持展开下钻；
3. 新增子节点时按父级自动计算 `level`、限制 ≤ 3 级、继承 `schoolId`；
4. 修改父级有防环校验；删除会拒绝「仍有子节点」的节点并软删（历史帖子引用不失效）。

## 设计要点

- **匿名机制**：帖子 / 评论可匿名，商品不可匿名（信任隔离）
- **内容安全 fail-closed**：内容安全 API 未开通 / 超限 / 命中违规 → 一律拒绝发布，宁可拦错不漏放
- **封禁一致性**：`requireActiveUser()` 统一拦截被封禁用户，所有写操作必经过
- **内容删除单一事实来源**：`removeContent()` 统一软删除 + 云存储图片回收 + 计数回退 + 管理员越权
- **多级分类筛选**：`categoryPath` 祖先路径数组，单索引即可按任意父节点捞出其下全部内容
- **任务过期与解决**：`task-expire` 定时函数每小时扫描超时任务置 `status:'expired'`；`resolve` 仅作者 / 管理员可标「已解决」
- **索引自检**：`init-db` 部署时比对 `common-indexes.js` 与线上索引，缺失项回显，消除人因遗漏
- **软删除**：删除仅置 `status='deleted'`，保留数据可追溯，计数同步回退
- **安全搜索**：关键字正则转义 + 限长 20 字，杜绝正则注入与 ReDoS
- **零成本**：云开发免费额度足够 1000 日活 MVP 阶段使用

## 开源与多平台同步

本项目以 **Apache License 2.0** 开源（见 `LICENSE` 与 `NOTICE`）。

代码在三个平台保持同步：**GitCode**（canonical 源）、**Gitee**、**GitHub**。
本地维护用 `scripts/sync-mirrors.sh`（`--from gitcode` 模式）一键推三端；
GitHub 侧的 `.github/workflows/mirror.yml` 也会在推送时自动镜像到 GitCode 与 Gitee。

贡献、反馈与安全漏洞报告方式见 `CONTRIBUTING.md` 与 `SECURITY.md`。

## 更新日志

- **v0.5.0** — 全国性贴吧化 + 可运营化：① 移除单校硬编码，内容默认全国可见；② 多级分类目录（分区→吧→板块）+ `categoryPath` 祖先路径筛选，仅发到叶子节点；③ 任务过期与已解决标注（`task-expire` 定时 + `resolve`）；④ 分类管理后台（`category-manage` 云函数 + `category-admin` 页），加学校/开吧无需改代码；⑤ 索引定义固化为 `common-indexes.js` 单一事实来源，`init-db` 部署自检 `missingIndexes`；⑥ `checkAdmin` 提取至 common 层；⑦ 三端同步脚本修复受限网络 TLS 失败。详见 `CHANGELOG.md`。
- **v0.4.0** — 管理员前端审核台：抽 `removeContent` 作删除单一事实来源；`admin` 扩展 `check`/`list-reports`/`delete`/`resolve`；新增 `pages/admin`；`profile` 按 `isAdmin` 显隐入口。
- **v0.3.0** — 图片扩展名修复、头像上传、云存储图片回收、9MB 单图校验。
- **v0.2.0** — 架构重构：引入 `cloudfunctions/common/` 共享内核层，修复 13 项问题。
- **v0.1.0** — 初始版本：微信小程序 + 云开发基础功能。

## 后续规划

- [x] 管理员前端页面（封禁/解封/内容审核台）— v0.4.0 已完成
- [x] 图片内容安全（`imgSecCheck`）— v0.4.0 已完成
- [x] 多级分类目录 + 分类管理后台 — v0.5.0 已完成
- [x] 任务过期与已解决标注 — v0.5.0 已完成
- [ ] 内容推荐 / 热度排序增强
- [ ] 自建后端迁移（Node.js + PostgreSQL）
- [ ] 实时消息通知
- [ ] 校园活动模块
- [ ] 多语言（英文界面）

## License

[Apache License 2.0](LICENSE) © 2026 weed33834。详见 `NOTICE`。
