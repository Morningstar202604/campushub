# Changelog

All notable changes to **CampusHub** are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/).

## [1.2.0] — 2026-10-02

### Added

- **pino 结构化日志**（Structured logging）
  - 应用日志 + HTTP 访问日志统一 JSON 输出（`nestjs-pino` + `pino-http`）
  - `LOG_LEVEL` 环境变量控制级别；本地 pino-pretty 美化，生产（`NODE_ENV=production`）纯 JSON
  - `/api/health` 与 `/static/*` 自动忽略，避免刷屏
- **路线图收敛（M2–M5 评审）**
  - 判定为可选扩展（非承诺）：机审 API（举报 + 人工审核闭环已内置）、Sentry、Redis/BullMQ、FTS 搜索、小程序端（H5 已覆盖手机浏览器 / 微信内打开）、推荐引擎
  - 全量文档同步：README / ARCHITECTURE / REFACTOR-PLAN / QA-REPORT / DEPLOY / SECURITY / ADMIN / M0-API-SPEC，无未完成承诺项残留
- Docker Compose / `.env.example` 修正：`JWT_SECRET`（与代码一致）+ `LOG_LEVEL`

### Changed

- 服务端 `.env.example` 数据源说明改为 prisma schema（唯一事实源），移除 packages/db 遗留引用
## [1.1.0] — 2026-10-01

### Added

- **管理后台迁移到自建服务层**（Admin console migrated to self-built service layer）
  - 后端新增 `admin` 模块：28 个端点（帖子 / 商品 / 评论审核、举报闭环、用户管理、分类 / 公告 / 指南 CRUD、反馈、通知、审计日志）
  - 真实 `AdminGuard`：未登录 401、非管理员 403、封禁拒绝
  - 全部写操作自动落 `admin_logs` 审计表
  - 前端 `apps/admin` 删除 Supabase 直连，全部走 `/api/admin/*`；登录改为 `/auth/login` + `/auth/refresh` 双 token 续期
- 开源项目文档：双语 README（中英）、LICENSE（MIT）、CONTRIBUTING、CODE_OF_CONDUCT、SECURITY、CHANGELOG

### Fixed

- 商品价格显示 ￥NaN：`toSnakeKeys` 拍平 Prisma Decimal 内部字段 → 非普通对象原样保留（now shows ¥699.00 correctly）
- admin 登录页卡 loader：缺失 `.env` 导致 `VITE_ROUTER_HISTORY` 未定义 → 补充 `.env`（已 gitignore）

### Changed

- 全部交付文档更新为 v2 状态（README / ARCHITECTURE / REFACTOR-PLAN / QA-REPORT / ADMIN），无 v1 Supabase 残留矛盾

## [1.0.0] — 2026-09-30

### Added

- **自建 NestJS 服务层**（M1 主体，13 业务模块 / 19 张表 / 41+ 端点）：
  - auth（邮箱密码 + JWT 双 token：内存 access + 持久化 refresh，401 单飞续期 + 重放）
  - categories / posts / comments / interactions（点赞 / 收藏 / 关注）/ products / checkins（签到防重）/ announcements / guides / notifications / feedbacks / search / upload
  - 统一规范：`/api` 前缀、统一 `{code, message}` 错误体、分页 `{list, total, hasMore}`、全量软删、互动计数同事务维护
  - OpenAPI 文档（`/api-docs` Swagger UI + JSON）
- **学生端对接服务层 + 工程化修债 12 项**（M1+）：
  - 前端类型单一来源（openapi-typescript 从 swagger 生成）
  - 会话双 token 续期、mock 双轨收拢（`VITE_USE_MOCK`）、图片客户端压缩 + 上传进度、请求缓存 / 超时、usePagination、路由 history、骨架屏 / 暗黑 / 动效、埋点与错误监控骨架
- 官网 `site/`（单 HTML + assets，无框架依赖）

### Fixed

- 评论计数不增（原依赖 Supabase 触发器）：自建层 `$transaction` 增删计数 + SQL 回刷存量
- 签到重复提交：服务端事务 + 数据库唯一约束双保险

## [0.2.0] — 2026-07

### Added

- v1（Supabase 开源后端 + vue-pure-admin 后台）全功能实现：学生端 H5 八分类内容流、市集、指南、签到、消息；后台内容审核 / 用户 / 分类 / 公告 / 指南 / 反馈 / 通知

## [0.1.0] — 2026-05

### Added

- v0（uni-app + 微信云开发三端）初版：发帖 / 二手交易 / 失物招领 / 表白墙 / 校园认证

---

[Unreleased]: https://github.com/X33834/campushub/compare/1.1.0...HEAD
[1.1.0]: https://github.com/X33834/campushub/releases/tag/1.1.0
[1.0.0]: https://github.com/X33834/campushub/releases/tag/1.0.0
