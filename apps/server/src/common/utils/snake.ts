/** camelCase → snake_case 的键名转换（admin 前端沿用 v1 的 snake_case 字段名） */

const SNAKE_MAP: Record<string, string> = {
  isPinned: 'is_pinned',
  isEssence: 'is_essence',
  isActive: 'is_active',
  isBanned: 'is_banned',
  isAdmin: 'is_admin',
  isRead: 'is_read',
  viewCount: 'view_count',
  likeCount: 'like_count',
  commentCount: 'comment_count',
  collectCount: 'collect_count',
  categoryId: 'category_id',
  sellerId: 'seller_id',
  authorId: 'author_id',
  reporterId: 'reporter_id',
  handledBy: 'handled_by',
  handledAt: 'handled_at',
  targetType: 'target_type',
  targetId: 'target_id',
  userId: 'user_id',
  coverImage: 'cover_image',
  adminId: 'admin_id',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  checkinStreak: 'checkin_streak',
  lastCheckinDate: 'last_checkin_date',
  tradeType: 'trade_type',
  originalPrice: 'original_price',
  contactInfo: 'contact_info',
};

/** 单个键转换：命中表直接换，否则通用 camelCase → snake_case */
function toSnakeKey(key: string): string {
  if (SNAKE_MAP[key]) return SNAKE_MAP[key];
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** 递归转换对象所有键（Date 原样保留，数组逐项处理） */
export function toSnakeKeys<T>(input: T): unknown {
  if (input === null || input === undefined) return input;
  if (input instanceof Date) return input;
  if (Array.isArray(input)) return input.map((v) => toSnakeKeys(v));
  if (typeof input === 'object') {
    // Prisma Decimal 等带自定义 toJSON 的类型原样保留（避免拍平成内部字段）
    const ctor = Object.getPrototypeOf(input)?.constructor;
    if (ctor && ctor !== Object) return input as unknown;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[toSnakeKey(k)] = toSnakeKeys(v);
    }
    return out;
  }
  return input;
}

/** 分页响应包装：{list,total} 且 list 逐项转 snake_case */
export function snakeList<T>(list: T[], total: number) {
  return { list: list.map((v) => toSnakeKeys(v)), total };
}
