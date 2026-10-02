# 管理后台（vue-pure-admin 精简版 · 已迁移自建服务层）

管理后台不重复造轮子：基于开源框架 **vue-pure-admin thin**（Vue3 + Vite + TS + Element Plus），业务全部对接 campushub **自建 NestJS 服务层**（`/api/admin/*`，28 端点），**已完全脱离 v1 Supabase**。框架能力（登录、菜单、布局、主题、标签页）全部白拿，我们只写业务。

## 一、目录与实现情况

```
apps/admin/
├── src/api/client.ts          # 请求封装：API_BASE + 统一错误提取（基于 utils/http）
├── src/api/user.ts            # 登录：POST /auth/login（is_admin 校验）+ /auth/refresh 续期
├── src/api/biz.ts             # 28 组管理接口（list/write 均走 /api/admin/*，snake_case 兼容）
├── src/router/modules/business.ts  # 9 个业务菜单（静态注册，登录后自动生成菜单）
├── src/utils/upload.ts        # 图片上传：自家 /api/upload/images（multipart + Bearer）
├── src/utils/http/index.ts    # 拦截器：access token 注入、401 刷新重放、错误统一处理
└── src/views/
    ├── content-audit/         # 内容审核：帖子 / 商品 / 评论（软删 + 置顶 + 精华 + 下架）
    ├── reports/               # 举报处理：通过(handled) / 驳回(dismissed)，填写处理备注
    ├── users/                 # 用户管理：搜索、封禁/解封、设/取消管理员
    ├── categories/            # 分类管理：CRUD + 排序 + 启停
    ├── announcements/         # 公告管理：CRUD + 启停
    ├── guides/                # 指南管理：指南分类 + 指南 CRUD（标签、封面、正文）
    ├── feedbacks/             # 反馈管理：标记已处理 / 重开
    ├── notifications/         # 通知下发：全站 / 指定用户
    └── admin-logs/            # 操作审计：管理员关键操作自动留痕（服务端落库）
```

## 二、运行

```bash
cd apps/admin
# 1. 环境变量（复制 .env.example 为 .env）：
#    VITE_PORT=8848          本地开发端口
#    VITE_ROUTER_HISTORY="hash"
#    VITE_API_BASE="/api"    开发由 Vite 代理到 :3000，生产由 nginx 反代；可覆盖为完整地址

pnpm install      # 或 npm install（如无 pnpm）
pnpm dev          # 开发 http://localhost:8848（/api、/static 代理到后端 :3000）
pnpm build        # 构建产出 dist/（纯静态，hash 路由）
pnpm preview      # 生产构建预览 http://localhost:8849（同样带代理）
```

> 注意：缺失 `.env` 会导致 `VITE_ROUTER_HISTORY` 未定义，应用启动即崩（登录页卡 loader）。`.env` 已加入 `.gitignore`，不入库。

## 三、登录说明

- 账号 = 学生端注册的邮箱账号，且 `profiles.is_admin = true`（后台「用户管理」页可给他人授权）。
- 非管理员账号登录会被拒绝（后端 AdminGuard 401/403 兜底）。
- 登录态：`POST /auth/login` 返回 accessToken（15 分钟）+ refreshToken；`/auth/refresh` 轮换续期，401 自动重放一次。

## 四、权限模型

- 菜单级：登录接口校验 `is_admin`，非管理员无法进入；
- 数据级：后端 `AdminGuard` 真实现——未登录 401、非管理员 403、封禁用户拒绝；写操作全部经服务层校验并落 `admin_logs` 审计，前端只是体验层，**无法绕过**。

## 五、服务层 admin 模块（apps/server/src/modules/admin）

| 能力 | 说明 |
|---|---|
| 控制器 | `admin.controller.ts`，28 端点：auth 代理、posts/products/comments 审核、reports 闭环、users 管理、categories/announcements/guides CRUD、feedbacks、notifications、admin-logs |
| 守卫 | `common/guards/admin.guard.ts`：真 JWT 校验 + is_admin + 封禁检查 |
| 审计 | 所有写操作 `this.log()` 落 `admin_logs`（操作人/动作/对象/时间） |
| 序列化 | `common/utils/snake.ts`：响应 snake_case 兼容 v1 前端字段（is_pinned/is_essence/is_banned…），Decimal/Date 原样保留 |

## 六、已知边界（如实标注）

- 通知"全站发送"当前实现为给每个用户写一条通知（用户量大时可改通知表全局模式）；
- 指南正文当前为 Markdown/HTML 文本框，正式版可换 vditor 编辑器 + XSS 净化；
- 内容安全：举报闭环已就绪；机器审核为可选扩展，接网易易盾/腾讯云天御时在服务层包一层即可。
