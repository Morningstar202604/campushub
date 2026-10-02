# M0 · 接口清单 + Schema 评审 + 测试策略 + 后端骨架

> 收尾注：本文为 M0 冻结版。落地时 schema 扩展为 19 表（新增 refresh_sessions 等）；接口有部分调整（见 CAMPUSHUB-REFACTOR-PLAN.md 第 8 节对照表）。

> 目标：冻结改造范围，为 M1（NestJS 服务层落地）提供唯一依据。
> 依据：`apps/web/src/api/*`（学生端全部数据调用）+ `apps/admin/src/api/*`（后台 9 模块）+ `apps/server/prisma/schema.prisma`（19 表，唯一事实源）。

---

## 一、REST API 接口清单（v1，冻结）

约定：
- 全局前缀 `/api`；JWT Bearer 鉴权（`@Auth()` 表示需登录，`@Admin()` 表示需管理员）
- 统一响应：成功直接返回数据；失败统一 `{ "code": "ERROR_CODE", "message": "人话提示" }`
- 分页统一 `?page=1&pageSize=20`，返回 `{ list, total }`
- 所有删除均为软删（`status=deleted`），由服务层保证

### 1. 认证 Auth
| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | /auth/register | 公开 | 注册（email/password/nickname），同事务创建 profile |
| POST | /auth/login | 公开 | 登录，返回 accessToken + refreshToken + profile |
| POST | /auth/refresh | 公开 | 刷新 token |
| GET | /auth/me | @Auth | 当前用户 profile |
| POST | /auth/logout | @Auth | 注销（作废 refresh token） |

### 2. 分类 / 公告（公开读）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /categories | 内容分类（status=active 排序） |
| GET | /announcements | 公告（active，limit 5） |

### 3. 帖子 Posts
| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | /posts | 公开 | 信息流：`tab=recommend\|latest\|hot`、`categoryId`、`kind`、分页；排除 deleted 与过期未解决任务帖 |
| GET | /posts/:id | 公开 | 详情（服务端 view_count+1） |
| POST | /posts | @Auth | 发帖（四场景由 kind 区分：post/task/lost/found/confession） |
| PATCH | /posts/:id | 作者/管理员 | 标记 resolved（失物/任务解决） |
| DELETE | /posts/:id | 作者/管理员 | 软删 |
| POST | /posts/:id/report | @Auth | 举报 |

### 4. 商品 Products
| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | /products | 公开 | 市集列表（分类筛选、分页） |
| GET | /products/:id | 公开 | 详情（view_count+1） |
| POST | /products | @Auth | 上架 |
| PATCH | /products/:id | 卖家/管理员 | 改 status（sold/off_shelf） |
| DELETE | /products/:id | 卖家/管理员 | 软删 |
| POST | /products/:id/report | @Auth | 举报 |

### 5. 评论 Comments（帖子/商品多态）
| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | /posts/:id/comments | 公开 | 楼层列表（status=normal 升序） |
| POST | /posts/:id/comments | @Auth | 发评论/回复（parentId、replyToUserId） |
| GET | /products/:id/comments | 公开 | 同上 |
| POST | /products/:id/comments | @Auth | 同上 |
| DELETE | /comments/:id | 作者/管理员 | 软删 |

### 6. 互动 Interactions（多态：post/product/comment）
| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | /interactions/like | @Auth | `{targetType,targetId}` 点赞（唯一约束幂等） |
| DELETE | /interactions/like | @Auth | 取消赞（query 参数） |
| GET | /interactions/liked | @Auth | 是否已赞 |
| POST | /interactions/collect | @Auth | 收藏（post/product） |
| DELETE | /interactions/collect | @Auth | 取消收藏 |
| GET | /interactions/collected | @Auth | 是否已收藏 |
| POST | /interactions/follow | @Auth | `{followingId}` 关注 |
| DELETE | /interactions/follow | @Auth | 取关 |
| GET | /users/:id/follower-count | 公开 | 粉丝数 |

计数规则：写路径由服务层在**同一事务**维护 like/collect/comment_count（读路径直接用冗余列）；数据库触发器保留作兜底（防止并发漏更）。

### 7. 用户 Users
| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | /users/:id | 公开 | 公开 profile（隐藏邮箱等敏感字段） |
| PATCH | /users/me | @Auth | 编辑资料 |
| GET | /users/me/posts | @Auth | 我的帖子 |
| GET | /users/me/products | @Auth | 我的商品 |
| GET | /users/me/collects | @Auth | 我的收藏（帖子+商品混合） |
| POST | /users/:id/report | @Auth | 举报用户 |

### 8. 签到 Checkins
| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | /checkins | @Auth | 每日签到：服务端计算 streak/points（事务 + 唯一约束防重），返回 `{date,streak,points}` |
| GET | /checkins/me | @Auth | 我的签到记录（limit 30） |

### 9. 通知 Notifications
| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | /notifications | @Auth | 我的通知（limit 50） |
| POST | /notifications/read-all | @Auth | 一键已读 |
| GET | /notifications/unread-count | @Auth | 未读数 |

通知产生点（服务层埋）：点赞/评论/关注/系统/举报结果 → 同步写（可选扩展：高并发换 BullMQ 异步）。

### 10. 指南 Guides（公开读）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /guide-categories | 指南分类 |
| GET | /guides | `?categoryId=` 已发布指南 |
| GET | /guides/:id | 详情（view_count+1；正文 HTML 由后台 vditor 写入，前端 DOMPurify 渲染） |

### 11. 搜索 Search
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /search/posts | `?q=` Postgres 全文检索（标题/正文，ilike 起步，M4 换 tsvector+zhparser） |
| GET | /search/products | `?q=` 同上（title/description） |

### 12. 反馈 Feedbacks
| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | /feedbacks | @Auth | `{content,contact}` |

### 13. 上传 Upload
| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | /upload/images | @Auth | multipart 多文件 → 返回 `{urls: string[]}`（M1 本地磁盘存储，后置 OSS） |

### 14. 管理后台 Admin（全部 @Admin，is_admin 校验）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /admin/posts | 帖子审核列表（分页） |
| PATCH | /admin/posts/:id/status | 下架/恢复（status） |
| PATCH | /admin/posts/:id/pin | 置顶 `{isPinned}` |
| PATCH | /admin/posts/:id/essence | 精华 `{isEssence}` |
| GET | /admin/products | 商品审核列表 |
| PATCH | /admin/products/:id/status | 下架/恢复 |
| GET | /admin/comments | 评论审核列表 |
| PATCH | /admin/comments/:id/status | 删除/恢复 |
| GET | /admin/reports | 举报列表 |
| PATCH | /admin/reports/:id | `{status: approved\|rejected, note}` → 写 admin_logs |
| GET | /admin/users | `?keyword=` 搜索 |
| PATCH | /admin/users/:id/ban | `{isBanned}` 封禁/解封 |
| PATCH | /admin/users/:id/admin | `{isAdmin}` 设/取消管理员 |
| GET/POST/PUT/DELETE | /admin/categories | 分类 CRUD |
| GET/POST/PUT/DELETE | /admin/announcements | 公告 CRUD |
| GET/POST/PUT/DELETE | /admin/guide-categories | 指南分类 CRUD |
| GET/POST/PUT/DELETE | /admin/guides | 指南 CRUD（正文 vditor HTML） |
| GET | /admin/feedbacks | 反馈列表 |
| PATCH | /admin/feedbacks/:id | `{done}` 标记已处理 |
| GET | /admin/notifications | 通知列表 |
| POST | /admin/notifications | 下发（全站/指定用户） |
| GET | /admin/logs | 操作审计（所有写操作自动记 admin_logs） |

---

## 二、Schema 评审（schema.sql → 自建 Postgres）

**保留（直接复用，结构与索引不动）**：
- 全部 17 张表字段、外键、唯一约束、索引
- likes/collects/comments 计数触发器（不依赖 auth，自建后端同样生效，作兜底）
- checkins 唯一约束 `(user_id, date)`（防重复签到的最后防线）

**必须调整（自建后不再成立的 Supabase 依赖）**：
| 项 | 现状 | 改造 |
|---|---|---|
| profiles.id | FK → auth.users(id)（Supabase Auth 专属） | 去掉该 FK，id 直接作为主键；注册时服务层建用户+profile |
| handle_new_user 触发器 | 依赖 auth.users 插入事件 | 删除；改在服务层注册事务内创建 profile |
| RLS 全部策略 | 依赖 auth.uid()，自建后端不存在 | 删除；权限逻辑迁移到 AuthGuard / AdminGuard / Service 校验（数据库约束保留） |
| checkin() / incr_view() RPC | 数据库函数 | 迁到服务层实现（事务 + 唯一约束防重） |
| is_admin 判定 | RLS 内 `is_admin()` | 保留字段，AdminGuard 读 profile 判断 |

**新增（建议，M0 只冻结结构）**：
- `refresh_sessions`（refreshToken 存储，或 M1 先用 Redis）
- `events`（埋点事件表，P2 用，M0 预留不建也行）

**存储**：images 字段（text[]）不变；M1 图片存本地磁盘卷，M4 后置 OSS/CDN。

---

## 三、测试策略（M1 执行）

| 层 | 工具 | 覆盖点 | 门槛 |
|---|---|---|---|
| 单元 | Vitest | 服务层核心逻辑：签到防重、计数一致性、权限判定、软删规则 | 核心服务覆盖率 ≥ 80% |
| 集成 | Supertest + 测试库（独立 Postgres schema + 内存 Redis） | 全部 API 冒烟：注册→登录→发帖→评论→点赞→签到→审核闭环 | 全绿 |
| E2E | Playwright | 5 条关键链路：登录→发帖、发帖→评论、市集→购买态、签到、后台审核 | 全绿 |
| CI 门禁 | GitHub Actions | server job：lint → test(cov≥80%) → build；门禁：测试不过不能合 main | 与 web/admin 并行 |

测试库策略：CI 里起 Postgres 容器（pgservice/postgres）跑 schema.sql（去掉 RLS/auth 依赖部分），每次跑前重置。

---

## 四、后端骨架（已落地 apps/server）

```
apps/server/
├── src/
│   ├── main.ts                 # 启动：全局前缀 /api、ValidationPipe、helmet、CORS、/api/health
│   ├── app.module.ts           # 根模块（模块注册中心）
│   ├── common/
│   │   ├── guards/auth.guard.ts        # JWT 解析 → req.user（M1 接 @nestjs/jwt）
│   │   ├── guards/admin.guard.ts       # profile.is_admin 校验
│   │   ├── decorators/current-user.decorator.ts
│   │   ├── filters/http-exception.filter.ts  # 统一 {code,message}
│   │   └── dto/pagination.dto.ts
│   ├── config/                 # env 校验与配置（M1 接 @nestjs/config）
│   ├── prisma/                 # prisma.service.ts + schema.prisma（M1 从 schema.sql 翻译）
│   └── modules/                # 每个业务模块 = controller + service + dto + module
│       ├── auth/  users/  posts/  products/  comments/
│       ├── interactions/  categories/  announcements/  guides/
│       ├── checkins/  notifications/  reports/  feedbacks/
│       ├── search/  upload/  admin/
├── test/                       # e2e（supertest）
├── .env.example                # JWT_SECRET / DATABASE_URL / UPLOAD_DIR / PORT
├── Dockerfile                  # node:22-alpine → dist/main
└── package.json                # NestJS 12 + Vitest + oxlint
```

模块约定：**controller 只做参数校验与路由，业务全部在 service；事务用 Prisma 交互式事务；写操作统一记 admin_logs（仅管理端）**。

---

## 五、M0 验收

- [ ] 接口清单冻结（本文档 v1）
- [ ] apps/server 骨架可 `npm run build` 通过
- [ ] 目录结构与模块划分评审通过
- [ ] CI server job 模板就绪（M1 填充测试）
