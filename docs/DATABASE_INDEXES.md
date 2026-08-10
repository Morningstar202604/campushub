# 数据库索引清单（必建）

微信云开发的 `orderBy` 多字段排序、高频 `where` 查询都**依赖索引**，
否则会直接报 `invalid order` 或全表扫描超时。

> 在云开发控制台 → 数据库 → 对应集合 → 索引管理 中新建。
> 字段顺序需与"索引字段"列从左到右一致；`desc`/`asc` 需与代码 `orderBy` 方向一致。

## users（用户）

| 索引字段 | 类型 | 用途 |
|----------|------|------|
| `openid` | 单字段（唯一） | 每次写操作都按 openid 查用户，必建 |

## posts（帖子）

| 索引字段 | 类型 | 用途 |
|----------|------|------|
| `schoolId`, `status`, `createdAt` | 复合 desc,desc,desc | 最新列表 |
| `schoolId`, `status`, `isPinned`, `createdAt` | 复合 desc,desc,desc,desc | 推荐列表（置顶+时间） |
| `userId`, `createdAt` | 复合 desc,desc | 我的帖子（软删除过滤） |
| `schoolId`, `status`, `title` | 复合 | 搜索按标题匹配（排序可能回退，不影响结果） |

## products（商品）

| 索引字段 | 类型 | 用途 |
|----------|------|------|
| `schoolId`, `status`, `createdAt` | 复合 desc,desc,desc | 商品列表 |
| `schoolId`, `status`, `category`, `createdAt` | 复合 | 分类筛选列表 |
| `userId`, `createdAt` | 复合 desc,desc | 我的商品 |
| `schoolId`, `status`, `title` | 复合 | 搜索按标题匹配 |

## comments（评论）

| 索引字段 | 类型 | 用途 |
|----------|------|------|
| `targetId`, `status`, `createdAt` | 复合 | 评论列表（按目标+状态） |

## likes / collects（点赞 / 收藏）

| 集合 | 索引字段 | 类型 | 用途 |
|------|----------|------|------|
| likes | `userId`, `targetId`, `type` | 复合 | 是否已点赞计数 |
| collects | `userId`, `targetId`, `type` | 复合 | 是否已收藏计数 |
| collects | `userId`, `createdAt` | 复合 | 我的收藏列表 |

## reports（举报）/ feedbacks（反馈）

| 集合 | 索引字段 | 类型 | 用途 |
|------|----------|------|------|
| reports | `reporterId`, `createdAt` | 复合 | 频率限制计数窗口 |
| feedbacks | `userId`, `createdAt` | 复合 | 频率限制计数窗口 |

## guides（指南）/ guide_categories（指南分类）

| 集合 | 索引字段 | 类型 | 用途 |
|------|----------|------|------|
| guides | `schoolId`, `status`, `categoryId`, `sort`, `createdAt` | 复合 asc,asc,asc,asc,desc | 指南列表（按分类+排序） |
| guides | `schoolId`, `status`, `title` | 复合 | 搜索按标题匹配 |
| guide_categories | `schoolId` | 单字段 | 分类列表 |

## config（管理员配置）

| 索引字段 | 类型 | 用途 |
|----------|------|------|
| `_id` | 单字段 | 文档 `doc('global')` 读取管理员 openid 列表（系统自带） |

---

### 备注
- 频率限制（`rateLimit`）依赖 `(匹配字段, createdAt)` 的计数查询，已在上面按集合列出。
- 软删除内容通过 `status: _.neq('deleted')` 过滤，相关集合已包含对应索引。
- 若未建索引，云函数内部 `wrap()` 会返回 `{ success:false }` 而非崩溃，但对应列表会**空白**——上线前务必建全。
