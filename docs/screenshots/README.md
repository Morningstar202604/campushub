# CampusHub 展示物料 / Showcase Assets

> 本目录收录 CampusHub 小程序的**界面截图、使用视频与可交互原型**，用于开源仓库的对外展示。
> All visual assets for CampusHub's open-source presentation live here — screenshots, demo video, and an interactive prototype.

## 目录结构 / Layout

| 文件 | 说明 | Description |
|------|------|-------------|
| `overview.png` | 24 页整机长图总览（按 5 组分类排版） | 24-screen overview wall, grouped into 5 flows |
| `demo.mp4` | 37 秒使用演示视频（1080×1920，带中文字幕） | 37s usage demo video (1080×1920, Chinese subtitles) |
| `../preview.html` | 可交互 HTML 原型（24 页可点跳转，加 `?clean=1` 出纯净截图） | Interactive HTML prototype (24 clickable screens) |

## 单页截图 / Individual Screens (750×1624)

24 张高清单页截图，覆盖全部核心页面：

**核心主流程 Core flow**
- `index.png` — 首页瀑布流（推荐 / 热门 / 最新）
- `search.png` — 搜索（跨帖子 / 二手 / 指南）
- `post-detail.png` — 帖子详情（嵌套评论、点赞、收藏）
- `publish.png` — 发布选择（帖子 / 任务 / 失物 / 招领 / 表白）

**交易闭环 Market loop**
- `market.png` — 二手市场双列列表
- `product-detail.png` — 商品详情
- `product-publish.png` — 发布商品（价格 / 成色 / 交易方式）
- `my-list.png` — 我的发布（管理 / 标记已售）

**校园特色 Campus features**
- `guide.png` / `guide-detail.png` — 新生指南与文章详情
- `lost-found.png` — 失物招领
- `wall.png` — 表白墙

**个人中心 Profile**
- `profile.png` — 个人主页（统计 / 最近发布 / 关注）
- `profile-edit.png` — 资料编辑
- `user-profile.png` — 他人主页
- `notifications.png` — 站内通知（点赞 / 评论 / 关注）
- `verify.png` — 校园认证（实名）
- `feedback.png` — 反馈
- `agreement.png` — 用户协议 / 隐私

**管理端 Admin**
- `admin.png` — 审核台（举报处理 / 封禁 / 置顶 / 公告）
- `login.png` — 登录（微信一键登录）
- `picker.png` — 选择器组件
- `post-publish.png` — 发帖编辑
- `expired.png` — 已过期任务归档

## 如何查看 / How to view

- **长图**：直接用图片查看器打开 `overview.png`
- **视频**：本地播放器打开 `demo.mp4`，或浏览器拖入
- **原型**：浏览器打开 `../preview.html`，点击任意卡片进入对应页面；URL 加 `?clean=1` 可导出无外壳的纯净截图

## 技术备注 / Notes

- 截图为离线 headless Chromium 渲染（375×812 视口 → LANCZOS 2x 放大至 750×1624），图标全部使用内联 SVG 以避免无头环境下 emoji 渲染为豆腐块
- 视频由 ffmpeg（libopenh264）分段转场合成，13 个场景含中文字幕
- 优化建议见仓库 [`docs/OPTIMIZATION_PLAN.md`](./OPTIMIZATION_PLAN.md)
