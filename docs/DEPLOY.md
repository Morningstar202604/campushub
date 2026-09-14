# CampusHub 部署上线指南

> 从零到上线，按顺序执行。每一步都有说明，不要跳步。

---

## 发布前快速 Checklist（30 秒版）

```bash
npm install          # 装依赖 + 自动同步 common 内核
npm run sync:common  # （保险起见再同步一次）
npm run doctor       # 自检：AppID / envId / 内核一致性 —— 错误必须清零
npm run verify       # 发布级静态校验：页面/组件/WXML/WXSS/依赖/图片 —— 必须 0 错误
npm run contract     # 跨端契约校验：前端 callFunction 与云函数 action 比对 —— 必须 0 错误
npm test             # 单元 + 契约测试 —— 必须 25/25
```

- [ ] `project.config.json` 已填 AppID
- [ ] `miniprogram/app.js` env 已改为真实环境 ID
- [ ] 37 个云函数已部署 + 2 个触发器已上传（第四步）
- [ ] 41 个索引已建全，`init-db` 返回 `missingIndexes: []`（第七步）
- [ ] 真机预览回归通过，重点看 TDesign 组件渲染（第九步）
- [ ] 主体资质与类目已确认：**UGC 社区类目需个体工商户及以上主体**，个人主体请先读 [`docs/COMPLIANCE.md`](./COMPLIANCE.md)
- [ ] 成本方案已确认：开发阶段用云开发免费体验版（¥0），上线前评估转个人版（¥19.9/月），详见 [`docs/COST.md`](./COST.md)

---

## 前置条件

- 注册了微信小程序账号（[mp.weixin.qq.com](https://mp.weixin.qq.com)）
- 已安装微信开发者工具（最新稳定版）
- Node.js >= 16（本地装 npm 依赖用）

> 💰 **省钱提示**：创建云开发环境时优先选**免费体验版**（¥0/月，开发阶段无需续费）。免费环境在小程序发布上线后有 15 天宽限期，届时再转个人版。详细成本对比见 [`docs/COST.md`](./COST.md)。

---

## 第一步：填 AppID

### 1.1 获取 AppID

登录 [mp.weixin.qq.com](https://mp.weixin.qq.com) → 开发管理 → 开发设置 → 开发者 ID → 复制 AppID

### 1.2 填入项目配置

打开 `project.config.json`，把 `appid` 填上：

```json
{
  "appid": "你的AppID",
  ...
}
```

---

## 第二步：创建云开发环境

### 2.1 开通云开发

微信开发者工具 → 导入项目（选择 campushub 目录）→ 顶部菜单「云开发」按钮 → 开通 → 创建环境

- **环境名称**：随意，如 `CampusHub`
- **环境 ID**：创建后复制，形如 `campushub-0g1234567890`

### 2.2 填入云环境 ID

打开 `miniprogram/app.js`，第 17 行：

```js
wx.cloud.init({
  env: '你的云环境ID',  // ← 替换这里
  traceUser: true
})
```

> 注意：云函数端不需要手动填环境 ID，`common-db.js` 用的是 `cloud.DYNAMIC_CURRENT_ENV`（自动识别）。

---

## 第三步：安装依赖 + 构建 npm

### 3.1 安装 npm 依赖

在项目根目录（CampusHub/）执行：

```bash
npm install
```

这会：
- 安装 `tdesign-miniprogram` 组件库
- 自动触发 `prepublishOnly` → 运行 `sync-common.js` → 把 `cloudfunctions/common/` 同步进所有云函数目录

### 3.2 构建 npm（微信开发者工具操作）

微信开发者工具 → 菜单栏「工具」→「构建 npm」

> **本仓库的 `miniprogram/miniprogram_npm/` 已提交入库**（标准结构：`miniprogram_npm/tdesign-miniprogram/` + `miniprogram_npm/dayjs/`），正常情况下**无需重新构建**，直接编译即可。
> 只有在升级 `tdesign-miniprogram` 版本后才有必要重新构建；构建后务必跑 `npm run verify` 校验产物结构（历史上曾因产物平铺缺包名层导致真机组件全部不渲染，verify 会拦住这类问题）。

---

## 第四步：上传部署全部云函数

> **推荐：先试自动化部署**（约 10 分钟，替代本步的逐个手动上传）：
>
> ```bash
> npm install                      # 安装依赖（含 miniprogram-ci）
> npm run sync:common              # 同步 common 内核到所有函数
> npm run doctor                   # 自检 AppID/环境ID/内核一致性
> ```
>
> 然后二选一：
> - **本地一键部署**：在项目根目录创建 `scripts/deploy.config.json`（已被 .gitignore 排除，不会入库）：
>   ```json
>   {
>     "appid": "你的AppID",
>     "privateKeyPath": "C:/path/to/private.key",
>     "environments": { "prod": { "envId": "你的环境ID" } }
>   }
>   ```
>   私钥在小程序后台「开发管理 → 开发设置 → 小程序代码上传」生成下载。然后执行 `npm run deploy`。
> - **CI 自动部署**：配置 GitHub Secrets（`WX_APPID`、`CLOUD_ENV_ID`、`WX_UPLOAD_PRIVATE_KEY_B64`），推送 cloudfunctions/** 到 main 即自动部署（见 `.github/workflows/deploy.yml`）。
>
> 手动部署方式保留如下，适用于不想装 CLI 的场景。

项目共 **37 个云函数**，全部需要部署。

### 4.1 批量部署

在微信开发者工具中：
1. 左侧文件树 → `cloudfunctions/` 目录
2. **逐个**右键每个云函数文件夹 →「上传并部署：云端安装依赖」
3. 等待每个部署完成（状态栏有进度提示）

> 37 个函数列表：
> `login`, `user-update`, `user-profile`, `post-create`, `post-list`, `post-detail`, `post-delete`, `post-update`, `product-create`, `product-list`, `product-detail`, `product-delete`, `product-update`, `comment-create`, `comment-list`, `comment-delete`, `like`, `collect`, `report`, `feedback-create`, `search`, `my-list`, `category-list`, `category-manage`, `guide-list`, `guide-detail`, `admin`, `resolve`, `task-expire`, `init-db`, `follow`, `checkin`, `notification`, `verify`, `backup-db`, `announcement`, `points`

### 4.2 部署定时触发器（共 2 个）

项目有 **2 个定时任务**，除了上传代码外，都需要单独部署触发器：

1. 右键 `cloudfunctions/task-expire/` →「上传触发器」
2. 右键 `cloudfunctions/backup-db/` →「上传触发器」
3. 确认 cron 表达式被正确部署：
   - `task-expire/config.json` → `"0 0 */6 * * *"`：每 6 小时执行（降本 C3：信息流已惰性过滤过期任务，cron 仅作归档兜底）
   - `backup-db/config.json` → `"0 0 3 * * * *"`：每日 03:00 全库备份到 `backups` 集合

> cron 格式为 6 字段：秒 分 时 日 月 周

---

## 第五步：配置云函数环境变量

### 5.1 管理员 OpenID（必配）

云开发控制台 → 云函数 → `admin` 函数 → 版本管理 → 环境变量：

| Key | Value |
|-----|-------|
| `ADMIN_OPENIDS` | `你的openid`（逗号分隔可配多个） |

> **如何获取你的 openid**：先部署好 `login` 云函数后，在小程序中登录一次，然后到云开发控制台 → 数据库 → `users` 集合 → 找到你的记录 → 复制 `openid` 字段值。

> 同样的环境变量也要配给 `resolve` 和 `category-manage` 函数（它们也调用 `checkAdmin`）。

### 5.2 init-db 安全密钥（必配，fail-closed）

云开发控制台 → 云函数 → `init-db` 函数 → 环境变量：

| Key | Value |
|-----|-------|
| `INIT_SECRET` | `你自定义的一串密钥`（如 `mySecret123`） |
| `SEED_SCHOOL_NAME` | （可选）种子数据默认学校名，默认 `韩山师范学院` |
| `SEED_SCHOOL_ID` | （可选）种子数据默认学校ID，默认 `HSFNC` |

> 配置后，调用 `init-db` 时必须传 `{ secret: '你的密钥' }` 才能执行，防止被人恶意调用。
> `SEED_SCHOOL_NAME` / `SEED_SCHOOL_ID` 用于覆盖种子数据里的示例学校（分类 + 指南），全国性部署可换成自己的学校，不改代码。

---

## 第六步：初始化数据库

### 6.1 调用 init-db 云函数

云开发控制台 → 云函数 → `init-db` → 点击「测试」→ 输入测试参数：

```json
{
  "secret": "你配置的INIT_SECRET"
}
```

> ⚠️ v0.6.1 起 INIT_SECRET 为**必配项**：未配置时 init-db 会直接拒绝执行（防止任意客户端重放初始化）。

### 6.2 检查返回结果

返回结果中应该看到：

```json
{
  "success": true,
  "message": "初始化完成，但还有 N 个索引未创建...",
  "results": [...],
  "missingIndexes": [...]  // ← 这个数组里是还需要手动建的索引
}
```

- `results` 里会显示哪些集合已创建、哪些种子数据已导入
- `missingIndexes` 里是还需要手动建的索引清单

### 6.3 自动创建的内容

`init-db` 会自动：
- 创建 15 个集合（users, posts, products, comments, likes, collects, guides, guide_categories, categories, reports, feedbacks, follows, checkins, notifications, view_logs）
- 导入 6 个指南分类 + 18 个内容分类（分区→吧→板块三级目录）+ 6 篇示例指南

> 种子数据中韩山师范学院相关内容仅为示例，上线后可通过管理后台「分类管理」增删改。

---

## 第七步：手动创建数据库索引（重要！）

> **微信云开发没有 `createIndex` API，索引只能在控制台手动创建。这是平台硬约束。**
> 不建索引 → 列表查不出数据 / 查询超时 / 速率限制失效。

### 7.1 去哪建

云开发控制台 → 数据库 → 选择集合 →「索引管理」→「新建索引」

### 7.2 索引清单（共 41 个）

> 完整定义见 `cloudfunctions/common/common-indexes.js` 和 `docs/INDEXES.md`

**users**（1个）
| 索引名 | 字段 | 唯一 |
|--------|------|------|
| idx_users_openid | openid(升) | 是 |

**posts**（11个）
| 索引名 | 字段 |
|--------|------|
| idx_posts_school_status_created | schoolId(降), status(降), createdAt(降) |
| idx_posts_school_status_pinned_created | schoolId(降), status(降), isPinned(降), createdAt(降) |
| idx_posts_user_created | userId(降), createdAt(降) |
| idx_posts_school_status_title | schoolId(降), status(降), title(降) |
| idx_posts_category_status_created | categoryPath(降), status(降), createdAt(降) |
| idx_posts_status_kind_expire | status(降), kind(降), expireAt(降) |
| idx_posts_status_created | status(降), createdAt(降) |
| idx_posts_status_likes | status(降), likeCount(降) |
| idx_posts_status_pinned_created | status(降), isPinned(降), createdAt(降) |
| idx_posts_category_status_pinned_created | categoryPath(降), status(降), isPinned(降), createdAt(降) |
| idx_posts_status_likes_created | status(降), likeCount(降), createdAt(降) |

**categories**（2个）
| 索引名 | 字段 |
|--------|------|
| idx_categories_parent | parentId(升) |
| idx_categories_status_level_order | status(升), level(升), order(升) |

**products**（4个）
| 索引名 | 字段 |
|--------|------|
| idx_products_school_status_created | schoolId(降), status(降), createdAt(降) |
| idx_products_school_status_category_created | schoolId(降), status(降), category(降), createdAt(降) |
| idx_products_user_created | userId(降), createdAt(降) |
| idx_products_school_status_title | schoolId(降), status(降), title(降) |

**comments**（3个）
| 索引名 | 字段 |
|--------|------|
| idx_comments_target_status_created | targetId(升), status(升), createdAt(降) |
| idx_comments_user_created | userId(降), createdAt(降) |
| idx_comments_parent_status_created | parentId(升), status(升), createdAt(升) |

**likes / collects**（3个）
| 集合 | 索引名 | 字段 |
|------|--------|------|
| likes | idx_likes_user_target_type | userId(升), targetId(升), type(升) |
| collects | idx_collects_user_target_type | userId(升), targetId(升), type(升) |
| collects | idx_collects_user_created | userId(降), createdAt(降) |

**reports / feedbacks**（3个）
| 集合 | 索引名 | 字段 |
|------|--------|------|
| reports | idx_reports_reporter_created | reporterId(升), createdAt(降) |
| reports | idx_reports_status_created | status(升), createdAt(降) |
| feedbacks | idx_feedbacks_user_created | userId(升), createdAt(降) |

**guides / guide_categories**（3个）
| 集合 | 索引名 | 字段 |
|------|--------|------|
| guides | idx_guides_school_status_category_sort_created | schoolId(升), status(升), categoryId(升), sort(升), createdAt(降) |
| guides | idx_guides_school_status_title | schoolId(升), status(升), title(降) |
| guide_categories | idx_guide_categories_school | schoolId(升) |

**follows**（3个）
| 索引名 | 字段 | 唯一 |
|--------|------|------|
| idx_follows_follower_created | followerId(升), createdAt(降) | 否 |
| idx_follows_following_created | followingId(升), createdAt(降) | 否 |
| idx_follows_follower_following | followerId(升), followingId(升) | 是 |

**checkins**（1个）
| 索引名 | 字段 |
|--------|------|
| idx_checkins_user_date | userId(升), date(升) |

**notifications**（2个）
| 索引名 | 字段 |
|--------|------|
| idx_notifications_user_created | userId(升), createdAt(降) |
| idx_notifications_user_read | userId(升), isRead(升) |

**backups / search_queries / admin_logs / announcements / points_orders**（5个）
| 集合 | 索引名 | 字段 |
|------|--------|------|
| backups | idx_backups_created | createdAt(降) |
| search_queries | idx_search_queries_user_created | userId(升), createdAt(降) |
| admin_logs | idx_admin_logs_created | createdAt(降) |
| announcements | idx_announcements_status_pinned_created | status(升), isPinned(降), createdAt(降) |
| points_orders | idx_points_orders_user_created | userId(升), createdAt(降) |

### 7.3 验证索引齐全

建完后，重新调用一次 `init-db`（带 secret），返回的 `missingIndexes` 应为空数组 `[]`。

---

## 第八步：配置内容安全 API

项目使用 `msgSecCheck`（文本审核）和 `imgSecCheck`（图片审核），需要确认 API 权限。

### 8.1 检查权限

mp.weixin.qq.com → 开发管理 → 接口设置 → 找到「内容安全」相关接口：
- `security.msgSecCheck` — 确保已开通
- `security.imgSecCheck` — 确保已开通

> 大部分小程序账号默认有这两个接口权限（免费额度：文本 100 万次/天，图片 1 万次/天）。

### 8.2 fail-closed 机制说明

如果内容安全 API 未开通或调用失败，项目会**拒绝发布**（而非放行）。这是安全设计，但意味着：
- 上线前务必确认 API 可用，否则用户发不了帖
- 测试阶段可以在云函数日志中观察 `[内容安全]` 开头的日志

---

## 第九步：本地测试

### 9.0 发布级静态校验（先跑这个）

```bash
npm run verify
```

覆盖：页面四件套 / tabBar 图标 / JS 语法 / require 解析 / WXML 标签平衡与组件注册 / WXSS 变量 / 图片引用 / 云函数依赖。**0 错误才继续往下**（有错误时输出会指明文件与原因）。

### 9.1 预览测试

微信开发者工具 → 点击「预览」→ 用手机扫码体验

### 9.2 测试清单

按以下顺序测试核心流程：

1. **登录**：进入小程序 → 登录页 → 填昵称 → 勾选协议 → 进入
2. **发帖**：首页 + 号 → 发帖子 → 选分类 → 发布 → 看到帖子出现在首页
3. **评论**：点进帖子详情 → 写评论 → 发送 → 楼中楼回复
4. **点赞/收藏**：帖子详情 → 点赞 → 收藏
5. **发商品**：首页 + 号 → 卖东西 → 填信息 → 发布
6. **搜索**：搜索页搜刚发的帖子标题
7. **个人中心**：统计数据是否正确 → 签到 → 消息
8. **管理后台**（如果配了管理员）：我的 → 管理后台 → 举报审核 / 帖子管理 / 用户封禁

### 9.3 常见问题排查

| 现象 | 原因 | 解决 |
|------|------|------|
| 页面空白 / 列表不出数据 | 索引未建全 | 回到第七步补建索引 |
| 发帖提示"内容审核服务暂不可用" | 内容安全 API 未开通 | 第八步检查 |
| 管理后台不显示 | 未配 ADMIN_OPENIDS | 第五步配置 |
| 云函数调用报错 | 云函数未部署 | 第四步部署 |
| TDesign 组件不显示 | 未构建 npm，或 `miniprogram_npm` 产物结构被破坏 | 第三步重建 npm 后跑 `npm run verify` |
| 定时任务不执行 | 触发器未部署 | 第四步 4.2 部署触发器（task-expire + backup-db 共 2 个） |

---

## 第十步：正式上线

### 10.1 上传代码

微信开发者工具 → 上传 → 填写版本号（当前为 `0.8.1`）和备注 → 上传

### 10.2 提交审核

mp.weixin.qq.com → 版本管理 → 开发版本 → 提交审核

### 10.3 审核注意事项

- ⚠️ **类目与主体资格先确认**：本项目为 UGC 社区，类目「社交 > 社区/论坛」**要求个体工商户及以上主体**，个人主体无法选该类目。三条可行路径（办个体工商户 / 收敛为工具形态 / 先发体验版）详见 [`docs/COMPLIANCE.md`](./COMPLIANCE.md)——**提交审核前必读**，避免白跑审核
- 内容安全已内置（fail-closed），审核一般能过
- 用户协议页面已配（登录必须勾选）
- 不涉及支付交易（商品仅信息展示）
- 纯 wx.cloud 架构无需配置 request 合法域名；若后续接入自有后端，域名必须 ICP 备案（详见 [`docs/COST.md`](./COST.md) 第一节）

### 10.4 发布上线

审核通过后 → 版本管理 → 审核通过版本 → 发布

---

## 附录：各配置项速查表

| 配置项 | 文件位置 | 值 |
|--------|----------|-----|
| AppID | `project.config.json` → `appid` | 你的小程序 AppID |
| 云环境 ID | `miniprogram/app.js` → `env` | 你的云环境 ID |
| 管理员 OpenID | 云函数 `admin` 环境变量 `ADMIN_OPENIDS` | 你的 openid |
| init-db 密钥 | 云函数 `init-db` 环境变量 `INIT_SECRET` | 自定义密钥 |
| 数据库索引 | 云开发控制台手动创建 | 见第七步 |
| 定时触发器 | `task-expire/config.json` | `0 0 */6 * * *`（每 6 小时） |
| 一键部署配置 | `scripts/deploy.config.json`（不入库，模板见 `deploy.config.example.json`） | appid / privateKeyPath / environments |
| 部署前自检 | 终端执行 `npm run doctor` | 错误阻断，警告提示 |
| 发布级校验 | 终端执行 `npm run verify` | 必须 0 错误，可接 CI |
| 成本方案 | [`docs/COST.md`](./COST.md) | 免费体验版 ¥0 → 个人版 ¥19.9/月 |
| 主体/类目/备案合规 | [`docs/COMPLIANCE.md`](./COMPLIANCE.md) | UGC 类目需个体工商户及以上 |

---

## 附录：项目架构速览

```
CampusHub/
├── miniprogram/           # 小程序前端（23 个页面，TDesign 组件库）
│   └── miniprogram_npm/   # npm 构建产物（已入库，标准结构，勿手动改动）
├── cloudfunctions/        # 云函数（37 个）
│   └── common/            # 共享内核层（单一事实来源）
├── scripts/
│   ├── sync-common.js     # 内核同步脚本
│   ├── deploy.js          # miniprogram-ci 一键部署（配合 deploy.config.json）
│   ├── doctor.js          # 部署前自检（npm run doctor）
│   ├── verify-release.js  # 发布级静态校验（npm run verify）
│   └── sync-mirrors.sh    # 三平台同步脚本
├── docs/
│   ├── DEPLOY.md          # 本文件
│   ├── COST.md            # 成本与云服务选型（CF 可行性分析）
│   ├── COMPLIANCE.md      # 主体资质 / 类目 / 备案合规
│   ├── INDEXES.md         # 索引必建清单
│   └── SYNC.md            # 三端同步说明
└── project.config.json    # 项目配置
```
