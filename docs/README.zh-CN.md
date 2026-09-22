# CampusHub

> **一校一署的开源校园内容社区 —— uni-app 一套代码，三端交付（微信小程序 / H5 / 安卓 APK），后端微信云开发零成本起步。**
> 多级分类、发帖、二手交易、楼中楼评论、签到积分、关注、内容安全、管理后台，开箱即用。
>
> 📖 [使用说明书](./USER_GUIDE.md) ｜ 🇨🇳 [中文](#概述) ｜ 🇬🇧 [English](../README.md) ｜ 🌐 [官网落地页](../index.html)

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../LICENSE)
[![Version](https://img.shields.io/badge/version-0.9.2-green.svg)](../CHANGELOG.md)
[![uni-app](https://img.shields.io/badge/uni--app-Vue%203%20·%20Vite-42b883.svg)](https://uniapp.dcloud.net.cn/)
[![GitCode](https://img.shields.io/badge/GitCode-badhope%2Fcampushub-blue)](https://gitcode.com/badhope/campushub)

> 如果这个项目对你有帮助，欢迎点击右上角 ★ **Star** 支持一下，让更多人能检索到它。也欢迎提 [Issue](https://gitcode.com/badhope/campushub/issues) 与 [PR](https://gitcode.com/badhope/campushub/pulls)。
>
> **搜索关键词**：校园内容平台开源 / uni-app 开源 / 校园小程序 / 校园二手交易 / 云开发开源 / 一校一署 / 校园信息发布 / 学习生活助手

---

## 截图预览

| 首页 | 二手市场 | 失物招领 | 个人中心 |
|---|---|---|---|
| ![首页](screenshots/index.png) | ![二手市场](screenshots/market.png) | ![失物招领](screenshots/lost-found.png) | ![个人中心](screenshots/profile.png) |

📁 [24 张单页高清截图](./screenshots/) ｜ 🎬 [37s 演示视频](./screenshots/demo.mp4) ｜ 🖼️ [24 页总览长图](./screenshots/overview.png) ｜ 🛠️ [可交互原型](./preview.html)

---

## 概述

CampusHub 是一个基于 **uni-app（Vue 3 + Vite）+ 微信云开发（CloudBase）** 的开源校园内容社区，采用「**一校一部署**」模式：

- **一套代码，三端交付**：微信小程序（`wx.cloud.callFunction`）、H5（REST + restToken）、安卓 APK（HBuilderX 云打包），共用 20 个页面与同一套 37 个云函数
- 内容**面向本校师生**，每个学校独立部署一个云环境
- 分类树（分区→版块→子版，三级）**由管理员后台管理**，加学校、开新分类无需改代码
- 任务类内容支持**自动过期**与**已解决标注**

![系统架构](architecture.svg)

## 功能亮点

- 🌳 **多级分类**：`categoryPath` 祖先数组，单一索引覆盖任意层级筛选，发帖限定叶子节点
- 🏠 **信息流首页**：帖子 + 商品双列瀑布流，推荐 / 热门 / 最新 Tab，分类筛选
- 🛒 **二手市场**：类目 / 成色 / 交易方式枚举白名单，标记已售 / 重新上架 / 编辑
- 💬 **楼中楼评论**：楼层 + 子回复，replyCount 原子回退，计数不漂移
- ⏳ **任务过期**：3/7/15/30 天 TTL，6 小时 cron 自动归档
- 📅 **签到积分**：连续签到 + 积分商城（改名卡），唯一索引防双签
- 🛡️ **内容安全 fail-closed**：全部 UGC 经微信内容安全接口，任何异常即拒绝发布
- ⚛️ **原子限频**（v0.9.2）：`rate_limits` 确定性 _id 占位 + 原子自增，杜绝并发绕过
- 💾 **自动备份 + 日志生命周期**：每日 03:00 快照，90 天浏览日志定时清理
- ⚙️ **管理后台**：举报审核、封禁、置顶/精华、公告、类目 CRUD、操作审计

![内容模型](data-model.svg)

## 项目规模

| 指标 | 数量 |
|---|---|
| 云函数 | 37（+ 1 共享内核目录） |
| 前端页面 | 20（三端共用） |
| 数据库集合 | 23 |
| 已定义索引 | 45 |
| 契约测试 | 25 项（CI 强制） |

## 文档导航

| 文档 | 说明 |
|---|---|
| [交付手册 HANDOVER](./HANDOVER.md) | ★ 企业交接入口：交付物 / 环境 / 部署 / 验收 |
| [验收报告 ACCEPTANCE](./ACCEPTANCE.md) | ★ 验收结论 + 买家可复跑命令 |
| [部署指南 DEPLOY](./DEPLOY.md) | 从 AppID 到上线的 10 步 |
| [索引清单 INDEXES](./INDEXES.md) | 45 条索引控制台建卡步骤 |
| [成本方案 COST](./COST.md) | 免费额度 → 生产 19.9 元/月 |
| [合规要点 COMPLIANCE](./COMPLIANCE.md) | 个人主体 UGC 合规路径 |
| [使用说明书 USER_GUIDE](./USER_GUIDE.md) | 面向最终用户 |
| [两轮审核记录 REVIEW](./REVIEW-20260922.md) | 19 + 10 项修复对照与验证矩阵 |

## 快速开始

```bash
# 后端：npm install → 微信开发者工具导入部署 37 函数 → 开 HTTP 访问 + 匿名登录
#       → init-db 建集合 → 按 INDEXES.md 建 45 条索引 → 配 ADMIN_OPENIDS
# 前端：cd uni-app && npm install → 填 school.config.js（envId/restToken）→ 三端构建
npm run build:h5           # H5
npm run build:mp-weixin    # 微信小程序
# 安卓 APK：HBuilderX 云打包，见 uni-app/docs/ANDROID_BUILD.md
```

完整步骤见 [DEPLOY.md](./DEPLOY.md) 与 [HANDOVER.md](./HANDOVER.md)。

## 多平台镜像

四平台并列同步（同分支、同标签、同 HEAD），任意选用：

| 平台 | 地址 |
|---|---|
| GitHub | <https://github.com/x33834/campushub> |
| GitHub | <https://github.com/Morningstar202604/campushub> |
| GitCode | <https://gitcode.com/badhope/campushub> |
| Gitee | <https://gitee.com/badhope/campushub> |

同步方式见 [SYNC.md](./SYNC.md)。

## 许可证

[Apache License 2.0](../LICENSE) © 2026 Morningstar202604
