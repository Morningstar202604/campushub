# CampusHub 展示物料 / Showcase Assets

> 本目录只收录**当前版本**（v0.12.0「墨荧 · Acid Campus」）的真实运行截图与录屏。
> All visual assets here are real captures of the **current** build.

## 目录结构 / Layout

| 文件 | 说明 | Description |
|------|------|-------------|
| `v1/` | 33 张逐页截图（390×844 视口，deviceScaleFactor=2，H5 构建产物真实渲染） | 33 per-screen shots (390×844 @2x) |
| `overview-v1.png` | 33 页总览长图（4 列网格） | 33-screen overview wall |
| `demo.mp4` | 演示视频（首页 → 市集 → 详情 → 搜索 → 签到 → 管理台 → 设置） | Demo video |
| `demo.gif` | 同一段录屏的 GIF 版（README 内嵌） | GIF preview |

## 页面清单 / Pages

**主流程 Core flow**
`v1/index.png` 首页 ｜ `v1/search.png` 搜索 ｜ `v1/post-detail.png` 帖子详情 ｜ `v1/post-create.png` 发布

**交易 Market**
`v1/market.png` 二手市集 ｜ `v1/product-detail.png` 商品详情 ｜ `v1/product-create.png` 发布好物 ｜ `v1/my-list.png` 我的内容

**校园特色 Campus**
`v1/wall.png` 表白墙 ｜ `v1/lost-found.png` 失物招领 ｜ `v1/guide-list.png` 校园指南 ｜ `v1/guide-detail.png` 指南详情

**个人中心 Profile**
`v1/user-profile.png` 个人主页 ｜ `v1/user-update.png` 编辑资料 ｜ `v1/notification.png` 通知 ｜ `v1/follow.png` 关注 ｜ `v1/block-list.png` 黑名单 ｜ `v1/message-list.png` 私信列表 ｜ `v1/chat.png` 聊天 ｜ `v1/checkin.png` 签到 ｜ `v1/points.png` 积分商城 ｜ `v1/verify.png` 校园认证 ｜ `v1/feedback.png` 反馈 ｜ `v1/report.png` 举报 ｜ `v1/settings.png` 设置 ｜ `v1/legal-agreement.png` 用户协议 ｜ `v1/legal-privacy.png` 隐私政策

**管理端 Admin**
`v1/admin.png` 管理台 ｜ `v1/announcements.png` 公告管理 ｜ `v1/categories.png` 类目管理 ｜ `v1/dashboard.png` 运营仪表盘 ｜ `v1/words.png` 敏感词库 ｜ `v1/recycle.png` 内容回收站

## 如何重新生成 / How to regenerate

```bash
cd uni-app && npm run build:h5        # 产物：dist/build/h5
npx serve -s dist/build/h5 -l 5000    # 任意静态服务器均可
# 用 Playwright 以 390×844、deviceScaleFactor=2 逐页截图（脚本见 git 历史 / docs/screenshots）
# 截图后拼总览长图，录屏转 mp4/gif
```

## 规则 / Rules

- 截图必须来自**当前构建产物**，不允许手绘或改图冒充。
- 每轮界面变更后同步重截；旧图直接替换，不留历史版本目录（避免误导）。
- 逐页截图时同时校验：横向溢出、`undefined` / `NaN` / `[object Object]` 文本、控制台错误。任一命中即视为该页有问题，先修再截。
- 截图中的 demo 数据由 `uni-app/src/utils/demo-data.ts` 提供，可复现（`STORE_VERSION` 变化会重置种子）。
