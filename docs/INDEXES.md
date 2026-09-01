# 数据库索引（部署必建）

## 为什么必须手动建？

> 微信云开发的 `wx-server-sdk` **没有 `createIndex` API**，索引只能在「云开发控制台 → 数据库 → 集合 → 索引管理」手动创建。
> 这是**平台硬约束**——任何云函数代码、本地脚本都无法绕过（除非另配腾讯云密钥走 CloudBase 原生 API，属于过度配置，不推荐）。

因此本项目的策略：**把索引定义固化为单一事实来源 `cloudfunctions/common/common-indexes.js`**，
并在 `init-db` 部署时**自动检测缺失并回显清单**——部署一次就看清还差哪些，把"人因遗漏导致列表卡顿"的风险从根上消灭。

`init-db` 调用 `db.collection(x).getIndexes()` 读取现有索引，与下方定义比对，
缺哪几个就打印到云函数日志、并随返回结果一并返回 `missingIndexes` 字段，绝不会静默漏建。

## 控制台创建步骤

1. 微信开发者工具 → 云开发 → 数据库 → 对应集合
2. 左侧「索引管理」→「新建索引」
3. 填写「索引名称」「索引字段」（字段名 + 升序/降序）；唯一索引勾选「唯一」
4. **字段顺序**必须与下表「索引字段」从左到右一致；**方向**必须与代码中 `orderBy` 方向一致

> 方向：升序 = asc，降序 = desc。组合索引命中前提是查询的 `where/orderBy` 字段顺序匹配索引前缀。

## 索引清单（权威定义见 `common-indexes.js`）

### users
| 索引名称 | 字段（方向） | 唯一 |
|---|---|---|
| idx_users_openid | openid (升) | 是 |

### posts
| 索引名称 | 字段（方向） | 唯一 |
|---|---|---|
| idx_posts_school_status_created | schoolId(降), status(降), createdAt(降) | 否 |
| idx_posts_school_status_pinned_created | schoolId(降), status(降), isPinned(降), createdAt(降) | 否 |
| idx_posts_user_created | userId(降), createdAt(降) | 否 |
| idx_posts_school_status_title | schoolId(降), status(降), title(降) | 否 |
| idx_posts_category_status_created | categoryPath(降), status(降), createdAt(降) | 否 |
| idx_posts_status_kind_expire | status(降), kind(降), expireAt(降) | 否 |
| idx_posts_status_created | status(降), createdAt(降) | 否 |
| idx_posts_status_likes | status(降), likeCount(降) | 否 |
| idx_posts_status_pinned_created | status(降), isPinned(降), createdAt(降) | 否 |
| idx_posts_category_status_pinned_created | categoryPath(降), status(降), isPinned(降), createdAt(降) | 否 |
| idx_posts_status_likes_created | status(降), likeCount(降), createdAt(降) | 否 |

### categories
| 索引名称 | 字段（方向） | 唯一 |
|---|---|---|
| idx_categories_parent | parentId (升) | 否 |
| idx_categories_status_level_order | status(升), level(升), order(升) | 否 |

### products
| 索引名称 | 字段（方向） | 唯一 |
|---|---|---|
| idx_products_school_status_created | schoolId(降), status(降), createdAt(降) | 否 |
| idx_products_school_status_category_created | schoolId(降), status(降), category(降), createdAt(降) | 否 |
| idx_products_user_created | userId(降), createdAt(降) | 否 |
| idx_products_school_status_title | schoolId(降), status(降), title(降) | 否 |

### comments
| 索引名称 | 字段（方向） | 唯一 |
|---|---|---|
| idx_comments_target_status_created | targetId(升), status(升), createdAt(降) | 否 |
| idx_comments_user_created | userId(降), createdAt(降) | 否 |
| idx_comments_parent_status_created | parentId(升), status(升), createdAt(升) | 否 |

### likes / collects / checkins / follows
> ⚠️ likes / collects 的 (user, target, type)、checkins 的 (user, date)、follows 的 (follower, following) 为**唯一索引**——
> 并发双击/重复请求靠它们兜底去重（配合云函数 `insertIdempotent` 幂等插入）。
> 已有环境升级时需在控制台把这几个索引改为唯一（或删掉重建为唯一索引）。

| 集合 | 索引名称 | 字段（方向） | 唯一 |
|---|---|---|---|
| likes | idx_likes_user_target_type | userId(升), targetId(升), type(升) | **是** |
| collects | idx_collects_user_target_type | userId(升), targetId(升), type(升) | **是** |
| collects | idx_collects_user_created | userId(降), createdAt(降) | 否 |
| checkins | idx_checkins_user_date | userId(升), date(升) | **是** |
### follows
> ⚠️ `idx_follows_follower_following` 为**唯一索引**——关注操作依赖它做幂等（`insertIdempotent`），并发双点关注不会产生重复关系。
| 集合 | 索引名称 | 字段（方向） | 唯一 |
|---|---|---|---|
| follows | idx_follows_follower_created | followerId(升), createdAt(降) | 否 |
| follows | idx_follows_following_created | followingId(升), createdAt(降) | 否 |
| follows | idx_follows_follower_following | followerId(升), followingId(升) | **是** |
### notifications
| 集合 | 索引名称 | 字段（方向） | 唯一 |
|---|---|---|---|
| notifications | idx_notifications_user_created | userId(升), createdAt(降) | 否 |
| notifications | idx_notifications_user_read | userId(升), isRead(升) | 否 |

### reports / feedbacks
| 集合 | 索引名称 | 字段（方向） | 唯一 |
|---|---|---|---|
| reports | idx_reports_reporter_created | reporterId(升), createdAt(降) | 否 |
| reports | idx_reports_status_created | status(升), createdAt(降) | 否 |
| feedbacks | idx_feedbacks_user_created | userId(升), createdAt(降) | 否 |

### guides / guide_categories
| 集合 | 索引名称 | 字段（方向） | 唯一 |
|---|---|---|---|
| guides | idx_guides_school_status_category_sort_created | schoolId(升), status(升), categoryId(升), sort(升), createdAt(降) | 否 |
| guides | idx_guides_school_status_title | schoolId(升), status(升), title(降) | 否 |
| guide_categories | idx_guide_categories_school | schoolId(升) | 否 |

---

## 备注

- `config` 集合的 `_id` 索引为系统自带，无需手动建。
- `view_logs`（浏览量去重日志）靠 `_id` 主键天然去重，无需额外索引。
- 频率限制（`rateLimit`）依赖 `(匹配字段, createdAt)` 的计数查询，已对应到各集合索引。
- 软删除内容通过 `status: _.neq('deleted')` 过滤，相关集合已包含对应索引。
- 若未建索引，云函数内部 `wrap()` 会返回 `{ success:false }` 而非崩溃，但对应列表会**空白**——上线前请务必建全。
- 新增索引后，下次部署跑一次 `init-db`，返回结果的 `missingIndexes` 应为空数组，即表示齐备。
