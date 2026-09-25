# CampusHub v2 — 校园内容社区（H5 Web）

> 上一版（uni-app + 微信云开发三端）已废弃。v2 改为**纯 Web（移动端 H5）+ Supabase 开源后端 + 开源管理后台**，不依赖微信生态，通用模板，任何学校/组织可一键部署。

> 🎓 **官网**：站点源码在 `site/` 目录（单 HTML + assets，无框架依赖），部署到任意静态托管即可访问。

---

## 一、这是什么

面向在校学生的内容社区，一个 H5 应用搞定：**二手闲置、失物招领、表白墙、课程学习、校园活动、兼职实习、拼车拼团、闲聊树洞** 八类内容，加上**市集、校园指南、签到积分、消息通知、举报闭环**。

两个端，同一套 Supabase 后端：

| 端 | 给谁用 | 入口 |
|---|---|---|
| **学生端 H5** | 学生 | `apps/web`（Vue3 + Vant，手机浏览器/微信内打开） |
| **管理后台** | 管理员 | `apps/admin`（vue-pure-admin 开源后台，内容审核/用户/分类/公告等 9 个模块） |

---

## 二、功能清单（已实现）

**学生端**
- 首页信息流：推荐 / 最新 / 热榜三种排序，八分类横滑筛选，公告栏，置顶/精华帖标识
- 市集：二手商品网格、价格/成色/交易方式展示、防诈骗提示、点赞收藏评论
- 发布：四场景表单（发帖子 / 卖闲置 / 失物招领 / 匿名表白墙），最多 9 图上传
- 帖子详情：图片预览、点赞、收藏、评论、回复、举报；失物/招领可标记已解决，任务帖可置过期
- 搜索：帖子 + 商品统一搜索（Postgres pg_trgm 模糊匹配）
- 校园指南：分类导航 + Markdown 富文本（前端 marked + DOMPurify 渲染）
- 签到打卡：每日签到 +1 积分，连续 7 天额外 +5，断签重计
- 消息中心：点赞/评论/系统通知，未读红点，一键全部已读
- 个人中心：资料展示/编辑、我的帖子/商品/收藏、退出登录
- 登录注册：Supabase 邮箱密码（手机号可在控制台开短信后扩展），登录守卫带 redirect 回跳

**管理后台**（vue-pure-admin）
- 内容审核（帖子/商品/评论，通过/下架/删除）、举报处理、用户管理（封禁/解封/角色）、分类管理、公告管理、指南管理（vditor Markdown 编辑器）、意见反馈、系统通知、审计日志

**数据库**（Supabase）
- 17 张表 + RLS 行级安全 + 触发器自动维护计数（点赞/评论/收藏数）+ pg_trgm 全文索引 + 签到/浏览量 RPC + 新用户自动建档案

---

## 三、技术栈（为什么这么选）

| 层 | 选型 | 理由 |
|---|---|---|
| 学生端 | Vue 3 + Vite + TS + Pinia + Vant 4 | 轻量快、组件开箱即用、移动端质感好 |
| 后端 | Supabase（Postgres + Auth + Storage + RLS） | 开源、免运维、国内云托管便宜（阿里云 RDS Supabase 5 元起） |
| 管理后台 | vue-pure-admin（开源） | 成熟后台模板，9 个业务模块直接套 |
| 部署 | 静态托管（COS/OSS+CDN）+ Supabase 云 | 无需自建服务器 |

上一版为何废弃：微信云开发无事务/无聚合/无全文检索，约 40% 后端代码在补平台缺失；小程序/APP 三端维护成本高。v2 全部砍掉，一套 H5。

---

## 四、快速开始

### 方式 A：不开后端也能看效果（mock 演示模式）★ 推荐先看这个

学生端内置 **mock 数据模式**：不需要任何后端/密钥，打开即看到完整社区效果，发布/评论/签到/收藏都能真实操作（数据存浏览器 localStorage）。

```bash
cd apps/web
npm install
npm run dev            # 开发模式
# 或构建后预览
VITE_USE_MOCK=true npm run build && npx vite preview --port 5199
```

浏览器打开后，如果页面是空的，在控制台执行一次 `localStorage.setItem('campus_mock','1'); location.reload()` 即可开启 mock（或直接用 `VITE_USE_MOCK=true` 构建，开箱即用）。

Mock 模式下已内置：8 分类、6 指南分类、3 篇 Markdown 指南、4 个演示用户、13 篇帖子、7 件商品、评论、通知。**任意邮箱 + 任意密码即可登录演示账号**。

> mock 只是演示/测试用，正式上线请用方式 B，并确认构建时**不带** `VITE_USE_MOCK=true`。

### 方式 B：正式接入 Supabase

```bash
# 1. 开通 Supabase（国内云任选），新建项目
# 2. 把 packages/db/schema.sql、seed.sql 依次在 SQL Editor 执行（建表/权限/种子数据）
# 3. 配置学生端
cd apps/web
cp .env.example .env        # 填入 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm install && npm run dev
# 4. 配置管理后台
cd ../admin
cp .env.development .env.development.local   # 填入同一个 Supabase 的 URL / anon key
npm install && npm run dev
```

详细部署步骤（建库、SQL、桶、成本估算）见 **[docs/DEPLOY.md](./docs/DEPLOY.md)**；
管理后台说明见 **[docs/ADMIN.md](./docs/ADMIN.md)**。

---

## 五、全流程测试报告（已实测通过）

在无后端环境下用 mock 模式 + 浏览器自动化，按真人使用顺序完整跑通，详见 **[docs/QA-REPORT.md](./docs/QA-REPORT.md)**。核心结论：

- ✅ 浏览信息流（推荐/最新/热榜排序、分类筛选、置顶）
- ✅ 登录注册（mock 登录、登录守卫带回跳、登录态持久）
- ✅ 发帖/发商品/失物招领/表白墙四场景（含模拟传图）→ 发布后列表可见
- ✅ 点赞/收藏/评论/回复（计数实时更新、我的收藏同步）
- ✅ 搜索（帖子+商品）、签到积分、校园指南 Markdown、消息已读、编辑资料、意见反馈
- ✅ mock 数据 localStorage 持久化：刷新页面不丢

测试中发现并修复的问题（均已修复）：白屏（Supabase 未配置时）、列表首屏不加载、切 tab 不刷新、收藏计数 NaN、评论作者显示错误、分类 emoji 缺失、失物/表白墙无法提交、市集分类栏显示全部分类、消息缺少"全部已读"入口、意见反馈用系统 prompt（改 Vant 弹层）、mock 状态刷新丢失、登录态不持久。

---

## 六、目录结构

```
campushub-v2/
├── packages/db/        # ★ 数据库唯一事实源：schema.sql（17 表+RLS+触发器+索引+RPC）+ seed.sql
├── apps/web/           # ★ 学生端 H5
│   └── src/
│       ├── pages/      #   17 个页面（首页/市集/发布/消息/我的/详情/指南/签到/搜索…）
│       ├── api/        #   数据层（posts/products/social/misc/my），统一 mock 开关
│       ├── mock/       #   mock 数据 + API（无后端演示用）
│       ├── stores/     #   auth（登录态）/ app（分类/公告）
│       └── lib/        #   supabase（占位降级）/ upload / mock 开关
├── apps/admin/         # ★ 管理后台（vue-pure-admin 精简改造，9 个业务模块）
├── docs/               # DEPLOY.md 部署 / ADMIN.md 后台 / QA-REPORT.md 测试报告
└── screenshots/        # 见下方
```

---

## 七、界面截图与宣传视频

**宣传视频**：`docs/campushub-promo.mp4`（约 50 秒，真实操作录屏：首页 → 互动 → 市集 → 发布 → 搜索 → 指南 → 签到 → 个人中心）

浏览器实机截图（mock 模式，见 `docs/screenshots/`）：

| 页面 | 文件 |
|---|---|
| 首页信息流 | `docs/screenshots/01-首页.png` |
| 市集 | `docs/screenshots/02-市集.png` |
| 发布四场景 | `docs/screenshots/03-发布.png` |
| 登录页（守卫跳转） | `docs/screenshots/04-登录页.png` |
| 我的（未登录） | `docs/screenshots/05-我的.png` |

---

## 八、已知边界（部署前注意）

1. **内容安全**：当前为"举报 + 管理后台人工审核"闭环；网易易盾/腾讯云天御机审留了接入位（发布接口处），接 API key 后启用。
2. **Supabase SQL**：schema.sql / seed.sql 已静态核查，尚未在任何真实 Supabase 实例执行过——部署第一步请先跑 SQL 并冒烟。
3. **私聊/IM**：本版没有站内聊天，消息中心是系统通知；如需 IM 可后续接开源方案（如 IMKit）。
4. **mock 模式**：仅演示/测试，数据在浏览器本地；生产构建不要带 `VITE_USE_MOCK=true`。
5. **手机号登录**：Supabase 控制台开通短信后即可支持，前端登录页已留结构。
6. **管理后台登录**：用与学生端同一个 Supabase 项目，首次需要给管理员账号在 `profiles` 表把 `is_admin` 置 true（见 ADMIN.md）。

---

## 九、开发约定

- 数据层统一走 `apps/web/src/api/*`，新功能不要直接 `supabase.from(...)`（my-list 早期直连已整改）。
- 分类/公告等全局数据走 `stores/app.ts`。
- 指南正文统一 Markdown 存储，前端 marked + DOMPurify 渲染，后台 vditor 编辑。
- 所有删除为软删除（`status='deleted'`），计数由数据库触发器维护。
