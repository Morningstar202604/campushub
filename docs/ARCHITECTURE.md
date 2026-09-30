# CampusHub 技术架构

> v2 现状：Vue3 学生端 → NestJS 服务层（13 模块）→ PostgreSQL（19 表）。本文回答"系统是怎么长起来的、关键链路怎么走、设计决策为什么这样"。

---

## 一、总体分层

```
┌─────────────────────────────────────────────────────┐
│  学生端 H5（apps/web）· Vue3 + Vite + TS + Pinia + Vant4 │
│  lib/http.ts（统一请求出口）                           │
│   · access token 仅内存 / refresh 持久化 / 401 单飞续期 │
│   · 10s 超时 / GET 30s 缓存 / mock 双轨开关             │
└──────────────────────┬──────────────────────────────┘
                       │ REST · /api 前缀 · JWT Bearer
┌──────────────────────▼──────────────────────────────┐
│  服务层（apps/server）· NestJS + Prisma              │
│  13 业务模块 · 全局 ValidationPipe(whitelist)         │
│  统一异常过滤器 {code,message} · 软删约定             │
│  Swagger（/api-docs · /api-docs-json）               │
└──────────────────────┬──────────────────────────────┘
                       │ Prisma ORM · 交互式事务
┌──────────────────────▼──────────────────────────────┐
│  PostgreSQL · 19 表                                  │
│  唯一约束兜底（签到防重）· 计数冗余列（读路径直取）    │
└─────────────────────────────────────────────────────┘
```

三层职责边界：**页面只管呈现与交互；controller 只做参数校验与路由；service 持有全部业务规则；数据库约束兜底**（不是主防线）。

---

## 二、服务层 13 模块

| 模块 | 职责 | 关键点 |
|---|---|---|
| auth | 注册 / 登录 / 刷新 / 登出 | 注册即登录（返回双 token）；refresh 持久化到 refresh_sessions |
| categories | 内容分类 | 文本主键 `cat_*`（可读、稳定） |
| posts | 信息流 / 详情 / 发帖 / 解决 / 软删 / 举报 | 四场景 kind 区分；feed 排除 deleted 与过期未解决任务帖 |
| comments | 帖子 / 商品多态评论 | 计数在**同一事务**内增删，SQL 回刷存量保一致 |
| interactions | 点赞 / 收藏 / 关注 | 资源化 REST（`/posts/:id/like`）；唯一约束幂等；计数同事务维护 |
| products | 市集 / 详情 / 上架 / 改状态 / 软删 / 举报 | 价格两位小数；seller/category 关系 connect |
| checkins | 每日签到 | 上海时区（UTC+8）口径；事务防重 + 唯一约束双保险 |
| announcements | 公告 | 仅 active |
| guides | 指南分类 / 指南 | Markdown HTML 由后台写入，前端 DOMPurify 渲染 |
| notifications | 通知 / 未读 / 一键已读 | 产生点由服务层同步埋（M4 换队列） |
| feedbacks | 意见反馈 | 简单写入 |
| search | 帖子 + 商品统一搜索 | 模糊匹配起步（M4 换 tsvector + zhparser） |
| upload | 图片上传 | 本地磁盘 + 静态 /static/ 提供（后置 OSS） |

---

## 三、三条关键链路

### 链路 1：会话续期（前端）

```
登录 → {accessToken, refreshToken}
  · accessToken  → 内存（模块级单例，页面刷新即失）
  · refreshToken → localStorage（持久）

任意请求 401 且路径非 /auth/*
  → 单飞 refresh（共享 Promise，并发只发一次）
  → 成功后重放原请求一次
  → 刷新也失败 → 清会话，跳登录

restore()（应用启动）
  → 有 token 才走 refresh → fetchProfile
```

**为什么 access 不落 localStorage**：localStorage 可被 XSS 读取，内存态把被盗窗口缩到最小；refresh 有失效与轮换机制，风险可控。

### 链路 2：发布 → 计数一致（服务层）

```
POST /posts/:id/comments
  → $transaction：
      ① 校验父评论/回复目标存在
      ② 插入评论（status=normal）
      ③ 帖子 comment_count +1（按 targetType）
  → 读路径直接取冗余列，不 COUNT()

DELETE /comments/:id（软删）
  → 同一事务：status=deleted + comment_count -1
```

**为什么冗余列而不是 COUNT**：读路径（信息流列表）不因计数做聚合，列表页零额外开销；一致性由事务保证，数据库触发器留作兜底。

### 链路 3：签到防重

```
POST /checkins
  → 上海时区算 today / yesterday
  → $transaction：
      ① checkin 唯一约束 (user_id, date) 查重
      ② 昨天签过 → streak+1；否则重置 1
      ③ 积分 = 1 + floor(streak/7)*5
      ④ 写 checkin 记录 + 更新 profile（streak / points / lastCheckinDate）
  → 并发双签：P2002 唯一约束冲突 → 同样视为已签到
```

**时区口径**：前端 `shanghaiDateStr` 与后端同一实现（UTC+8 无夏令时），跨日判断一致。

---

## 四、数据库 19 表

| 表 | 说明 | 约束要点 |
|---|---|---|
| profiles | 用户档案 | id=userId 主键；is_admin；points / checkin_streak / last_checkin_date |
| refresh_sessions | 刷新会话 | 单用户多设备；logout / 换发轮换 |
| categories | 内容分类 | 文本主键 cat_* |
| posts | 帖子 | kind 枚举；status（normal/deleted/resolved…）；expire_at（任务帖） |
| products | 商品 | status（on_sale/sold/off_shelf/deleted）；condition 枚举 |
| comments | 评论 | 多态 target_type + target_id；parent_id 回复 |
| likes / collects | 互动 | 唯一约束 (user_id, target_type, target_id) |
| follows | 关注 | 唯一约束 (follower_id, following_id) |
| checkins | 签到 | 唯一约束 (user_id, date) |
| announcements / guides / guide_categories | 内容 | status 过滤 |
| notifications | 通知 | 类型枚举；read_at 可空 |
| feedbacks | 反馈 | content + contact |
| admin_logs | 管理审计 | 写操作留痕 |

---

## 五、设计决策（对标优秀项目的取舍）

1. **单服务 + 单库**：校园量级微服务 / ES / K8s 是负资产——写在改造方案"别做清单"里。
2. **REST 资源化**：互动端点从 v1 草案的 `POST /interactions/like {targetType,targetId}` 调整为 `/posts/:id/like`、`/products/:id/collect`——路径即资源，文档可读性、前端调用、权限控制都更清晰。
3. **软删为约定**：所有删除统一 `status=deleted`，不物理删——审计可追溯，撤回成本低。
4. **文档驱动类型**：后端 swagger 注解 → openapi.json → 前端 `openapi-typescript` 生成类型。请求契约单一来源，改 DTO 前端类型自动同步，构建期抓分歧。
5. **mock 双轨**：`USE_MOCK` 在 http 层拦截，演示环境与真实环境共用一套业务代码，不污染业务层。
6. **前端会话安全**：见链路 1。这是 v1 直连 Supabase 时代不存在的问题，服务层化后必须自己扛。

---

## 六、尚待建设（如实标注）

| 项 | 现状 | 目标 |
|---|---|---|
| 全量单测覆盖率 ≥80% | 仅核心逻辑有测 | M2 |
| E2E（Playwright）+ CI 门禁 | 未做 | M2 |
| 机审 API | 未接（仅举报闭环） | M2 |
| Sentry / pino 结构化日志 | 前端埋点骨架已建 | M2 |
| admin 后台对接新服务层 | 仍对接 v1 Supabase | M2 前后 |
| Redis + BullMQ / FTS / OSS | 未做 | M4 |
| 埋点数据应用 + 推荐 | 埋点骨架已建 | M5 |
