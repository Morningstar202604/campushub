# 部署指南

> 总目标：**不开服务器、不备案后端、零运维**。后端用国内云托管的 Supabase，前端是纯静态文件。

## 一、开通 Supabase（任选一家，流程相同）

| 厂商 | 入口 | 特点 |
|---|---|---|
| 阿里云 | 云数据库 RDS → RDS Supabase | 按量计费，中文文档 |
| 火山引擎 | AI 原生数据库 → Supabase 版 | 100% 兼容 Supabase 开源用法 |
| 腾讯云 | 云开发 CloudBase for Supabase | 对齐 Supabase 心智，人民币计费 |
| 自托管（不推荐） | docker-compose | 需要服务器，运维成本高 |

开通后记下两个值（项目 Settings → API）：
- `Project URL`（形如 `https://xxxx.supabase.co`）
- `anon public key`

## 二、初始化数据库

1. 打开 Supabase 控制台 → SQL Editor
2. 依次执行（顺序不可反）：
   - `packages/db/schema.sql`（建表 + 触发器 + RLS + 全文检索索引）
   - `packages/db/seed.sql`（示例分类 / 指南 / 公告）
3. 创建存储桶（可登录后由前端首次上传时自动创建，也可手动建）：
   - Storage → New bucket → 名称 `images`，勾选 Public

## 三、配置学生端

```bash
cd apps/web
cp .env.example .env
# 编辑 .env，填入 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY

npm install
npm run dev        # 本地开发 http://localhost:5173
npm run build      # 产出 dist/，静态文件
```

## 四、部署前端（静态托管）

`npm run build` 后把 `apps/web/dist/` 上传到：

- **腾讯云 COS / 阿里云 OSS + CDN**（推荐，国内快，需域名备案）
- 或任意静态托管（GitHub Pages / Nginx / 宝塔）

因为使用了 Hash 路由，静态托管**不需要任何 rewrite 配置**。

## 五、管理员账号

1. 先用学生端注册一个邮箱账号
2. 在 Supabase 控制台 → Table Editor → `profiles` 表，把该用户的 `is_admin` 改为 `true`
3. 部署管理后台（见 `docs/ADMIN.md`），用同一账号登录

## 六、上线前检查清单

- [ ] schema.sql / seed.sql 已执行，`posts`/`products`/`comments` 等表有数据读写正常
- [ ] 存储桶 `images` 已创建且 Public
- [ ] 邮箱确认策略：Auth → Providers → Email → 开发期可关闭 "Confirm email"，正式开放建议开启
- [ ] 内容安全：接入第三方审核 API（网易易盾/腾讯云天御）前，起步靠"举报 + 人工审核"闭环（reports 表已支持）
- [ ] 域名 + HTTPS（登录和存储需要安全上下文）

## 成本估算

| 项 | 费用 |
|---|---|
| 阿里云 RDS Supabase（按量） | 约 5 元起 / 活跃月（校园量级通常个位数到几十元） |
| 前端静态托管（COS/OSS） | 流量费极低，约 0.2~2 元/月 |
| 域名 | 约 30~60 元/年 |
| **合计** | **百元以内/年**（远低于原方案 19.9 元/月 × 12 ≈ 240 元 + 云函数复杂度） |
