# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-08-10

### Added
- **全国性定位**：移除单校硬编码（`schoolId` 不再钉死 HSFNC），内容默认全国可见，可选 `schoolId` 仅看某校区
- **多级分类目录**：分区 → 吧 → 板块三级结构，`categories` 集合 + `categoryPath` 祖先路径数组，按任意父节点可捞出其下全部内容；仅允许发到叶子节点
- **任务与过期机制**：任务帖可选有效期 3/7/15/30 天；`task-expire` 定时函数每小时扫描，过期自动置 `status:'expired'` 并沉入过期页
- **已解决标注**：`resolve` 云函数支持作者 / 管理员标记任务「已解决」
- **分类管理后台**：新增 `category-manage` 云函数（管理员 CRUD，≤3 级、防环、软删）+ `category-admin` 小程序页，加学校 / 开新吧无需改代码重部署
- **索引自检**：新增 `cloudfunctions/common/common-indexes.js` 作为索引定义单一事实来源，`init-db` 部署时调用 `getIndexes()` 比对并回显 `missingIndexes`
- `checkAdmin` 提取至 `common-security.js`，`admin` / `resolve` / `category-manage` 共用同一套管理员判定

### Changed
- 同步脚本 `scripts/sync-mirrors.sh`：代理实现独立为 `scripts/gh-proxy.py`，仅 `github` 远端走代理；修复受限网络下 GitHub 推送失败（DNS 劫持、TLS 过早半关闭、CONNECT 粘包、pkill 自杀）
- 文档体系梳理：README / `package.json` 定位更新为全国性社区；索引文档统一指向 `docs/INDEXES.md`
- 云函数目录结构更新（新增 `category-list` / `category-manage` / `resolve` / `task-expire`，共 27 个可部署函数）

### Fixed
- 受限网络下 GitHub 三方同步失败（详见 `scripts/gh-proxy.py` 说明）

## [0.4.0] - 2026-08-10

### Added
- 管理员前端审核台（封禁/解封/内容审核台 list-reports/delete/resolve）
- `common-content.js` 抽 `removeContent` 作内容删除单一事实来源，消除 4 处重复删除逻辑

### Fixed
- 修复原"管理员删除"死代码分支（`users` 从不写 `role`，管理员实际删不了内容）
- 图片上传按真实扩展名存储（不再一律 `.jpg`）
- 删除帖子/商品时回收云存储图片，避免孤儿文件累积
- 发布页单张图片 9MB 大小校验

## [0.3.0]
### Fixed
- 图片扩展名、头像上传、云存储图片回收、9MB 单图校验

## [0.2.0]
### Changed
- 引入 `cloudfunctions/common/` 共享内核层，根本性修复内容安全 fail-closed、封禁一致性、指南分类、删除功能等 13 项问题

## [0.1.0]
### Added
- 初始版本：微信小程序 + 云开发基础功能（贴吧、二手、指南、搜索、个人中心）

---

## 安全加固（v0.4.0 补丁，未变更版本号）
- `init-db` 云函数增加 `INIT_SECRET` 守卫，部署配置后任意客户端不可再触发初始化
- `feedback-create` / `user-update` / `report` 写操作统一接入 `requireActiveUser`，封禁用户不再可绕过
- 新增图片内容安全 `checkImage`/`checkImages`（fail-closed），发帖与商品发布的图片经 `imgSecCheck` 二次校验
- `comments` 集合补充 `(userId, createdAt)` 索引，修复评论频率限制全表扫描
