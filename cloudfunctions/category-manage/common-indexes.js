// common-indexes.js — 数据库索引的权威定义（单一事实来源）
//
// ⚠️ 平台限制：微信云开发（wx-server-sdk）不提供 createIndex API，
//    索引必须、且只能在「云开发控制台 → 数据库 → 集合 → 索引管理」手动创建。
//    因此本文件不负责建索引，而是作为：
//      1) init-db 部署自检的数据源 —— 自动检测缺失并回显待建清单；
//      2) 生成/核对 docs/INDEXES.md 傻瓜步骤的依据。
//
// 字段方向：1 = 升序(asc)，-1 = 降序(desc)，需与代码 orderBy 方向、控制台选项一致。
// 组合索引字段顺序从左到右即索引前缀，务必与查询 where/orderBy 的字段顺序对应。
const EXPECTED_INDEXES = [
  // ===== users =====
  { collection: 'users', name: 'idx_users_openid', fields: [{ key: 'openid', direction: 1 }], unique: true },

  // ===== posts =====
  { collection: 'posts', name: 'idx_posts_school_status_created', fields: [{ key: 'schoolId', direction: -1 }, { key: 'status', direction: -1 }, { key: 'createdAt', direction: -1 }], unique: false },
  { collection: 'posts', name: 'idx_posts_school_status_pinned_created', fields: [{ key: 'schoolId', direction: -1 }, { key: 'status', direction: -1 }, { key: 'isPinned', direction: -1 }, { key: 'createdAt', direction: -1 }], unique: false },
  { collection: 'posts', name: 'idx_posts_user_created', fields: [{ key: 'userId', direction: -1 }, { key: 'createdAt', direction: -1 }], unique: false },
  { collection: 'posts', name: 'idx_posts_school_status_title', fields: [{ key: 'schoolId', direction: -1 }, { key: 'status', direction: -1 }, { key: 'title', direction: -1 }], unique: false },
  { collection: 'posts', name: 'idx_posts_category_status_created', fields: [{ key: 'categoryPath', direction: -1 }, { key: 'status', direction: -1 }, { key: 'createdAt', direction: -1 }], unique: false },
  { collection: 'posts', name: 'idx_posts_status_kind_expire', fields: [{ key: 'status', direction: -1 }, { key: 'kind', direction: -1 }, { key: 'expireAt', direction: -1 }], unique: false },
  { collection: 'posts', name: 'idx_posts_status_created', fields: [{ key: 'status', direction: -1 }, { key: 'createdAt', direction: -1 }], unique: false },
  { collection: 'posts', name: 'idx_posts_status_likes', fields: [{ key: 'status', direction: -1 }, { key: 'likeCount', direction: -1 }], unique: false },
  // 全国默认（无 schoolId）推荐流：where(status) + orderBy(isPinned, createdAt)
  { collection: 'posts', name: 'idx_posts_status_pinned_created', fields: [{ key: 'status', direction: -1 }, { key: 'isPinned', direction: -1 }, { key: 'createdAt', direction: -1 }], unique: false },
  // 分类筛选推荐流：where(categoryPath, status) + orderBy(isPinned, createdAt)
  { collection: 'posts', name: 'idx_posts_category_status_pinned_created', fields: [{ key: 'categoryPath', direction: -1 }, { key: 'status', direction: -1 }, { key: 'isPinned', direction: -1 }, { key: 'createdAt', direction: -1 }], unique: false },
  // 热榜：where(status, createdAt>since) + orderBy(likeCount, createdAt)
  { collection: 'posts', name: 'idx_posts_status_likes_created', fields: [{ key: 'status', direction: -1 }, { key: 'likeCount', direction: -1 }, { key: 'createdAt', direction: -1 }], unique: false },

  // ===== categories =====
  { collection: 'categories', name: 'idx_categories_parent', fields: [{ key: 'parentId', direction: 1 }], unique: false },
  { collection: 'categories', name: 'idx_categories_status_level_order', fields: [{ key: 'status', direction: 1 }, { key: 'level', direction: 1 }, { key: 'order', direction: 1 }], unique: false },

  // ===== products =====
  { collection: 'products', name: 'idx_products_school_status_created', fields: [{ key: 'schoolId', direction: -1 }, { key: 'status', direction: -1 }, { key: 'createdAt', direction: -1 }], unique: false },
  { collection: 'products', name: 'idx_products_school_status_category_created', fields: [{ key: 'schoolId', direction: -1 }, { key: 'status', direction: -1 }, { key: 'category', direction: -1 }, { key: 'createdAt', direction: -1 }], unique: false },
  { collection: 'products', name: 'idx_products_user_created', fields: [{ key: 'userId', direction: -1 }, { key: 'createdAt', direction: -1 }], unique: false },
  { collection: 'products', name: 'idx_products_school_status_title', fields: [{ key: 'schoolId', direction: -1 }, { key: 'status', direction: -1 }, { key: 'title', direction: -1 }], unique: false },

  // ===== comments =====
  { collection: 'comments', name: 'idx_comments_target_status_created', fields: [{ key: 'targetId', direction: 1 }, { key: 'status', direction: 1 }, { key: 'createdAt', direction: -1 }], unique: false },
  { collection: 'comments', name: 'idx_comments_user_created', fields: [{ key: 'userId', direction: -1 }, { key: 'createdAt', direction: -1 }], unique: false },

  // ===== likes / collects =====
  // unique:true —— 并发双击/重复请求靠唯一索引兜底去重（配合 insertIdempotent 幂等插入）
  { collection: 'likes', name: 'idx_likes_user_target_type', fields: [{ key: 'userId', direction: 1 }, { key: 'targetId', direction: 1 }, { key: 'type', direction: 1 }], unique: true },
  { collection: 'collects', name: 'idx_collects_user_target_type', fields: [{ key: 'userId', direction: 1 }, { key: 'targetId', direction: 1 }, { key: 'type', direction: 1 }], unique: true },
  { collection: 'collects', name: 'idx_collects_user_created', fields: [{ key: 'userId', direction: -1 }, { key: 'createdAt', direction: -1 }], unique: false },

  // ===== reports / feedbacks =====
  { collection: 'reports', name: 'idx_reports_reporter_created', fields: [{ key: 'reporterId', direction: 1 }, { key: 'createdAt', direction: -1 }], unique: false },
  { collection: 'reports', name: 'idx_reports_status_created', fields: [{ key: 'status', direction: 1 }, { key: 'createdAt', direction: -1 }], unique: false },
  { collection: 'feedbacks', name: 'idx_feedbacks_user_created', fields: [{ key: 'userId', direction: 1 }, { key: 'createdAt', direction: -1 }], unique: false },

  // ===== guides / guide_categories =====
  { collection: 'guides', name: 'idx_guides_school_status_category_sort_created', fields: [{ key: 'schoolId', direction: 1 }, { key: 'status', direction: 1 }, { key: 'categoryId', direction: 1 }, { key: 'sort', direction: 1 }, { key: 'createdAt', direction: -1 }], unique: false },
  { collection: 'guides', name: 'idx_guides_school_status_title', fields: [{ key: 'schoolId', direction: 1 }, { key: 'status', direction: 1 }, { key: 'title', direction: -1 }], unique: false },
  { collection: 'guide_categories', name: 'idx_guide_categories_school', fields: [{ key: 'schoolId', direction: 1 }], unique: false },

  // ===== follows =====
  { collection: 'follows', name: 'idx_follows_follower_created', fields: [{ key: 'followerId', direction: 1 }, { key: 'createdAt', direction: -1 }], unique: false },
  { collection: 'follows', name: 'idx_follows_following_created', fields: [{ key: 'followingId', direction: 1 }, { key: 'createdAt', direction: -1 }], unique: false },
  { collection: 'follows', name: 'idx_follows_follower_following', fields: [{ key: 'followerId', direction: 1 }, { key: 'followingId', direction: 1 }], unique: true },

  // ===== checkins =====
  // unique:true —— 同一用户同一天只能有一条签到记录（防并发双签双积分）
  { collection: 'checkins', name: 'idx_checkins_user_date', fields: [{ key: 'userId', direction: 1 }, { key: 'date', direction: 1 }], unique: true },

  // ===== comments (楼中楼) =====
  { collection: 'comments', name: 'idx_comments_parent_status_created', fields: [{ key: 'parentId', direction: 1 }, { key: 'status', direction: 1 }, { key: 'createdAt', direction: 1 }], unique: false },

  // ===== notifications =====
  { collection: 'notifications', name: 'idx_notifications_user_created', fields: [{ key: 'userId', direction: 1 }, { key: 'createdAt', direction: -1 }], unique: false },
  { collection: 'notifications', name: 'idx_notifications_user_read', fields: [{ key: 'userId', direction: 1 }, { key: 'isRead', direction: 1 }], unique: false }
]

module.exports = { EXPECTED_INDEXES }
