# CampusHub

> **全国性校园 / 兴趣内容社区（微信小程序 + 云开发）—— 一个新时代的开源贴吧。**
> 多级分类、发帖、二手交易、楼中楼评论、签到、关注、内容安全、管理后台，开箱即用、零成本。
>
> 🇨🇳 [中文](#概述) ｜ 🇬🇧 [English](../README.md) ｜ 🌐 [官网落地页](https://Morningstar202604.github.io/campushub/)

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](../LICENSE)
[![Version](https://img.shields.io/badge/version-0.6.0-green.svg)](../CHANGELOG.md)
[![Stars](https://img.shields.io/github/stars/Morningstar202604/campushub?style=social)](https://github.com/Morningstar202604/campushub)

> 如果这个项目对你有帮助，欢迎点击右上角 ★ **Star** 支持一下，让更多人能检索到它。也欢迎提 [Issue](https://github.com/Morningstar202604/campushub/issues) 与 [PR](https://github.com/Morningstar202604/campushub/pulls)。
>
> **搜索关键词**：微信小程序开源 / 校园社区开源 / 开源贴吧 / 校园论坛 / 二手交易小程序 / 云开发开源 / 微信小程序论坛 / 兴趣社区 / 校园二手 / 学生社区

---

## 概述

CampusHub 是一个基于**微信小程序 + 微信云开发**的内容社区，定位是「新时代的贴吧」：
用户可以在**多级分类目录**下自由发帖、提问、交易、找同好。

- 内容**默认全国可见**，不锁定在某一所学校
- 分类树（分区→吧→板块，三级）**由管理员后台管理**，加学校、开新吧无需改代码
- 任务类内容支持**自动过期**与**已解决标注**

## 功能特性

- **多级分类目录**：分区→吧→板块三级，`categoryPath` 祖先路径筛选，仅允许发到叶子节点
- **信息流首页**：帖子+商品瀑布流，推荐/最新/二手 Tab，分类筛选 + 过期归档入口
- **贴吧式发帖**：图文帖子、分类、标签、匿名发布、草稿保存、图片预览
- **任务与过期**：3/7/15/30天有效期，定时函数每 6 小时扫描，过期自动归档；作者/管理员可标"已解决"
- **二手交易**：商品发布、价格/成色/交易方式、联系方式、标记已售、编辑商品
- **楼中楼评论**：嵌套回复、评论点赞、回复指定用户
- **关注系统**：关注/取关、粉丝/关注数、用户主页
- **每日签到**：连续签到 + 积分奖励（每7天额外加成）
- **站内通知**：点赞/评论/关注自动生成通知
- **校园指南**：分类指南文章
- **搜索**：全站搜索（标题+内容），关键词高亮
- **内容安全**：所有 UGC 经微信内容安全 API，**fail-closed（审核失败即拒绝）**
- **管理后台**：举报审核、封禁/解封、置顶/加精、用户列表、反馈管理、分类 CRUD

## 技术栈

- **前端**：原生微信小程序 + TDesign 组件库
- **后端**：微信云开发（云函数 + 云数据库 + 云存储）
- **架构**：`cloudfunctions/common/` 共享内核层（9 个模块，同步到全部 35 个云函数）

## 项目规模

| 维度 | 数量 |
|------|------|
| 云函数 | 35 |
| 前端页面 | 19 |
| 数据集合 | 14 |
| 索引定义 | 33 |

## 快速开始

> **完整部署指南见 [`DEPLOY.md`](./DEPLOY.md)** — 从填 AppID 到上线共 10 步。

```bash
npm install          # 安装依赖 + 自动同步内核层
# 在微信开发者工具中：工具 → 构建 npm
# 填入 AppID (project.config.json) 和云环境 ID (miniprogram/app.js)
# 部署 34 个云函数 → 配置管理员 → 调用 init-db → 建索引 → 测试 → 上线
```

## 设计要点

- **匿名机制**：帖子/评论可匿名，商品不可匿名（信任隔离）
- **内容安全 fail-closed**：任何审核异常一律拒绝发布
- **封禁一致性**：`requireActiveUser()` 统一拦截所有写操作
- **内容删除单一事实来源**：`removeContent()` 软删除 + 图片回收 + 计数回退
- **索引自检**：`init-db` 比对定义与线上索引，缺失项回显
- **软删除**：保留数据可追溯，计数同步回退
- **安全搜索**：关键字正则转义 + 限长，防 ReDoS

## 多平台同步

| 平台 | 地址 | 角色 |
|------|------|------|
| **GitCode** | gitcode.com/badhope/campushub | 源仓库 |
| **GitHub** | github.com/Morningstar202604/campushub | 镜像 + CI |
| **Gitee** | gitee.com/badhope/campushub | 镜像（国内访问） |

## 开源协议

[Apache License 2.0](../LICENSE) © 2026 Morningstar202604
