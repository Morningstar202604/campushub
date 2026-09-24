# 管理后台（vue-pure-admin 精简版 · 已实现）

管理后台不重复造轮子：基于开源框架 **vue-pure-admin thin**（Vue3 + Vite + TS + Element Plus），已接入 campushub 的 Supabase 后端并实现全部业务页面。框架能力（登录、菜单、布局、主题、标签页）全部白拿，我们只写业务。

## 一、目录与实现情况

```
apps/admin/
├── src/api/supabase.ts        # Supabase 客户端（配置占位，见下）
├── src/api/user.ts            # 登录：Supabase 邮箱密码 + is_admin 校验（替换原 mock）
├── src/api/biz.ts             # 各业务表统一数据操作
├── src/api/routes.ts          # 动态路由已改空（业务路由静态注册，不再依赖 mock）
├── src/router/modules/business.ts  # 9 个业务菜单（静态注册，登录后自动生成菜单）
└── src/views/
    ├── content-audit/         # 内容审核：帖子 / 商品 / 评论（软删 + 置顶 + 精华 + 下架）
    ├── reports/               # 举报处理：通过 / 驳回，填写处理备注
    ├── users/                 # 用户管理：搜索、封禁/解封、设/取消管理员
    ├── categories/            # 分类管理：CRUD + 排序 + 启停
    ├── announcements/         # 公告管理：CRUD + 启停
    ├── guides/                # 指南管理：指南分类 + 指南 CRUD（标签、封面、正文）
    ├── feedbacks/             # 反馈管理：标记已处理 / 重开
    ├── notifications/         # 通知下发：全站 / 指定用户
    └── admin-logs/            # 操作审计：管理员关键操作自动留痕
```

## 二、运行

```bash
cd apps/admin
# 1. 配置 Supabase（占位：开通后填入真实值，与学生端同一项目）
#    .env.development（开发）/ .env.production（生产）中的
#    VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY

pnpm install      # 或 npm install（如无 pnpm）
pnpm dev          # 开发 http://localhost:8848
pnpm build        # 构建产出 dist/（纯静态，与业务路由 hash 模式一起托管即可）
```

## 三、登录说明

- 账号 = 学生端注册的邮箱账号，且 `profiles.is_admin = true`（Supabase 控制台 Table Editor 手动置 true，或本后台用户管理页给他人授权）。
- 非管理员账号登录会被拒绝并登出。
- 登录态由 Supabase Session 提供，后台页面刷新自动续期（无感刷新）。

## 四、权限模型

- 菜单级：登录接口校验 `is_admin`，非管理员无法进入；
- 数据级：数据库 RLS 兜底（`public.is_admin()` 判定），前端只是体验层，**无法绕过**。

## 五、已知边界（待你开通环境后实测）

- 通知"全站发送"当前实现为给每个用户写一条通知（用户量大时可改通知表全局模式）；
- 指南正文当前为 Markdown/HTML 文本框，正式版可换 vditor 编辑器 + XSS 净化；
- 内容安全：举报闭环已就绪；如需机器审核，再接网易易盾/腾讯云天御（Edge Function 包一层即可）。
