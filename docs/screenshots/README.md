# CampusHub 展示物料 / Showcase Assets

> 本目录只收录**当前版本**（「墨荧 · Acid Campus」设计）的真实运行截图，用于开源仓库对外展示。
> All visual assets here are real screenshots of the **current** build — v0.8.1 white/blue assets
> were removed in v0.10.0 to stop stale visuals from misrepresenting the product.

## 目录结构 / Layout

| 文件 | 说明 | Description |
|------|------|-------------|
| `v1/` | 27 张逐页截图（390×844 视口 2x，H5 构建产物实机渲染） | 27 per-screen shots (390×844 @2x, rendered from the H5 build) |
| `overview-v1.png` | 27 页总览长图 | 27-screen overview wall |

## 页面清单 / Pages

**主流程 Core flow**
`v1/index.png` 首页 ｜ `v1/search.png` 搜索 ｜ `v1/post-detail.png` 帖子详情 ｜ `v1/post-create.png` 发布

**交易 Market**
`v1/market.png` 二手市集 ｜ `v1/product-detail.png` 商品详情 ｜ `v1/product-create.png` 发布好物 ｜ `v1/my-list.png` 我的内容

**校园特色 Campus**
`v1/wall.png` 表白墙 ｜ `v1/lost-found.png` 失物招领 ｜ `v1/guide-list.png` 校园指南 ｜ `v1/guide-detail.png` 指南详情

**个人中心 Profile**
`v1/user-profile.png` 个人主页 ｜ `v1/user-update.png` 编辑资料 ｜ `v1/notification.png` 通知 ｜ `v1/follow.png` 关注 ｜ `v1/checkin.png` 签到 ｜ `v1/points.png` 积分商城 ｜ `v1/verify.png` 校园认证 ｜ `v1/feedback.png` 反馈 ｜ `v1/report.png` 举报 ｜ `v1/settings.png` 设置 ｜ `v1/legal-agreement.png` 用户协议 ｜ `v1/legal-privacy.png` 隐私政策

**管理端 Admin**
`v1/admin.png` 审核台 ｜ `v1/announcements.png` 公告管理 ｜ `v1/categories.png` 类目管理

## 如何重新生成 / How to regenerate

```bash
cd uni-app && npm run build:h5      # 产物：dist/build/h5
npx serve dist/build/h5             # 或用任意静态服务器
# 用 Playwright / Puppeteer 以 390×844、deviceScaleFactor=2 逐页截图，输出到 docs/screenshots/v1/
```

## 规则 / Rules

- 截图必须来自**当前构建产物**，不允许手绘或改图冒充。
- 界面变更后同步重截；旧图直接替换，不留历史版本目录（避免误导）。
- 截图里的 demo 数据由 `uni-app/src/utils/demo-data.ts` 提供，可复现。
