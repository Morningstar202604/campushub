# CampusHub 全流程测试报告（QA · v2 真实后端）

> 环境：自建 NestJS 服务层 + PostgreSQL（:3000）+ 学生端真实对接（:4173）· 浏览器自动化 + API 冒烟
> 结论：**学生端全功能跑在自家后端，服务层 13 模块全 API 冒烟通过，核心单测全绿**。
> 历史：v1 时代（mock 模式 + Supabase）的 QA 报告见 git 历史，本文已更新为 v2 现状。

---

## 一、服务层验证（apps/server）

### 1.1 单测（`npm test` → vitest run，全绿）

| 用例 | 验证点 |
|---|---|
| 今天已签到 → 抛 BadRequest | 签到防重 |
| 昨天签过 → streak 连续 +1、积分 = 1 + floor(streak/7)*5 | 连续规则 |
| 昨天没签 → 断签重置 streak=1 | 断签规则 |
| 第 7 天 → 额外 +5 积分（1+5=6） | 周期奖励 |
| 用户不存在 → NotFound | 边界 |
| AppController health | 健康检查 |

### 1.2 API 冒烟（curl 全链路，已实测通过）

注册 → 登录（返回双 token）→ 分类 → 发帖（post/lost/task 含 expireAt）→ 帖子详情（view+1）→ 评论（计数同事务 +1）→ 点赞 / 收藏 / 关注（唯一约束幂等）→ 签到（防重）→ 商品上架（价格两位小数）→ 商品状态流转 → 搜索 → 公告 → 指南 → 通知 → 反馈 → 上传（multipart）→ 登出。

### 1.3 关键回归（修复后验证）

| 问题 | 根因 | 修复 | 验证 |
|---|---|---|---|
| 评论计数不增 | 原依赖 Supabase 触发器，自建层缺失 | comments.service `$transaction` 增删计数 + SQL 回刷存量 | 冒烟通过 |
| 注册后不登录 | 原注册只建账号不发 token | 注册即登录，返回 access/refresh | 冒烟通过 |
| createProduct 全挂 | DTO price 缺校验器被 whitelist 剥离成 NaN + create 缺 seller/category connect | DTO 补 `@IsNumber @Min(0.01)`；service 改关系 connect | 3 商品正常（¥699/¥25/¥89） |
| swagger 文档与实现分歧 | images 注解 String 应为数组、expireAt/originalPrice 缺 nullable | 修注解 + 重新生成前端类型 | 前端构建通过 |
| 首页白屏 | http.ts BASE 漏 `/api` 前缀 | 修复 | 浏览器验证通过 |

---

## 二、学生端端到端验证（浏览器自动化，真实点击/输入）

| # | 场景 | 结果 |
|---|---|---|
| 1 | 首页信息流（推荐/最新/热榜、8 分类、公告栏） | ✅ 4 帖（含任务帖"求代取快递"带 expireAt） |
| 2 | 市集（分类、价格/成色、点赞收藏） | ✅ 3 商品（索尼耳机 ¥699 / 瑜伽垫 ¥25 / 机械键盘 ¥89） |
| 3 | 帖子详情（互动栏、评论、举报） | ✅ 数据层验证通过 |
| 4 | 登录（xiaoming / demo123456） | ✅ 登录成功、跳转正常 |
| 5 | 会话续期（登录后 reload ×2） | ✅ refresh 续期、登录态保持 |
| 6 | history 路由（URL 无 #、刷新回退） | ✅ 正常 |
| 7 | mock 模式（VITE_USE_MOCK 独立数据源） | ✅ 登录 → reload 会话保持 |
| 8 | 图片上传（客户端压缩 + 进度条） | ✅ 接口冒烟 + 前端进度接入 |

---

## 三、工程化修债清单（12 项，全部完成）

| 项 | 内容 | 交付 |
|---|---|---|
| P0-1/2 | 会话改造：access 内存 + refresh 持久化 + 401 单飞续期重放 | `lib/http.ts` 重写 |
| P0-3 | 签到时区统一 Asia/Shanghai | `utils/format.ts` shanghaiDateStr |
| P0-4 | 点赞/收藏/关注防重节流 | `api/social.ts` pending Set |
| P1-9 | 删除 supabase 死代码与依赖 | `lib/supabase.ts` 移除 |
| P1-5 | Mock 双轨收拢到 http 层 | `mock/api.ts` mockFetch 分发器 |
| P1-11 | fetch 超时 + AbortController | http.ts 10s 默认 |
| P1-12 | 图片客户端压缩 + 上传进度 | `lib/upload.ts` 重写 |
| P1-7 | usePagination 组合式函数 | `composables/usePagination.ts` |
| P1-8 | 轻量请求缓存 | http.ts GET 30s 内存缓存 |
| P1-10 | 错误监控与埋点骨架 | `lib/telemetry.ts` + main.ts 全局 errorHandler |
| P1-6 | 后端类型生成 | swagger 注解 + openapi-typescript → `types/api.d.ts` |
| P2 | 路由 history + 骨架屏 + 动效 + 暗黑 | router / styles / App.vue |

---

## 四、已知边界（如实标注）

- **管理后台**：✅ 已迁移到自建服务层（28 端点 + 真 AdminGuard + 审计），前端走 `/api/admin/*`；浏览器全 12 个管理页验证数据正常，写操作（置顶/封禁/解封/举报闭环）闭环通过。
- **全量覆盖率**：当前核心逻辑有单测（6 用例全绿），全量覆盖率 ≥80%、E2E、CI 门禁为 M2 目标。
- **机审 / Sentry / 结构化日志**：未接，属 M2（上线底线）范围。
- **图片存储**：本地磁盘，未切 OSS。

---

## 五、如何复现本报告

```bash
cd apps/server
bash scripts/setup-db.sh && node scripts/seed.mjs && bash scripts/make-demo.sh
npm run build && node dist/main.js
npx vitest run          # 单测
# 浏览器打开 http://localhost:4173 走一遍上面的用例
```
