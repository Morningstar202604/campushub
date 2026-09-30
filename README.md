# CampusHub · 校园内容社区（v2）

> 面向在校学生的内容社区：二手市集、失物招领、表白墙、兼职拼车、校园指南、签到积分、消息通知、举报闭环——一套 H5 全部搞定，自建后端，任何学校 / 组织可一键部署。

**技术栈**：Vue 3 + Vite + TS + Pinia + Vant 4（学生端） · NestJS + Prisma + PostgreSQL（服务层） · 开源管理后台（vue-pure-admin）

---

## 一、这是什么

一个移动端 H5 应用覆盖学生日常高频场景：**二手闲置、失物招领、表白墙、课程学习、校园活动、兼职实习、拼车拼团、闲聊树洞** 八类内容，加上**市集、校园指南、签到积分、消息通知、举报闭环**。

两个端 + 一套服务层：

| 端 | 给谁用 | 入口 |
|---|---|---|
| **学生端 H5** | 学生 | `apps/web`（Vue3 + Vant，手机浏览器 / 微信内打开） |
| **服务层 API** | 前后端共享 | `apps/server`（NestJS + Prisma，REST + OpenAPI 文档） |
| **管理后台** | 管理员 | `apps/admin`（vue-pure-admin 开源后台） |

> **v2 说明**：上一版（uni-app + 微信云开发）与 v1（Supabase 开源后端）均已废弃。v2 改为**纯 Web H5 + 自建 NestJS 服务层**，脱离第三方平台绑定，业务逻辑全部落在自己代码里，可测试、可观察、可扩展。

---

## 二、功能清单

**学生端**
- 首页信息流：推荐 / 最新 / 热榜三种排序，八分类横滑筛选，公告栏，置顶 / 精华标识
- 市集：二手商品网格、价格 / 成色 / 交易方式展示、防诈骗提示、点赞 / 收藏 / 评论
- 发布：四场景表单（发帖子 / 卖闲置 / 失物招领 / 匿名表白墙），最多 9 图上传（客户端压缩 + 进度条）
- 帖子详情：图片预览、点赞、收藏、评论、回复、举报；失物 / 任务可标记解决，任务帖可设过期
- 搜索：帖子 + 商品统一搜索（Postgres 模糊匹配）
- 校园指南：分类导航 + Markdown 富文本（DOMPurify 渲染）
- 签到打卡：每日签到 +1 积分，连续 7 天额外 +5，断签重计（服务端事务防重）
- 消息中心：点赞 / 评论 / 系统通知，未读红点，一键已读
- 个人中心：资料展示 / 编辑、我的帖子 / 商品 / 收藏、退出登录
- 登录注册：邮箱密码 + JWT 双 token（access 内存 + refresh 持久化，自动续期）

**服务层（自建）**
- 13 个业务模块：auth / categories / posts / comments / interactions / products / checkins / announcements / guides / notifications / feedbacks / search / upload
- 统一规范：`/api` 前缀、JWT Bearer 鉴权、统一 `{code, message}` 错误体、分页 `{list, total, hasMore}`、全量软删
- 互动计数由服务层**同一事务**维护（评论增删、点赞 / 收藏），数据库约束兜底
- 签到防重：服务端事务 + 数据库唯一约束双保险
- OpenAPI 文档：启动后 `/api-docs` 可视化 + `/api-docs-json` 供前端类型生成

**工程化亮点（对标优秀开源项目）**
- 前端类型单一来源：`openapi-typescript` 从后端 swagger 生成 `src/types/api.d.ts`，请求体类型自动同步
- 会话体系：access token 仅存内存（防 XSS 窃取）、refresh 持久化、401 单飞续期 + 原请求重放
- Mock 双轨：`VITE_USE_MOCK` 一键切换演示数据与真实后端，同一套 `lib/http.ts` 出口
- 图片客户端压缩（最大边 1600px / JPEG 0.85）+ XHR 上传进度
- 轻量埋点骨架（`lib/telemetry.ts`）+ 全局错误监控 + 页面浏览事件
- 路由 history 模式（无 `#`）+ 页面过渡动画 + 骨架屏 + 暗黑模式适配
- 服务层核心单测（签到防重 / 连续 / 断签 / 积分规则）

---

## 三、快速开始

### 方式 A：不开后端也能看效果（mock 演示模式）★ 先看这个

学生端内置 **mock 数据模式**：不需要任何后端 / 密钥，打开即看到完整社区效果，发布 / 评论 / 签到 / 收藏都能真实操作（数据存浏览器 localStorage）。

```bash
cd apps/web
npm install
VITE_USE_MOCK=true npm run dev      # 开发模式
# 或构建后预览
VITE_USE_MOCK=true npm run build && npx vite preview --port 4173
```

Mock 模式下已内置：8 分类、6 指南分类、指南文章、演示帖子、商品、评论、通知。**任意邮箱 + 任意密码即可登录演示账号**。

> mock 只是演示 / 测试用，正式跑请用方式 B。

### 方式 B：完整跑真实后端（NestJS + PostgreSQL）

```bash
# 0. 前置：本机有 Node 20+ 与 PostgreSQL 14+
cd apps/server

# 1. 建库 + 建表 + 种子数据 + 演示数据
bash scripts/setup-db.sh                 # 创建数据库与用户
node scripts/seed.mjs                    # 种子：8 分类 / 1 公告 / 6 指南分类 / 2 指南
bash scripts/make-demo.sh                # 演示：双账号 / 4 帖 / 3 商品 / 签到 / 互动

# 2. 启动服务层（:3000）
npm run build && node dist/main.js

# 3. 启动学生端（:4173，注意用 npm 12+ 安装依赖）
cd ../web
npm install
npm run dev                              # 开发模式连真实后端
```

**演示账号**：`xiaoming@campus.dev` / `xiaohong@campus.dev`，密码 `demo123456`。

**接口文档**：服务启动后打开 `http://localhost:3000/api-docs`（Swagger UI）。

> 详细部署（服务器 / 环境变量 / 前端 SPA fallback）见 **[docs/DEPLOY.md](./docs/DEPLOY.md)**。

---

## 四、技术架构

```
┌────────────────────────────┐
│  学生端 H5（apps/web）      │  Vue3 + Vant + Pinia
│  lib/http.ts 统一出口       │  mock 双轨 / 会话续期 / 缓存 / 超时
└──────────┬─────────────────┘
           │ REST /api（JWT Bearer）
┌──────────▼─────────────────┐
│  服务层（apps/server）       │  NestJS + Prisma
│  13 模块 · 统一错误体 · 软删 │  @nestjs/swagger 文档
└──────────┬─────────────────┘
           │ Prisma ORM
┌──────────▼─────────────────┐
│  PostgreSQL（19 表）        │  唯一约束兜底 · 计数冗余列
└─────────────────────────────┘
```

- 13 模块：auth · categories · posts · comments · interactions · products · checkins · announcements · guides · notifications · feedbacks · search · upload
- 41 个 REST 端点（学生端全功能）；权限：`@Auth`（登录）/ 作者 / 管理员
- 数据库 19 表：profiles（含 is_admin）、posts、products、comments、likes、collects、follows、checkins、categories、announcements、guide_categories、guides、notifications、feedbacks、refresh_sessions、admin_logs 等

完整架构与关键链路说明见 **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**。

---

## 五、目录结构

```
campushub/
├── apps/
│   ├── web/            # 学生端 H5（Vue3 + Vant）
│   ├── server/         # 服务层（NestJS + Prisma + PostgreSQL）
│   └── admin/          # 管理后台（vue-pure-admin 开源模板）
├── packages/db/        # 数据库脚本（schema.sql / seed.sql，v1 遗留参考）
├── docs/               # 文档：DEPLOY / ARCHITECTURE / QA-REPORT / ADMIN
├── site/               # 官网（单 HTML + assets，无框架依赖）
└── README.md
```

---

## 六、全流程测试报告

- **服务层**：`apps/server` 核心单测（签到防重 / 连续 / 断签 / 积分规则）`npm test` 全绿；全 API 冒烟（注册 → 登录 → 发帖 → 评论 → 点赞 → 签到 → 市集 → 搜索）实测通过
- **学生端**：真实后端 + 浏览器自动化端到端验证（首页 / 市集 / 详情 / 会话续期 / history 路由刷新）
- 报告详见 **[docs/QA-REPORT.md](./docs/QA-REPORT.md)**

---

## 七、路线图（M0–M5 状态）

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 | 接口清单 + Schema 评审 + 测试策略 | ✅ 完成（冻结 41 端点，见 docs/） |
| M1 | NestJS 服务层 + 学生端全功能对接 | ✅ 完成（13 模块 / 19 表 / 全 API 冒烟） |
| M1+ | 工程化修债（会话 / 类型生成 / mock 双轨 / 埋点 / 暗黑等 12 项） | ✅ 完成 |
| M2 | 机审 API + Sentry + 结构化日志（上线底线） | ⏳ 待做 |
| M3 | 小程序端（uni-app，复用现有服务层） | ⏳ 待做 |
| M4 | Redis 缓存 + BullMQ 异步 + 搜索升级 | ⏳ 待做 |
| M5 | 埋点数据应用 + 个性化推荐基线 | ⏳ 待做 |

> 改造方案全文（选型理由 / 成本 / 别做清单）见 **[docs/CAMPUSHUB-REFACTOR-PLAN.md](./docs/CAMPUSHUB-REFACTOR-PLAN.md)**。

---

## 八、说明与边界（如实标注）

- **管理后台**：目前仍对接 v1 Supabase 后端；迁移到新服务层（admin 模块）在路线图中（M2 前后）。
- **测试覆盖**：核心服务逻辑已有单测；全量覆盖率 ≥80%、E2E、CI 门禁为 M2 目标，当前未达。
- **文件存储**：图片暂存本地磁盘（`apps/server/uploads`，静态 `/static/` 提供），后置 OSS / CDN。
- 本仓库为学习 / 演示项目，上线前请完成 M2（机审 + 可观测性）并做安全加固。

---

## 九、许可证

MIT © 2026 CampusHub 项目组。完全开源，欢迎任何学校 / 组织使用与二次开发。
