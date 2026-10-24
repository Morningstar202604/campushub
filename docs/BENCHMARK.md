# 竞品对标调研

> 检索日期 2026-10-24。star 数为当日 GitHub API 读数；闭源产品仅依据公开商店页/官网，不确定处标「未确认」。

## 1. Discourse

- **定位**：开源社区论坛标杆，主张把对话沉淀为可检索的长期知识。
- **技术栈**：Ruby on Rails + PostgreSQL + Redis，Ember.js 前端，GPL-2.0，Docker 单容器可跑。
- **核心功能**：分类/主题、个人消息、实时 Chat、通知、徽章、REST API；AI 侧有主题摘要、语义搜索、毒性检测，2026.9 起内置 MCP server。
- **内容治理**：TL0–TL4 按读帖/回帖/获赞阈值自动升级（TL4 人工）；flag 进 Moderator flag queue，3 flag 自动隐藏；watched words 支持 block/flag/replace/tag/link；PostRevision 存每次编辑；删帖可恢复。
- **可借鉴**：
  1. **统一审核收件箱**：用户举报、关键词命中、新用户首帖合并为 review_items，状态机 open/wip/resolved/rejected，管理台一屏处置。
  2. **分级词表**：block 拒发、flag 进队列、replace 自动替换；词表存 config 集合，云函数内存缓存 5 分钟。
  3. **编辑历史**：post-update 前把旧 title/content/images 快照进 post_revisions，管理台做字段级 diff。
- **来源**：https://www.discourse.org/features ；https://blog.discourse.org/2018/06/understanding-discourse-trust-levels/ ；https://meta.discourse.org/t/watched-words-reference-guide/241735 ；https://meta.discourse.org/t/discourse-moderation-guide-part-3-managing-content/406266

## 2. Flarum

- **定位**：轻量、快、可扩展的讨论平台，MIT 许可，面向中小社区。
- **技术栈**：PHP 8.3+，Mithril 前端，MySQL 8.0.30+/MariaDB 10.3+/SQLite/PostgreSQL；默认搜索走 MySQL 全文索引。
- **核心功能**：讨论、标签、提及、点赞、通知；多数能力以 bundled extension 形式提供（flags、approval、tags、messages、audit、suspend、realtime 等），默认只启用一部分。
- **内容治理**：flags 扩展的定位是「Allow users to flag posts for moderator review」；approval 让讨论/回复先审后发；audit 记录管理动作且防篡改（默认关闭）；suspend 可按天或无限期停权，停权后按访客权限处理。拉黑不在核心，需第三方 FoF Ignore Users。
- **可借鉴**：
  1. **标签双轨**：primary 当分类（对应现有三级分类），secondary 做跨类兴趣（「急」「已解决」）。
  2. **灰度审核**：新用户首 N 帖置 status=pending，管理台一键通过；复用现有 status 字段。
  3. **功能开关**：按学校配置 features 集合（表白墙/二手/失物是否启用）。
- **来源**：https://flarum.org/ ；https://docs.flarum.org/2.x/install ；https://github.com/flarum/framework/tree/main/extensions/flags ；https://docs.flarum.org/2.x/extensions/audit/

## 3. NodeBB

- **定位**：Node.js 论坛，强调实时、移动优先与联邦化。
- **技术栈**：Node.js 22+，MongoDB/PostgreSQL/Redis，Socket.IO，GPL-3.0；约 15.2k star。
- **核心功能**：分类与标签、Chat（频道/DM）、实时通知、群组与权限、REST API、插件与主题、原生 ActivityPub（可对接 Mastodon）。
- **内容治理**：flags 支持 post/user/message 三类目标，状态 open/wip/resolved/rejected；可见性按角色分层——管理员看全部、全局版主只看帖子、分类版主只看本分类、私信 flag 仅管理员可见；帖子编辑历史由 `enablePostHistory` 开关控制，写入 `Posts.diffs`；`Posts.restore` / `Topics.restore` 支持软删恢复。
- **可借鉴**：
  1. **举报状态机 + 角色可见域**：reports 增加 status 与 scope 字段，管理台按 categoryPath 过滤，板块版主只看本版。
  2. **群组权限矩阵**：用 groups + 全局/分类两级权限替代单一 role 字段。
  3. **实时通知**：客户端 watch 自己的 notifications 集合即可获得推送，无需自建 WebSocket。
- **来源**：https://nodebb.org/ ；https://github.com/NodeBB/NodeBB ；https://github.com/NodeBB/NodeBB/blob/master/src/flags.js

## 4. HumHub 与 Mastodon

- **定位**：开源企业社交网络/内网（PHP Yii2，AGPL-3.0，约 6.8k star），核心模型 User / Spaces / Content / Modules，官方称约 80 个模块。
- **核心功能**：个人资料、关注、Spaces（独立权限与通知）、帖子/Wiki/媒体/活动/任务、评论、搜索、归档。
- **内容治理**：reportcontent 允许用户举报给 Space 与超级管理员，并支持自定义敏感词过滤，命中即拒；Mastodon 提供 limit（降可见）→ freeze（冻结可逆）→ suspend（封禁）三级处置，3.5 起可在 20 天内申诉一次。
- **可借鉴**：
  1. **Space 权限模型**：把「学校→分区→版块」做成带成员的 space，版主与通知设置挂在 space 上。
  2. **提交时敏感词过滤**：补本地词库，命中即拒，不依赖微信接口可用性。
  3. **分级处置与申诉**：users 增加 active/limited/frozen/banned，reports 增加 appeal 字段。
- **来源**：https://github.com/humhub/humhub ；https://github.com/humhub/reportcontent ；https://docs.joinmastodon.org/admin/moderation/

## 5. 校园社区类产品（公开信息）

- **技术栈**：均为闭源商业产品，技术栈未公开（未确认）。
- **定位**：面向在校生的实名/半实名校园社区，靠课表、二手、失物、问答等高频场景聚合流量。
- **代表产品**：
  - **校园集市**（哈尔滨和景科技）：校园问答、课表小组件、选课评价、跑腿、家教、线下二手，明确以「校园认证」作为社区纯度手段。
  - **狐友**（搜狐）：校园圈、关注、标签、跑腿、课表、投票、热搜、徽章、语音评论；支持圈内拉黑、移除粉丝、帖子设为私密；未见校园认证说明。
  - **搭搭校园**：覆盖 2800+ 高校，学生证/学信网/录取单认证后解锁本校表白墙、匿名树洞、聊天室、跳蚤市场、找搭子、圈子、闪聊。
  - **树下 / Souler**：未确认——公开检索未命中独立校园社区条目；App Store 同名「树下」为智慧树课程平台，Souler 无对应记录。本项目旧审计把「Souler/校内（超级课程表·树下）」列为对标，本次无法核实，按未确认处理。
- **内容治理**：校园集市以「校园认证」筛人；搭搭校园认证后才解锁本校校园墙，并以「学校认证+双向选择」保障搭子社交；狐友支持圈内拉黑、移除粉丝、帖子私密、视频强制打标，审核队列未公开（未确认）。
- **可借鉴**：
  1. **认证即门槛**：认证后才可进表白墙等敏感板块，比全站强制认证更易冷启动。
  2. **匿名与实名分离**：前台匿名、后台保留 userId 可追溯（本项目已实现）。
  3. **场景聚合**：用课表/二手/失物/问答聚合成一个首页入口，提升打开频次，而非新增业务线。
- **来源**：https://apps.apple.com/cn/app/id1624882996 ；https://apps.apple.com/cn/app/id1354304906 ；https://apps.apple.com/cn/app/id6720758529

## 6. 开源校园项目

- **ZJU-CC98/Forum**：222 star，Apache-2.0，React/Redux/TypeScript/SignalR，浙大 CC98 桌面 Web 前端；板块、多楼层回复、私信、关注、签到、风评奖惩。仅前端，后端未开源。
- **Xin-Felix/Mango**：848 star，GPL-2.0，微信小程序 + Spring Boot/MyBatis/MySQL；表白墙、失物招领、二手、论坛、兼职、拼车、活动；管理在 C 端内完成，支持匿名与封禁；已归档（2026-10），作者不推荐生产使用。
- **oubingbing/school_wechat**：1.1k star，MIT，小程序前端 + 独立后端 wechatAlliance；表白墙、树洞、私信、站内信、话题、评论点赞收藏；靠 alliance_key 做一校一部署授权。
- **可借鉴**：
  1. **API 契约先行**：CC98 前后端彻底分离，便于多端复用。
  2. **独立管理台 + 审计**：Mango 的前端内管理导致改数据库才能加管理员，本项目应保留独立后台并补操作日志。
  3. **一校一部署授权**：alliance_key 模式与本项目一校一署一致，可复用到交付流程。
- **来源**：https://github.com/ZJU-CC98/Forum ；https://github.com/Xin-Felix/Mango ；https://github.com/oubingbing/school_wechat

## 能力矩阵

| 能力项 | 本项目 | Discourse | Flarum | NodeBB | 校园产品 |
|---|---|---|---|---|---|
| 发帖 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 多级分类 | ✅ 三级 categoryPath | ✅ 分类/子类 | ⚠️ 主标签+一级子标签 | ✅ 分类树 | ⚠️ 圈子/板块，层级未公开 |
| 评论 | ✅ 楼中楼 | ⚠️ 扁平+引用 | ⚠️ 扁平回复 | ⚠️ 扁平+引用 | ✅ |
| 私信 | ✅ | ✅ PM | ✅ Messages（默认未启用） | ✅ Chat/DM | ✅ 狐友/搭搭 |
| 拉黑 | ✅ 双向校验 | ✅ ignore/mute | ⚠️ 需第三方 ignore-users | ✅ 内置 blocks 模块 | ✅ 狐友圈内拉黑 |
| 举报审核 | ✅ 举报+后台 | ✅ flag queue | ✅ Flags+Approval | ✅ 四态状态机 | ⚠️ 有审核，机制未公开 |
| 编辑历史 | ❌ | ✅ PostRevision | ❌ 核心无，需插件 | ⚠️ 需开 enablePostHistory | 未确认 |
| 敏感词 | ⚠️ 仅微信 msgSecCheck | ✅ watched words | ⚠️ Akismet 反垃圾，非词表 | ⚠️ 插件/发帖队列 | 未确认 |
| 软删恢复 | ⚠️ 有软删，无恢复入口 | ✅ 可恢复已删帖 | 未确认 | ✅ Posts.restore | 未确认 |
| 信任等级 | ❌ | ✅ TL0–TL4 | ❌ | ⚠️ 声誉+群组 | ❌/未确认 |
| 全文搜索 | ⚠️ 正则全表扫描 | ✅ PG 全文 | ✅ MySQL 全文 | ⚠️ DB 搜索/插件 | ✅ 校园集市 |
| 通知 | ✅ | ✅ | ✅ | ✅ 实时 | ✅ |
| 签到积分 | ✅ | ❌ | ❌ | ❌ | ⚠️ 徽章，非积分 |
| 校园认证 | ✅ 人工审核 | ❌ | ❌ | ❌ | ✅ |
| 移动端 | ✅ 小程序原生 | ✅ iOS/Android | ⚠️ 响应式 | ✅ 响应式（PWA 未确认） | ✅ |
| 多端 | ✅ 小程序/H5/APK | ⚠️ Web+App | ⚠️ Web | ⚠️ Web+API | ⚠️ iOS/Android |

## 优先级建议

### P0（上线前）

1. **举报审核闭环**：现状已有 list-reports/delete/resolve/ban，但缺中间态与轻处置。验收：pending→wip→resolved/rejected 流转，支持隐藏/警告/删帖/封禁四种处置，同一目标的重复举报合并计数，操作写审计。
2. **敏感词分级词库**：msgSecCheck 只有通过/拒绝，无法分级。验收：block/flag/replace 三类词表后台可维护，发布链路 5 分钟内生效，flag 进审核队列，单测覆盖。
3. **编辑历史**：UGC 纠纷与审核需要证据。验收：post-update 写 post_revisions，作者与管理员可看 diff，保留最近 10 版。
4. **软删恢复**：现有 status=deleted 不可逆。验收：后台回收站可恢复帖子/评论，恢复后计数与楼中楼结构正确，操作留痕。
5. **私信治理闭环**：私信已有 msgSecCheck、10 秒 10 条限频与双向拉黑校验，但 reports 的 targetType 只有 post/product/comment，私信不可举报。验收：会话内可举报单条消息，非互关用户每日会话数上限可配，被举报消息进入同一审核队列。

### P1（上线后 1–2 个迭代）

6. **低信任先审后发**：新用户或被举报用户首 3 帖进 pending。验收：后台一键通过/驳回，通过后自动发布并通知。
7. **轻量信任等级**：用行为阈值替代人工判断。验收：TL1–TL3 规则可配置，影响发帖频率、图片数、举报权重，每日 cron 重算。
8. **搜索增强**：正则全表在万级数据退化。验收：分类/标签过滤、热搜、结果高亮；超过 1 万条可切 Meilisearch 的开关与降级方案。
9. **板块版主与权限矩阵**：目前只有全局管理员。验收：category.moderators 可配置，版主只能处置本分类内容。

### P2（有余力再做）

10. **审核数据看板**：举报量、平均处理时长、命中词 Top10、封禁数，按周聚合。
11. **相关帖子推荐**：同类目+热度+标签，不引入向量库；详情页底部 5 条，埋点看点击率。
12. **通知聚合与免打扰**：按类型分组、免打扰时段、未读角标一致。

> 说明：本文件的「本项目」结论取自仓库现状（cloudfunctions/*、uni-app/src/pages/*，2026-10-24）；闭源产品的治理细节以其公开页面为准，未公开部分一律标未确认。

---

## 落地状态（v0.12.0，2026-10-24）

| 建议 | 状态 | 落点 |
|---|---|---|
| 1 举报审核闭环 | ⚠️ 部分 | 已有 pending → resolved/rejected（忽略）+ 删除 / 封禁 / 认证审核；**未做** wip 中间态与「同一目标重复举报合并计数」 |
| 2 敏感词分级词库 | ✅ 已落地 | `common-words.js` + `word-manage` + `sensitive_words` 集合；block/replace/flag 三类，5 分钟缓存，命中 flag 进 `reports(source=word_filter)` |
| 3 编辑历史 | ✅ 已落地 | `post-update` 快照 → `post_revisions`（保留 10 版）；`revision-list` 仅作者/管理员；详情页「历史」弹层 |
| 4 软删恢复 | ✅ 已落地 | `content-restore`（帖子/商品/评论），原子占位 + 计数回补 + 幂等；管理台「内容回收站」 |
| 5 私信治理闭环 | ⚠️ 部分 | 已支持 `targetType=message` 举报（校验会话参与方）+ 长按菜单；**未做**每日会话数上限 |
| 6 低信任先审后发 | ❌ 未做 | 需要状态机 `pending` 与发布链路分流，改动面大，留待后续 |
| 7 轻量信任等级 | ❌ 未做 | 同上 |
| 8 搜索增强 | ⚠️ 部分 | 已有热词聚合 / 服务端限频 / 正则转义 / 结果高亮；**未做** Meilisearch 开关（当前量级不需要） |
| 9 板块版主与权限矩阵 | ❌ 未做 | 现只有全局管理员；版主需要 `category.moderators` 与读侧作用域，留待后续 |
| 10 审核数据看板 | ✅ 已落地 | `admin-stats` + `pages/admin/dashboard`（队列 / 规模 / 平均处理时长，7/30/90 天） |
| 11 相关帖子推荐 | ✅ 已落地 | `post-related`：同分类 + 点赞 + 时间，不足回退全站；详情页「相关阅读」 |
| 12 通知聚合与免打扰 | ❌ 未做 | 通知中心当前按时间倒序单流 |

> 未做项的共同原因：都要求新增集合或改发布状态机（低信任先审 / 版主 / 通知偏好），属于产品级决策，不宜在没有真实运营数据时先斩后奏。v0.12.0 只落地了「不改变现有用户路径、纯增量」的部分。
