# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-08-26

### Added — 校园场景功能补齐（路线图 v0.8/v0.9 主体）
- **失物招领模块**：`kind='lost'/'found'` 复用帖子体系；专属列表页（全部/我丢了/我捡到筛选 + 地点展示 + 已找回标记）；发布页新增失物/招领类型与地点字段；详情页显示 📍 地点；resolve 支持「已找回/已归还」
- **表白墙模式**：`kind='confession'` 强匿名（服务端强制，正文限 500 字）；独立 wall 列表页；首页顶部「💌墙」入口 + 发布菜单入口
- **热榜**：post-list 新增 `tab=hot`（近 7 天按点赞排序，新索引 idx_posts_status_likes）；首页新增「热门」Tab
- **校园身份认证**：新增 `verify` 云函数 + `verify_requests` 集合；用户提交 学校+学号+校卡照片（图片过审 fail-closed）→ 管理员人工审核（admin 新增 list-verifies / verify-review 原子审批）；个人中心认证入口与状态页；通过后发帖/商品冗余 `authorVerified` 并在信息流/详情页展示 🎖️ 已认证标识
- **订阅消息框架**：新增 `common-subscribe` 共享模块（TMPL_COMMENT/TMPL_LIKE/TMPL_FOLLOW 环境变量配置模板 ID，未配置自动跳过零成本）；评论事件 best-effort 推送；客户端在发帖/评论成功后请求订阅授权
- 新生专区：由指南「新生入学」分类承载（init-db 已含种子），配合开学季运营

### Changed
- 发布菜单扩至 4 项（帖子/二手/失物招领/表白墙）；kind 选择器 5 类
- post-create 参数校验加固（content 缺参不再 TypeError）

### 升级注意
- 存量环境需重新部署全部云函数（新增 verify、common 层 9 文件）并重跑 init-db（自动创建 verify_requests 集合）
- 热榜需在控制台补建索引 `idx_posts_status_likes`
- 订阅消息为可选能力：在小程序后台申请订阅模板后，将模板 ID 配置到相关云函数环境变量即可启用

## [0.6.1] - 2026-08-26

### Fixed — 安全与正确性（四角色联合审计修复）
- **P0 notification**：`module.exports = { createNotification }` 覆盖 `exports.main` 导致通知云函数整体失效；已移除死代码导出
- **P0 expired 页**：初始 `loading:true` 与加载守卫死锁，页面永远卡"加载中"；改为 false 并允许 reset 打断
- **图片审核 fail-open 后门**：非 `cloud://` 图片值此前被静默放行；现入口与 `checkImage` 双层强校验，外链/垃圾值一律拒绝（fail-closed）
- **管理员删除死代码**：`removeContent` 依赖不存在的 `actor.role`，管理员无法删他人内容；改走 `checkAdmin(openid)`
- **删除原子化**：软删改为条件更新原子占位（`where status != deleted`），并发双删不再双重扣计数
- **评论级联删除**：删主楼层时一并软删子回复并按实际条数回退目标 commentCount
- **通知 markRead IDOR**：补属主过滤（`userId`），只能标记自己的通知
- **签到时区**：按北京时间（UTC+8）计算自然日，修复北京 0~8 点签到记到昨天、同日可领双份积分
- **点赞/收藏/签到幂等**：likes/collects (user,target,type) 与 checkins (user,date) 改唯一索引 + `insertIdempotent`；unlike/uncollect 按实际删除行数扣减（自愈历史重复）
- **发布草稿复活**：成功后 `_published` 标记，onUnload 不再回写草稿
- **重复提交窗口**：post/product-publish、feedback、profile-edit 成功后保持 submitting/saving 直至退出；补 JS 级防重入守卫
- **my-list 类型误判**：`dataset.price` 对 0 元商品为 falsy 导致路由错页；统一用服务端口径 `itemType`
- **通知路由错误**：like/comment 通知新增 `targetType`，商品类跳商品详情；follow 跳用户主页
- **编辑模式加载失败**：立即退出，防止空白表单整篇覆盖原内容
- **请求竞态**：index/market/search 增加序号守卫，切 tab/下拉刷新旧响应晚到不再污染新视图；admin 下拉刷新放行
- **搜索分页错乱**：标题+正文合并为单查询（_.or），消除跨页重复/漏项
- **init-db fail-closed**：INIT_SECRET 未配置直接拒绝执行；createCollection 错误区分 exists 与真实故障
- **task-expire**：逐条循环改单条批量条件更新，消除 limit(100) 吞吐瓶颈
- **分类树截断**：category-manage 三处树遍历显式 limit(1000) + 成环保险丝；category-list 上限 1000；管理端保存/删除后清前端分类缓存
- **浏览量去重**：viewCount 按 (openid, 文档, 自然日) 去重自增（新增 view_logs 集合，_id 主键去重）

### Changed — 体验
- 评论分页：详情页触底加载更多评论（此前超 20 条静默丢失）；评论点赞状态由服务端回填（liked），已赞可取消
- 楼中楼折叠开关真实生效：>2 条默认折叠、点击展开/收起
- 分类选择器面包屑修复（WXML 不支持 .map().join()，改为 js 预算 pathText）
- 通知页改为点开单条才标已读（不再一进页面全标）
- 收藏列表支持取消收藏；收藏流按收藏时间排序
- 登录后回跳来源页（ensureLogin 记录 redirect）；资料更新失败给出可见提示
- emoji 昵称首字符安全渲染（firstChar 工具，10 处占位头像不再乱码）
- market 页 onShow 同步校区过滤；登录后返回生效
- 点赞/收藏/关注/签到增加在途锁 + 详情页乐观更新与失败回滚
- app.js onLaunch 分段异常兜底，系统信息失败不阻断登录态恢复
- 图片上传改逐张串行，中途失败保留进度（不产生云存储孤儿文件）
- login 并发首登靠唯一索引兜底重读；移除每次登录无条件写 updatedAt 的写放大
- user-update：college/major/grade 纳入内容安全检测；gender 白名单；头像强制 cloud:// 且过审；昵称 trim
- feedback-create：type 白名单 + contact 限长；admin 用户搜索关键词正则转义；管理回复限长并过审
- my-list 收藏 tab 显示已售标记

### 升级注意（存量环境）
1. 控制台将 likes/collects/checkins 三个索引重建为**唯一索引**（见 docs/INDEXES.md）
2. 云函数环境变量配置 `INIT_SECRET`（现为必配）
3. 全量重新部署所有云函数（common 层有变更）：`npm run sync:common && npm run deploy`

## [0.6.0] - 2026-08-11

### Added — P2 功能补齐
- **站内通知系统**：新增 `notification` 云函数（列表/未读数/标记已读/全部已读）；like/comment/follow 自动创建通知；新增 `notifications` 集合 + 索引；个人中心消息入口 + 未读 badge；新增 `pages/notifications` 页面
- **关注系统**：新增 `follow` 云函数（关注/取关/状态查询/关注列表/粉丝列表），双向计数同步，限流防刷
- **每日签到**：新增 `checkin` 云函数（连续签到 + 积分奖励，每 7 天额外加成），个人中心签到入口
- **用户主页**：新增 `user-profile` 云函数 + `user-profile` 页面（公开资料 + 统计 + 最近帖子 + 关注状态）
- **楼中楼评论**：`comment-create` 支持 `parentId` 嵌套回复；`comment-list` 返回树形结构（主楼层 + 子回复）；前端展开/折叠子回复
- **评论点赞**：`like` 函数扩展支持 `type: 'comment'`，帖子详情页评论可点赞
- **关注作者**：帖子详情页作者栏新增关注/取关按钮 + 点击作者跳转主页
- **管理员扩展**：`admin` 新增置顶/取消置顶、加精/取消加精、用户列表（搜索）、反馈列表、反馈回复
- **新增集合**：`follows`、`checkins`（init-db 自动创建）
- **新增索引**：follows 3 个（follower/following/唯一对）、checkins 1 个（user+date）、comments 楼中楼 1 个（parent+status+created）、notifications 2 个（user+created、user+read）

### Fixed — P0/P1 遗漏修复
- **guide.js 缺少 `const app = getApp()`** → Guide Tab 完全不加载（P0 回归 Bug）
- **common-context.js 字段投影不完整** → checkinStreak/lastCheckinDate/creditScore 丢失，签到连续天数永远重置为 1（P0）
- **profile 收藏计数永远显示 0** → collect 函数未更新 user.collectCount（login 新用户也未初始化该字段）
- **onShareAppMessage 空指针** → post/product/guide 详情页在数据加载前分享会崩溃
- **admin 页缺少 try/catch** → 网络错误时 loading 永远不消失；onResolve 无确认弹窗
- **app.json 死权限** → scope.userLocation 声明但从未使用
- **搜索结果重复** → 标题+内容同时命中时同一帖子出现两次
- **post-detail collects 查询缺 type 过滤**
- **collectCount/likeCount NaN 风险** → 迁移旧帖 undefined + 1 = NaN
- **expired 页 category 无 fallback** → 旧帖分类为空时显示空白
- **guide-list 无分页** → 大数据集静默截断
- **删除死代码 format.js** → getCategoryText 使用过时的扁平分类映射

### Added — P2 管理员 UI + 登录合规
- **管理员前端**：Tab 切换（举报审核/帖子管理/用户封禁）；置顶/加精/取消置顶/取消加精 UI
- **首页置顶 badge**：被管理员置顶的帖子在信息流显示 📌 置顶 标记
- **登录协议 checkbox** → 合规要求：必须勾选才能进入（此前为纯链接）

### Added — P1 核心体验
- **帖子编辑**：新增 `post-update` 云函数，作者可编辑标题/内容/图片/标签/分类（仅本人，fail-closed 内容安全 + 图片安全）
- **商品编辑**：新增 `product-update` 云函数，作者可编辑全部字段 + 标记已售/重新上架（`status: 'sold'`/`'on_sale'`）
- **帖子举报**：帖子详情页新增举报入口（6 种举报原因），补齐此前仅商品可举报的缺口
- **浏览量显示**：帖子详情、商品详情展示浏览次数
- **搜索增强**：标题 + 内容/描述/摘要双路搜索；搜索结果关键词高亮；搜索失败错误状态
- **草稿保存**：发帖/商品页退出时自动保存草稿（标题/内容/标签等），下次进入恢复
- **图片预览**：发帖/商品页点击已选图片可全屏预览（此前仅删除）
- **个人中心刷新**：进入"我的"页时从服务端刷新统计数据（发帖数/商品数/收藏数实时同步）
- **我的列表编辑入口**：我的帖子/商品列表新增"编辑"按钮，可直接跳转编辑页
- **联系方式复制**：商品详情查看联系方式时支持一键复制到剪贴板

### Changed
- **全国品牌统一**：移除全部 HSFNC / 韩师校园通硬编码，导航栏、登录页、个人中心、协议页统一为 CampusHub
- **product-list / search / guide-list** 默认不再按 schoolId 过滤（全国模式），可选传入 schoolId 缩小范围
- **首页分类筛选条** 在"二手"tab 下隐藏（此前无效显示）
- **首页商品类型判断** 改为按 tab 判定而非 `price` 字段推断（修复免费商品被误判为帖子的 Bug）
- **用户协议页** 修复 `\n` 在 `<view>` 中不换行的渲染 Bug（改用 `<text>` 标签）
- **商品详情** 操作栏重构：编辑/已售/举报/下架按钮按权限动态显示

### Fixed
- **task-expire 误过期已解决任务**：where 条件缺少 `resolved` 过滤，已解决的任务仍被置为 expired（核心逻辑 Bug）
- **like/collect 计数漂移**：取消点赞/收藏时无存在性检查，计数可漂移至负数；新增 type 白名单防跨集合误操作；新增限流防刷赞
- **comment-create 可评论已删帖**：未检查目标 status，已删除帖/商品仍可评论；新增 targetType 白名单
- **post-list 可枚举已删帖**：status 未做白名单，客户端可传 `status='deleted'` 枚举软删内容
- **guide-detail 可读取未发布指南**：未过滤 status，按 id 可读取草稿
- **user-update 头像无内容安全**：avatar 图片未走 `checkImage`，敏感图片可作头像；同时修复 tags 未强制数组、college/major/grade 无长度限制
- **product-create NaN 价格**：`Number('abc')` 为 NaN，通过 `< 0` 检查；原价可低于售价；description/contactInfo/location 无长度限制
- **admin resolve 假成功**：`.catch(() => {})` 吞掉更新失败仍返回 `resolved: true`；pageSize 未限制可致 DoS
- **category-manage reparent 不级联 level**：移动节点后子节点 level 未更新；reparent 未校验 MAX_LEVEL 可创建超 3 级
- **resolve 可标记已删帖**：未检查 `post.status`
- **report 重复举报**：同一用户可对同一目标反复提交；targetType 未白名单；description 无长度限制

### Security
- 头像图片安全审核（`checkImage`，fail-closed）
- 点赞/收藏/举报/评论全部类型白名单校验
- post-list/guide-detail 状态过滤防信息泄露
- report per-target 去重防滥用

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
