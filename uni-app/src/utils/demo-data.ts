/**
 * 本地演示数据层（demo mode）。
 *
 * 为什么需要它：
 *   本仓库是「一校一部署」的开源模板，克隆下来并未连任何 CloudBase 环境。
 *   未填 envId 时，所有 callFunction 都会以 ENV_NOT_CONFIGURED 失败，
 *   于是每个页面都只剩一句红字——这不叫「可预览」，等于把项目交付成半成品。
 *
 * 设计边界（三条铁律）：
 *   1. **只在未配置 envId 时启用**。一旦 school.config.js 填了真实 envId，
 *      本模块整体不参与，所有调用照常走云端，不存在「演示数据混进生产」的风险。
 *   2. **只读 + 本机写**。写操作（发帖/点赞/收藏/签到/反馈/举报/认证）只写入内存与
 *      uni 本地存储，不触网、不产生任何服务端副作用，刷新后按本地存储恢复。
 *   3. **契约与真后端逐字段对齐**。返回结构以 cloudfunctions 各 handler 为准，
 *      避免「演示模式能跑、联调就崩」的两套语义。
 *
 * 关闭方式：school.config.js 填 envId，或在配置里显式写 `demoMode: false`。
 */

export interface DemoResult {
  [key: string]: any
}

const STORE_KEY = 'campushub.demo.v1'
/**
 * 演示数据版本号。**改动种子结构时必须 +1**。
 *
 * 为什么需要：演示数据会被持久化到 localStorage。旧版本存下的对象缺少新字段
 * （例如 products 里的 images），新版代码用 `{...seed(), ...raw}` 合并时，
 * 旧值会覆盖新种子 —— 页面就出现「商品无图」「分类显示英文枚举」这类残缺状态，
 * 且刷新不消失（因为坏数据一直在存储里）。加版本号后旧数据直接丢弃重播。
 */
const STORE_VERSION = 2

/* ---------------------------------- 种子数据 --------------------------------- */

const now = Date.now()
const HOUR = 3600_000
const DAY = 24 * HOUR

/** 相对当前时间生成，避免「演示数据全是几个月前」的观感 */
const ago = (ms: number) => new Date(now - ms).toISOString()

interface DemoState {
  posts: any[]
  products: any[]
  guides: any[]
  guideCategories: any[]
  categories: any[]
  announcements: any[]
  notifications: any[]
  comments: any[]
  likes: Record<string, boolean>
  collects: Record<string, boolean>
  follows: Record<string, boolean>
  checkin: { dates: string[]; streak: number; points: number }
  user: any
  feedbacks: any[]
  reports: any[]
  verify: { status: string; reason?: string; submittedAt?: string; school?: string }
  pointsOrders: any[]
}

function seed(): DemoState {
  return {
    posts: [
      {
        _id: 'p1',
        userId: 'u-me',
        userNickname: '林小满',
        userAvatar: '',
        authorVerified: true,
        isAnonymous: false,
        schoolId: 'demo',
        categoryId: 'c-life',
        categoryPath: ['c-zone', 'c-life'],
        category: '生活',
        kind: 'post',
        title: '图书馆四楼自习位拼团',
        content:
          '每天下午 2-6 点固定占位，互相监督，限 4 人。已连续三周，效率确实比自己一个人高很多。',
        images: [],
        tags: ['自习', '拼团'],
        likeCount: 42,
        commentCount: 2,
        collectCount: 8,
        viewCount: 316,
        status: 'normal',
        isPinned: false,
        resolved: false,
        createdAt: ago(2 * HOUR),
        updatedAt: ago(2 * HOUR)
      },
      {
        _id: 'p2',
        userId: 'u-2',
        userNickname: '计算机协会',
        userAvatar: '',
        authorVerified: true,
        isAnonymous: false,
        schoolId: 'demo',
        categoryId: 'c-club',
        categoryPath: ['c-zone', 'c-club'],
        category: '社团',
        kind: 'post',
        title: '周五电竞社 vs 动漫社友谊赛，欢迎围观',
        content: '本周五晚 7 点，大学生活动中心 3 楼。现场有应援物和抽奖，路过也能进来坐。',
        images: [],
        tags: ['社团活动'],
        likeCount: 128,
        commentCount: 0,
        collectCount: 23,
        viewCount: 1042,
        status: 'normal',
        isPinned: true,
        resolved: false,
        createdAt: ago(5 * HOUR),
        updatedAt: ago(5 * HOUR)
      },
      {
        _id: 'p3',
        userId: 'u-3',
        userNickname: '匿名同学',
        userAvatar: '',
        authorVerified: false,
        isAnonymous: true,
        schoolId: 'demo',
        categoryId: 'c-study',
        categoryPath: ['c-zone', 'c-study'],
        category: '学习',
        kind: 'confession',
        title: '',
        content: '想对每天在三食堂二楼靠窗位置看书的那个女生说：你翻书的样子真的很好看。',
        images: [],
        tags: [],
        likeCount: 96,
        commentCount: 0,
        collectCount: 12,
        viewCount: 587,
        status: 'normal',
        isPinned: false,
        resolved: false,
        createdAt: ago(9 * HOUR),
        updatedAt: ago(9 * HOUR)
      },
      {
        _id: 'p4',
        userId: 'u-4',
        userNickname: '张同学',
        userAvatar: '',
        authorVerified: false,
        isAnonymous: false,
        schoolId: 'demo',
        categoryId: 'c-study',
        categoryPath: ['c-zone', 'c-study'],
        category: '学习',
        kind: 'task',
        title: '急！求解高数下册 7.3 课后题',
        content: '第 12 题卡了俩小时，有没有大佬能给个思路，在线等，挺急的。',
        images: [],
        tags: ['求助'],
        likeCount: 31,
        commentCount: 1,
        collectCount: 5,
        viewCount: 240,
        status: 'normal',
        isPinned: false,
        resolved: false,
        expireAt: new Date(now + 3 * DAY).toISOString(),
        createdAt: ago(14 * HOUR),
        updatedAt: ago(14 * HOUR)
      },
      {
        _id: 'p5',
        userId: 'u-5',
        userNickname: '失物招领处',
        userAvatar: '',
        authorVerified: true,
        isAnonymous: false,
        schoolId: 'demo',
        categoryId: 'c-life',
        categoryPath: ['c-zone', 'c-life'],
        category: '生活',
        kind: 'found',
        title: '捡到一张校园卡，姓名王**',
        content: '在图书馆一楼自助借还机旁边捡到的，已交到图书馆服务台，失主可凭学号领取。',
        images: [],
        tags: ['招领'],
        location: '图书馆一楼',
        likeCount: 18,
        commentCount: 0,
        collectCount: 2,
        viewCount: 133,
        status: 'normal',
        isPinned: false,
        resolved: false,
        createdAt: ago(20 * HOUR),
        updatedAt: ago(20 * HOUR)
      },
      {
        _id: 'p6',
        userId: 'u-6',
        userNickname: '美食探索小分队',
        userAvatar: '',
        authorVerified: false,
        isAnonymous: false,
        schoolId: 'demo',
        categoryId: 'c-food',
        categoryPath: ['c-zone', 'c-food'],
        category: '美食',
        kind: 'post',
        title: '南门新开的麻辣香锅测评',
        content: '人均 25 吃到撑，麻辣度可以选，老板是校友还打 8 折。推荐肥牛和藕片，米饭免费续。',
        images: [],
        tags: ['食堂测评'],
        likeCount: 76,
        commentCount: 0,
        collectCount: 31,
        viewCount: 892,
        status: 'normal',
        isPinned: false,
        resolved: false,
        createdAt: ago(26 * HOUR),
        updatedAt: ago(26 * HOUR)
      },
      {
        _id: 'p7',
        userId: 'u-7',
        userNickname: '毕业季',
        userAvatar: '',
        authorVerified: false,
        isAnonymous: false,
        schoolId: 'demo',
        categoryId: 'c-life',
        categoryPath: ['c-zone', 'c-life'],
        category: '生活',
        kind: 'lost',
        title: '丢失一把黑色雨伞，伞柄有贴纸',
        content: '昨天下午在 3 教 201 忘拿的，伞柄贴着一只卡通猫。有看到麻烦留言，谢谢！',
        images: [],
        tags: ['寻物'],
        location: '3 教 201',
        likeCount: 9,
        commentCount: 0,
        collectCount: 1,
        viewCount: 87,
        status: 'normal',
        isPinned: false,
        resolved: false,
        createdAt: ago(2 * DAY),
        updatedAt: ago(2 * DAY)
      }
    ],
    products: [
      {
        _id: 'pr1',
        userId: 'u-8',
        userNickname: '大四学姐',
        userAvatar: '',
        authorVerified: true,
        schoolId: 'demo',
        title: 'iPad Air 4 64G WiFi 版 银色',
        images: ['/static/demo/product-1.jpg'],
        description:
          '九成新，上学期买的，一直贴膜戴壳，无磕碰无维修。配原装充电器和保护壳，可验机。',
        price: 1580,
        originalPrice: 4399,
        category: 'digital',
        condition: 'new',
        tradeType: 'face',
        location: '东区宿舍楼下',
        contactInfo: '微信同号',
        likeCount: 34,
        collectCount: 21,
        viewCount: 671,
        status: 'on_sale',
        createdAt: ago(4 * HOUR),
        updatedAt: ago(4 * HOUR)
      },
      {
        _id: 'pr2',
        userId: 'u-9',
        userNickname: '考研人',
        userAvatar: '',
        schoolId: 'demo',
        title: '考研英语真题全套 + 单词书',
        images: ['/static/demo/product-2.jpg'],
        description: '2020-2024 真题，做过一部分，答案完整。单词书全新未拆。打包出。',
        price: 45,
        originalPrice: 180,
        category: 'books',
        condition: 'good',
        tradeType: 'both',
        location: '图书馆门口',
        contactInfo: '私信',
        likeCount: 12,
        collectCount: 9,
        viewCount: 203,
        status: 'on_sale',
        createdAt: ago(11 * HOUR),
        updatedAt: ago(11 * HOUR)
      },
      {
        _id: 'pr3',
        userId: 'u-10',
        userNickname: '阿泽',
        userAvatar: '',
        schoolId: 'demo',
        title: '山地自行车 捷安特 ATX',
        images: ['/static/demo/product-3.jpg'],
        description: '骑了两年，刹车刚换新，链条上过油。毕业带不走，诚心出。',
        price: 320,
        originalPrice: 1280,
        category: 'sports',
        condition: 'fair',
        tradeType: 'face',
        location: '南区车棚',
        contactInfo: '电话联系',
        likeCount: 27,
        collectCount: 14,
        viewCount: 415,
        status: 'on_sale',
        createdAt: ago(1 * DAY),
        updatedAt: ago(1 * DAY)
      },
      {
        _id: 'pr4',
        userId: 'u-11',
        userNickname: '收纳控',
        userAvatar: '',
        schoolId: 'demo',
        title: '宿舍收纳箱 三个装',
        images: ['/static/demo/product-4.jpg'],
        description: '搬宿舍剩下的，尺寸 40x30x25，可叠放。三个一起出，不单卖。',
        price: 30,
        originalPrice: 90,
        category: 'living',
        condition: 'good',
        tradeType: 'face',
        location: '西区 7 号楼',
        contactInfo: '私信',
        likeCount: 6,
        collectCount: 4,
        viewCount: 96,
        status: 'on_sale',
        createdAt: ago(2 * DAY),
        updatedAt: ago(2 * DAY)
      }
    ],
    guideCategories: [
      { _id: 'gc-1', name: '新生指南', sort: 1, schoolId: 'demo' },
      { _id: 'gc-2', name: '学习攻略', sort: 2, schoolId: 'demo' },
      { _id: 'gc-3', name: '生活服务', sort: 3, schoolId: 'demo' }
    ],
    guides: [
      {
        _id: 'g1',
        title: '新生必读：报到第一天要做的 8 件事',
        summary: '从入校到宿舍安顿，一份照着做就行的清单。',
        coverImage: '',
        categoryId: 'gc-1',
        category: '新生指南',
        tags: ['报到', '新生'],
        viewCount: 1284,
        status: 'published',
        sort: 1,
        createdAt: ago(30 * DAY),
        content:
          '<h2>报到流程</h2><p>先到体育馆报到点核验录取通知书与身份证，领取宿舍钥匙和校园卡。</p><h2>必办事项</h2><ul><li>激活校园卡并充值</li><li>办理宿舍网络</li><li>领取军训服装</li><li>加入班级群</li></ul><h2>避坑提示</h2><p>不要在校门口买"学长推荐"的电话卡，官方套餐在食堂一楼营业厅办理即可。</p>'
      },
      {
        _id: 'g2',
        title: '图书馆座位与借阅全攻略',
        summary: '选座、续借、研讨间预约，一篇说清。',
        coverImage: '',
        categoryId: 'gc-3',
        category: '生活服务',
        tags: ['图书馆'],
        viewCount: 764,
        status: 'published',
        sort: 2,
        createdAt: ago(20 * DAY),
        content:
          '<h2>选座</h2><p>四楼以上是安静区，二楼是讨论区。考试周建议早上 7:30 前到。</p><h2>借阅</h2><p>本科生同时可借 10 本，借期 30 天，可在线续借两次。</p>'
      },
      {
        _id: 'g3',
        title: '期末复习：如何两周过完一学期',
        summary: '优先级排序 + 真题策略 + 记忆曲线。',
        coverImage: '',
        categoryId: 'gc-2',
        category: '学习攻略',
        tags: ['期末', '复习'],
        viewCount: 2310,
        status: 'published',
        sort: 3,
        createdAt: ago(15 * DAY),
        content:
          '<h2>先排序</h2><p>按"学分 × 挂科难度"排序，先保高学分必修课。</p><h2>再刷真题</h2><p>近三年真题至少过两遍，比看课本效率高得多。</p>'
      }
    ],
    categories: [
      {
        _id: 'c-zone',
        name: '本校',
        parentId: '',
        level: 1,
        order: 1,
        status: 'active',
        schoolId: 'demo'
      },
      {
        _id: 'c-study',
        name: '学习',
        parentId: 'c-zone',
        level: 2,
        order: 1,
        status: 'active',
        schoolId: 'demo'
      },
      {
        _id: 'c-life',
        name: '生活',
        parentId: 'c-zone',
        level: 2,
        order: 2,
        status: 'active',
        schoolId: 'demo'
      },
      {
        _id: 'c-club',
        name: '社团',
        parentId: 'c-zone',
        level: 2,
        order: 3,
        status: 'active',
        schoolId: 'demo'
      },
      {
        _id: 'c-food',
        name: '美食',
        parentId: 'c-zone',
        level: 2,
        order: 4,
        status: 'active',
        schoolId: 'demo'
      }
    ],
    announcements: [
      {
        _id: 'a1',
        title: '开学季活动：发布第一条帖子送 50 积分',
        content:
          '9 月 1 日至 9 月 15 日，发布任意一条内容即可获得 50 积分，积分可在积分商城兑换道具。',
        isPinned: true,
        status: 'active',
        createdAt: ago(3 * DAY)
      },
      {
        _id: 'a2',
        title: '校园认证功能上线',
        content:
          '完成学生证认证后，你的帖子与商品会展示「已认证」标识，交易更受信任。入口：「我的内容」→「校园认证」。',
        isPinned: false,
        status: 'active',
        createdAt: ago(5 * DAY)
      }
    ],
    notifications: [
      {
        _id: 'n1',
        userId: 'u-me',
        type: 'comment',
        targetType: 'post',
        targetId: 'p1',
        content: '小林 评论了你的内容',
        isRead: false,
        createdAt: ago(40 * 60 * 1000)
      },
      {
        _id: 'n2',
        userId: 'u-me',
        type: 'like',
        targetType: 'post',
        targetId: 'p1',
        content: '阿泽 赞了你的内容',
        isRead: false,
        createdAt: ago(3 * HOUR)
      },
      {
        _id: 'n3',
        userId: 'u-me',
        type: 'follow',
        targetType: 'user',
        targetId: 'u-2',
        content: '计算机协会 关注了你',
        isRead: true,
        createdAt: ago(1 * DAY)
      }
    ],
    comments: [
      {
        _id: 'cm1',
        targetId: 'p1',
        targetType: 'post',
        userId: 'u-2',
        userNickname: '小林',
        userAvatar: '',
        content: '我报名！正好也在准备考研，一起监督。',
        parentId: null,
        replyToNickname: '',
        likeCount: 5,
        replyCount: 1,
        status: 'normal',
        createdAt: ago(90 * 60 * 1000)
      },
      {
        _id: 'cm2',
        targetId: 'p1',
        targetType: 'post',
        userId: 'u-me',
        userNickname: '林小满',
        userAvatar: '',
        content: '好呀，明天下午两点四楼见。',
        parentId: 'cm1',
        replyToNickname: '小林',
        likeCount: 2,
        replyCount: 0,
        status: 'normal',
        createdAt: ago(70 * 60 * 1000)
      },
      {
        _id: 'cm3',
        targetId: 'p4',
        targetType: 'post',
        userId: 'u-3',
        userNickname: '数学系学长',
        userAvatar: '',
        content: '先把 7.2 的拉格朗日乘子法搞懂，7.3 就是套用，思路在课本例题 7-11。',
        parentId: null,
        replyToNickname: '',
        likeCount: 12,
        replyCount: 0,
        status: 'normal',
        createdAt: ago(10 * HOUR)
      }
    ],
    likes: {},
    collects: { p3: true },
    follows: { 'u-2': true },
    checkin: { dates: [], streak: 0, points: 100 },
    user: {
      _id: 'u-me',
      nickname: '林小满',
      avatar: '',
      school: '示例大学',
      schoolId: 'demo',
      college: '计算机学院',
      major: '软件工程',
      grade: '大三',
      gender: 0,
      bio: '喜欢跑步和写代码',
      tags: ['跑步', '前端'],
      verifyStatus: 'unverified',
      campusVerified: false,
      campusVerifyStatus: 'none',
      creditScore: 100,
      postCount: 1,
      productCount: 0,
      collectCount: 1,
      followerCount: 12,
      followingCount: 1,
      checkinStreak: 0,
      lastCheckinDate: '',
      renameTokens: 0,
      role: 'admin'
    },
    feedbacks: [],
    reports: [],
    verify: { status: 'none' },
    pointsOrders: []
  }
}

/* ---------------------------------- 状态存取 --------------------------------- */

let state: DemoState | null = null

function load(): DemoState {
  if (state) return state
  try {
    // ⚠️ uni.setStorageSync 会把对象包装成 { type, data } 再存；getStorageSync 返回的
    // 也是这个包装对象。早期代码直接读 raw.posts 因此恒为 undefined —— 演示数据
    // 一直是「每次启动重新播种、写不进存储」的状态。这里统一解包。
    const stored: any = uni.getStorageSync(STORE_KEY)
    const raw: any = stored && stored.data !== undefined ? stored.data : stored
    // 版本不符 → 丢弃旧数据（旧结构缺字段，合并后会产出残缺页面）
    const versionOk = raw && raw.__v === STORE_VERSION
    const shapeOk =
      raw &&
      Array.isArray(raw.posts) &&
      Array.isArray(raw.products) &&
      raw.products.length > 0 &&
      raw.products.every((p: any) => Array.isArray(p.images))
    if (versionOk && shapeOk) {
      state = raw as DemoState
      return state
    }
    if (raw) {
      // 明确告知而不是静默：排查「为什么页面数据不对」时这条日志是关键线索
      console.info('[demo] 演示数据版本或结构已变化，重置为新种子')
    }
  } catch {
    /* 存储不可用则纯内存 */
  }
  state = seed()
  save()
  return state
}

function save() {
  if (!state) return
  try {
    // 写入时带版本标记，供 load() 判断是否需要重置
    uni.setStorageSync(STORE_KEY, { ...state, __v: STORE_VERSION })
  } catch {
    /* 存储满/不可用：退化为纯内存，不影响本次会话 */
  }
}

/** 供设置页「清除演示数据」使用 */
export function resetDemoData() {
  state = seed()
  save()
}

/* ---------------------------------- 工具 ---------------------------------- */

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

function paginate<T>(list: T[], page: any, pageSize: any, key = 'list') {
  const p = Math.max(1, Number(page) || 1)
  const size = Math.min(100, Math.max(1, Number(pageSize) || 20))
  const start = (p - 1) * size
  const slice = list.slice(start, start + size)
  return { [key]: clone(slice), hasMore: start + slice.length < list.length }
}

function nextId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** 由叶子分类沿 parentId 回溯祖先链（根在前），与后端 resolveCategoryPath 语义一致 */
function buildCategoryPath(categoryId: string): string[] {
  const s = load()
  const byId = new Map(s.categories.map((c) => [c._id, c]))
  const chain: string[] = []
  const seen = new Set<string>()
  let cur: any = byId.get(categoryId)
  while (cur && !seen.has(cur._id)) {
    seen.add(cur._id)
    chain.unshift(String(cur._id))
    cur = cur.parentId ? byId.get(cur.parentId) : null
  }
  return chain
}

function categoryNameOf(categoryId: string): string {
  const s = load()
  return s.categories.find((c) => c._id === categoryId)?.name || '其他'
}

function newCommentId() {
  return nextId('cm')
}

/* ---------------------------------- 路由 ---------------------------------- */

type Handler = (event: any) => any

const handlers: Record<string, Handler> = {
  /* ---- 认证 / 用户 ---- */
  login: () => {
    const s = load()
    return { user: clone(s.user) }
  },

  'user-update': (e) => {
    const s = load()
    const allowed = [
      'nickname',
      'avatar',
      'bio',
      'school',
      'college',
      'major',
      'grade',
      'gender',
      'tags',
      'schoolId'
    ]
    for (const k of allowed) {
      if (e[k] !== undefined) s.user[k] = e[k]
    }
    save()
    return { user: clone(s.user) }
  },

  'user-profile': (e) => {
    const s = load()
    const id = String(e.userId || '')
    const isSelf = id === s.user._id
    const profile = isSelf
      ? clone(s.user)
      : {
          _id: id,
          nickname: '演示用户',
          avatar: '',
          school: '示例大学',
          college: '',
          major: '',
          grade: '',
          bio: '',
          tags: [],
          gender: 0,
          postCount: s.posts.filter((p) => p.userId === id).length,
          productCount: s.products.filter((p) => p.userId === id).length
        }
    const { role: _r, campusVerified: _cv, ...publicProfile } = profile
    const posts = s.posts
      .filter((p) => p.userId === id && p.status !== 'deleted' && !p.isAnonymous)
      .map((p) => ({
        _id: p._id,
        title: p.title,
        images: p.images,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        createdAt: p.createdAt,
        kind: p.kind,
        resolved: p.resolved,
        status: p.status
      }))
    return {
      profile: isSelf ? clone(publicProfile) : publicProfile,
      isFollowing: !!s.follows[id],
      posts
    }
  },

  verify: (e) => {
    const s = load()
    if (e.action === 'status') {
      return {
        campusVerified: s.verify.status === 'approved',
        status: s.verify.status,
        request:
          s.verify.status === 'none'
            ? null
            : {
                status: s.verify.status,
                rejectReason: s.verify.reason || '',
                school: s.verify.school || '',
                createdAt: s.verify.submittedAt || new Date().toISOString()
              }
      }
    }
    if (e.action === 'submit') {
      if (s.verify.status === 'approved') {
        throw new Error('你已通过校园认证，无需重复提交')
      }
      // 演示模式没有真实管理员，提交即视为通过（写死 pending 会让用户永远停在「审核中」，
      // 也就永远看不到认证标识的效果）。真实环境走 admin verify-review 人工审核。
      s.verify = {
        status: 'approved',
        school: String(e.school || ''),
        submittedAt: new Date().toISOString()
      }
      s.user.campusVerified = true
      s.user.campusVerifyStatus = 'approved'
      save()
      return { requestId: nextId('vr'), campusVerified: true, message: '演示模式：认证已直接通过' }
    }
    throw new Error('未知操作')
  },

  /* ---- 帖子 ---- */
  'post-list': (e) => {
    const s = load()
    const kind = e.kind
    const kinds: string[] | undefined = Array.isArray(e.kinds) ? e.kinds : undefined
    const tab = e.tab || 'recommend'
    let list = s.posts.filter((p) => p.status === 'normal')
    if (kind) list = list.filter((p) => p.kind === kind)
    else if (kinds && kinds.length) list = list.filter((p) => kinds.includes(p.kind))
    // 分类筛选：与真后端一致 —— 后端按 categoryPath 数组元素包含匹配（父分类可命中其子版块）
    if (e.categoryId) {
      list = list.filter(
        (p) => p.categoryId === e.categoryId || (p.categoryPath || []).includes(e.categoryId)
      )
    }
    // 校区筛选
    if (e.schoolId) list = list.filter((p) => p.schoolId === e.schoolId)
    if (tab === 'hot') list = [...list].sort((a, b) => b.likeCount - a.likeCount)
    else if (tab === 'latest')
      list = [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    else
      list = [...list].sort(
        (a, b) =>
          Number(b.isPinned) - Number(a.isPinned) || +new Date(b.createdAt) - +new Date(a.createdAt)
      )
    if (e.status === 'expired') list = []
    return paginate(list, e.page, e.pageSize)
  },

  'post-detail': (e) => {
    const s = load()
    const post = s.posts.find((p) => p._id === e.postId && p.status !== 'deleted')
    if (!post) throw new Error('帖子不存在或已删除')
    post.viewCount = (post.viewCount || 0) + 1
    return {
      post: clone(post),
      isLiked: !!s.likes[post._id],
      isCollected: !!s.collects[post._id]
    }
  },

  'post-create': (e) => {
    const s = load()
    // 与真实后端一致：必须选叶子分类（父分类下还有子节点则拒绝）
    const catId = String(e.categoryId || '')
    if (!catId) throw new Error('请选择分类')
    const hasChildren = s.categories.some((c) => c.parentId === catId && c.status === 'active')
    if (hasChildren) throw new Error('请选择更具体的分类')
    const id = nextId('p')
    const isAnon = e.kind === 'confession' ? true : !!e.isAnonymous
    s.posts.unshift({
      _id: id,
      userId: s.user._id,
      userNickname: isAnon ? '匿名同学' : s.user.nickname,
      userAvatar: isAnon ? '' : s.user.avatar,
      authorVerified: !isAnon && !!s.user.campusVerified,
      isAnonymous: isAnon,
      schoolId: 'demo',
      categoryId: e.categoryId || 'c-life',
      // 与真后端一致：由 categoryId 回溯祖先链，分类名取叶子节点，绝不写死
      categoryPath: buildCategoryPath(e.categoryId || 'c-life'),
      category: categoryNameOf(e.categoryId || 'c-life'),
      kind: e.kind || 'post',
      title: String(e.title || ''),
      content: String(e.content || ''),
      images: e.images || [],
      tags: e.tags || [],
      location: e.location || '',
      likeCount: 0,
      commentCount: 0,
      collectCount: 0,
      viewCount: 0,
      status: 'normal',
      isPinned: false,
      resolved: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    s.user.postCount = (s.user.postCount || 0) + 1
    save()
    return { postId: id }
  },

  'post-update': (e) => {
    const s = load()
    const post = s.posts.find((p) => p._id === e.postId)
    if (!post) throw new Error('帖子不存在')
    for (const k of ['title', 'content', 'images', 'tags', 'categoryId']) {
      if (e[k] !== undefined) post[k] = e[k]
    }
    post.updatedAt = new Date().toISOString()
    save()
    return { updated: true }
  },

  'post-delete': (e) => {
    const s = load()
    const post = s.posts.find((p) => p._id === e.postId)
    if (post) post.status = 'deleted'
    save()
    return { deleted: true }
  },

  resolve: (e) => {
    const s = load()
    const post = s.posts.find((p) => p._id === e.postId)
    if (post) {
      post.resolved = true
      post.resolvedAt = new Date().toISOString()
    }
    save()
    return { resolved: true }
  },

  /* ---- 商品 ---- */
  'product-list': (e) => {
    const s = load()
    let list = s.products.filter((p) => p.status === 'on_sale')
    const cat = e.category
    if (cat && cat !== 'all') list = list.filter((p) => p.category === cat)
    const kw = String(e.keyword || '').trim()
    if (kw) list = list.filter((p) => String(p.title || '').includes(kw))
    list = [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    return paginate(list, e.page, e.pageSize)
  },

  'product-detail': (e) => {
    const s = load()
    const product = s.products.find((p) => p._id === e.productId && p.status !== 'deleted')
    if (!product) throw new Error('商品不存在或已下架')
    product.viewCount = (product.viewCount || 0) + 1
    return {
      product: clone(product),
      isLiked: !!s.likes[product._id],
      isCollected: !!s.collects[product._id]
    }
  },

  'product-create': (e) => {
    const s = load()
    // 校验强度必须与真实后端一致：真实 product-create 要求至少一张图，
    // 演示层放行会造成「演示能发、上线被拒」的错觉。
    if (!Array.isArray(e.images) || e.images.length === 0) {
      throw new Error('请至少上传一张图片')
    }
    if (!String(e.title || '').trim()) throw new Error('请输入商品标题')
    const id = nextId('pr')
    s.products.unshift({
      _id: id,
      userId: s.user._id,
      userNickname: s.user.nickname,
      userAvatar: s.user.avatar,
      authorVerified: !!s.user.campusVerified,
      schoolId: 'demo',
      title: String(e.title || ''),
      description: String(e.description || ''),
      images: e.images || [],
      price: Number(e.price) || 0,
      originalPrice: e.originalPrice != null ? Number(e.originalPrice) : undefined,
      category: e.category || 'other',
      condition: e.condition || 'good',
      tradeType: e.tradeType || 'face',
      location: e.location || '',
      contactInfo: e.contactInfo || '',
      likeCount: 0,
      collectCount: 0,
      viewCount: 0,
      status: 'on_sale',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    s.user.productCount = (s.user.productCount || 0) + 1
    save()
    return { productId: id }
  },

  'product-update': (e) => {
    const s = load()
    const product = s.products.find((p) => p._id === e.productId)
    if (!product) throw new Error('商品不存在')
    if (e.markSold !== undefined) {
      product.status = e.markSold ? 'sold' : 'on_sale'
    } else {
      for (const k of [
        'title',
        'description',
        'images',
        'price',
        'originalPrice',
        'category',
        'condition',
        'tradeType',
        'location',
        'contactInfo'
      ]) {
        if (e[k] !== undefined) product[k] = e[k]
      }
    }
    product.updatedAt = new Date().toISOString()
    save()
    return { updated: true, status: product.status }
  },

  'product-delete': (e) => {
    const s = load()
    const product = s.products.find((p) => p._id === e.productId)
    if (product) product.status = 'deleted'
    save()
    return { deleted: true }
  },

  /* ---- 我的 ---- */
  'my-list': (e) => {
    const s = load()
    if (e.stats) {
      return {
        counts: {
          posts: s.posts.filter((p) => p.userId === s.user._id && p.status !== 'deleted').length,
          products: s.products.filter((p) => p.userId === s.user._id && p.status !== 'deleted')
            .length,
          collects: Object.values(s.collects).filter(Boolean).length
        }
      }
    }
    if (e.type === 'products') {
      const list = s.products.filter((p) => p.userId === s.user._id && p.status !== 'deleted')
      return paginate(list, e.page, e.pageSize)
    }
    if (e.type === 'collects') {
      const ids = Object.keys(s.collects).filter((k) => s.collects[k])
      const posts = s.posts.filter((p) => ids.includes(p._id) && p.status !== 'deleted')
      const products = s.products.filter((p) => ids.includes(p._id) && p.status !== 'deleted')
      const merged = [...posts, ...products]
      return paginate(merged, e.page, e.pageSize)
    }
    const list = s.posts.filter((p) => p.userId === s.user._id && p.status !== 'deleted')
    return paginate(list, e.page, e.pageSize)
  },

  /* ---- 互动 ---- */
  like: (e) => {
    const s = load()
    const id = e.targetId
    const want = e.action !== 'unlike'
    const s0 = s.likes[id] || false
    if (s0 === want) return { liked: want, already: true }
    s.likes[id] = want
    const target = s.posts.find((p) => p._id === id) || s.products.find((p) => p._id === id)
    if (target) target.likeCount = Math.max(0, (target.likeCount || 0) + (want ? 1 : -1))
    save()
    return { liked: want }
  },

  collect: (e) => {
    const s = load()
    const id = e.targetId
    const want = e.action !== 'uncollect'
    const s0 = s.collects[id] || false
    if (s0 === want) return { collected: want, already: true }
    s.collects[id] = want
    s.user.collectCount = Math.max(0, (s.user.collectCount || 0) + (want ? 1 : -1))
    const target = s.posts.find((p) => p._id === id) || s.products.find((p) => p._id === id)
    if (target) target.collectCount = Math.max(0, (target.collectCount || 0) + (want ? 1 : -1))
    save()
    return { collected: want }
  },

  follow: (e) => {
    const s = load()
    const id = String(e.targetUserId || '')
    if (e.action === 'check') return { isFollowing: !!s.follows[id] }
    if (e.action === 'following' || e.action === 'followers') {
      const ids = Object.keys(s.follows).filter((k) => s.follows[k])
      const list = ids.map((k) => ({
        _id: k,
        nickname: k === 'u-2' ? '计算机协会' : '演示用户',
        avatar: '',
        school: '示例大学',
        bio: ''
      }))
      return { list, total: list.length, page: 1, pageSize: 20 }
    }
    const want = e.action !== 'unfollow'
    s.follows[id] = want
    save()
    return { following: want }
  },

  'comment-list': (e) => {
    const s = load()
    const floors = s.comments.filter(
      (c) => c.targetId === e.targetId && c.status === 'normal' && !c.parentId
    )
    const list = floors.map((f) => ({
      ...clone(f),
      liked: !!s.likes[f._id],
      replies: s.comments
        .filter((c) => c.parentId === f._id && c.status === 'normal')
        .map((r) => ({ ...clone(r), liked: !!s.likes[r._id] }))
    }))
    return { list, hasMore: false }
  },

  'comment-create': (e) => {
    const s = load()
    if (!String(e.content || '').trim()) throw new Error('请输入评论内容')
    if (String(e.content).length > 500) throw new Error('评论不能超过500字')
    const id = newCommentId()
    s.comments.push({
      _id: id,
      targetId: e.targetId,
      targetType: e.targetType || 'post',
      userId: s.user._id,
      userNickname: s.user.nickname,
      userAvatar: s.user.avatar,
      content: String(e.content || ''),
      parentId: e.parentId || null,
      replyToNickname: e.replyToNickname || '',
      likeCount: 0,
      replyCount: 0,
      status: 'normal',
      createdAt: new Date().toISOString()
    })
    const target =
      s.posts.find((p) => p._id === e.targetId) || s.products.find((p) => p._id === e.targetId)
    if (target) target.commentCount = (target.commentCount || 0) + 1
    save()
    return { commentId: id, comment: clone(s.comments[s.comments.length - 1]) }
  },

  'comment-delete': (e) => {
    const s = load()
    const c = s.comments.find((x) => x._id === e.commentId)
    if (c) {
      c.status = 'deleted'
      // 级联软删子回复（与真后端一致）
      if (!c.parentId) {
        for (const r of s.comments.filter((x) => x.parentId === c._id)) r.status = 'deleted'
      }
      const target = s.posts.find((p) => p._id === c.targetId)
      if (target) target.commentCount = Math.max(0, (target.commentCount || 0) - 1)
    }
    save()
    return { deleted: true }
  },

  /* ---- 通知 ---- */
  notification: (e) => {
    const s = load()
    if (e.action === 'unreadCount') {
      return { unreadCount: s.notifications.filter((n) => !n.isRead).length }
    }
    if (e.action === 'markRead') {
      const n = s.notifications.find((x) => x._id === e.notificationId)
      if (n) n.isRead = true
      save()
      return { marked: !!n }
    }
    if (e.action === 'markAllRead') {
      for (const n of s.notifications) n.isRead = true
      save()
      return { updated: s.notifications.length }
    }
    if (e.action === 'tmplIds') {
      return { tmplIds: { comment: '', like: '', follow: '' } }
    }
    const page = paginate(
      [...s.notifications].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
      e.page,
      e.pageSize
    )
    return {
      list: page.list,
      hasMore: page.hasMore,
      unreadCount: s.notifications.filter((n) => !n.isRead).length
    }
  },

  /* ---- 签到 / 积分 ---- */
  checkin: () => {
    const s = load()
    const d = new Date(Date.now() + 8 * 3600_000)
    const today =
      d.getUTCFullYear() +
      '-' +
      String(d.getUTCMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getUTCDate()).padStart(2, '0')
    if (s.checkin.dates.includes(today)) throw new Error('今天已经签到过了')
    s.checkin.dates.push(today)
    s.checkin.streak += 1
    const bonus = Math.floor(s.checkin.streak / 7) * 5
    const points = 1 + bonus
    s.checkin.points += points
    s.user.creditScore = s.checkin.points
    s.user.checkinStreak = s.checkin.streak
    save()
    return {
      date: today,
      streak: s.checkin.streak,
      points,
      totalPoints: s.checkin.points,
      message: `签到成功，获得${points}积分`
    }
  },

  points: (e) => {
    const s = load()
    const PRODUCTS = [
      { id: 'rename-token', name: '改名卡', price: 100, desc: '兑换后可在「编辑资料」再次修改昵称' }
    ]
    if (e.action === 'redeem') {
      const p = PRODUCTS.find((x) => x.id === e.productId)
      if (!p) throw new Error('道具不存在')
      if (s.checkin.points < p.price) throw new Error('积分不足，继续签到赚积分吧')
      s.checkin.points -= p.price
      s.user.creditScore = s.checkin.points
      // 道具要真的入库：真实 points.js 会 _.inc(renameTokens, 1)，
      // 旧版演示层不记，兑换后 renameTokens 恒 0，用户看到「兑换成功」却查无此卡。
      s.user.renameTokens = (s.user.renameTokens || 0) + 1
      s.pointsOrders.push({ productId: p.id, price: p.price, createdAt: new Date().toISOString() })
      save()
      return {
        redeemed: true,
        productId: p.id,
        creditScore: s.checkin.points,
        renameTokens: s.user.renameTokens
      }
    }
    return {
      products: PRODUCTS,
      creditScore: s.checkin.points,
      renameTokens: s.user.renameTokens || 0
    }
  },

  /* ---- 内容 ---- */
  'guide-list': (e) => {
    const s = load()
    let guides = s.guides.filter((g) => g.status === 'published')
    if (e.categoryId && e.categoryId !== 'all') {
      guides = guides.filter((g) => g.categoryId === e.categoryId)
    }
    guides = [...guides].sort((a, b) => (a.sort || 0) - (b.sort || 0))
    return {
      categories: clone(s.guideCategories),
      guides: clone(guides),
      hasMore: false
    }
  },

  'guide-detail': (e) => {
    const s = load()
    const guide = s.guides.find((g) => g._id === e.guideId && g.status === 'published')
    if (!guide) throw new Error('指南不存在')
    guide.viewCount = (guide.viewCount || 0) + 1
    return { guide: clone(guide) }
  },

  search: (e) => {
    const s = load()
    if (e.action === 'hot') {
      return { hot: ['二手教材', '失物招领', '食堂测评', '社团招新'] }
    }
    const kw = String(e.keyword || '').trim()
    if (!kw) return { posts: [], products: [], guides: [] }
    const hit = (v: any) => String(v || '').includes(kw)
    return {
      posts: clone(
        s.posts.filter(
          (p) =>
            p.status === 'normal' && (hit(p.title) || hit(p.content) || (p.tags || []).some(hit))
        )
      ),
      products: clone(
        s.products.filter((p) => p.status === 'on_sale' && (hit(p.title) || hit(p.description)))
      ),
      guides: clone(s.guides.filter((g) => hit(g.title) || hit(g.summary)))
    }
  },

  /* ---- 管理 ---- */
  announcement: (e) => {
    const s = load()
    if (e.action === 'list') {
      return {
        list: clone(s.announcements.filter((a) => a.status === 'active').slice(0, 5))
      }
    }
    if (e.action === 'list-all') return { list: clone(s.announcements) }
    if (e.action === 'create') {
      const id = nextId('a')
      s.announcements.unshift({
        _id: id,
        title: String(e.title || ''),
        content: String(e.content || ''),
        isPinned: !!e.isPinned,
        status: 'active',
        createdAt: new Date().toISOString()
      })
      save()
      return { announcementId: id }
    }
    if (e.action === 'toggle') {
      const a = s.announcements.find((x) => x._id === e.id)
      if (a) a.status = a.status === 'active' ? 'inactive' : 'active'
      save()
      return { id: e.id, status: a?.status }
    }
    if (e.action === 'delete') {
      s.announcements = s.announcements.filter((x) => x._id !== e.id)
      save()
      return { deleted: true }
    }
    throw new Error('未知操作')
  },

  'category-list': (e) => {
    const s = load()
    let list = s.categories.filter((c) => c.status === 'active')
    if (e.parentId) list = list.filter((c) => c.parentId === e.parentId)
    return { list: clone(list) }
  },

  'category-manage': (e) => {
    const s = load()
    if (e.action === 'create') {
      const id = nextId('c')
      s.categories.push({
        _id: id,
        name: String(e.name || ''),
        parentId: e.parentId || '',
        level: e.level || 1,
        order: e.order || 0,
        status: 'active',
        schoolId: 'demo'
      })
      save()
      return { categoryId: id }
    }
    if (e.action === 'update') {
      const c = s.categories.find((x) => x._id === e.id)
      if (c) Object.assign(c, { name: e.name ?? c.name, order: e.order ?? c.order })
      save()
      return { updated: true }
    }
    if (e.action === 'delete') {
      s.categories = s.categories.filter((x) => x._id !== e.id)
      save()
      return { deleted: true }
    }
    throw new Error('未知操作')
  },

  admin: (e) => {
    const s = load()
    if (e.action === 'check') return { isAdmin: s.user.role === 'admin' }

    // 行结构与真实 admin.js 对齐：主键是 reportId，且带 target 摘要对象。
    // 旧版直接回传原始报告文档（_id、无 target），管理台按 reportId 取键会拿到
    // undefined，点「忽略/删除」会把整个列表过滤空。
    if (e.action === 'list-reports') {
      const list = s.reports.map((r) => {
        const target =
          r.targetType === 'post'
            ? s.posts.find((x) => x._id === r.targetId)
            : s.products.find((x) => x._id === r.targetId)
        return {
          reportId: r._id,
          targetType: r.targetType,
          targetId: r.targetId,
          reason: r.reason,
          description: r.description,
          createdAt: r.createdAt,
          target: target
            ? {
                _id: target._id,
                status: target.status,
                ownerId: target.userId,
                ownerNickname: target.userNickname || '',
                snippet: String(target.title || target.content || '').slice(0, 80)
              }
            : { _id: r.targetId, status: 'deleted', snippet: '(已删除)' }
        }
      })
      return { list, total: list.length, page: 1, pageSize: 20 }
    }
    if (e.action === 'list-users') {
      return { list: [clone(s.user)], total: 1, page: 1, pageSize: 20 }
    }
    if (e.action === 'list-verifies') return { list: [], total: 0, page: 1, pageSize: 20 }
    if (e.action === 'list-feedbacks') {
      return { list: clone(s.feedbacks), total: s.feedbacks.length, page: 1, pageSize: 20 }
    }
    if (e.action === 'list-logs') return { list: [], total: 0, page: 1, pageSize: 20 }
    if (e.action === 'verify-review') return { reviewed: true }
    // 内容运营：前端已改为走 post-list，这里保留兜底以免旧版本调用报「未知管理操作」
    if (e.action === 'list-posts') {
      const rows = s.posts.filter((p) => p.status !== 'deleted')
      return { list: rows, total: rows.length, page: 1, pageSize: 20 }
    }

    // 处置动作要真的改本地数据，不能一律返回 {ok:true} 让 UI 假装成功
    if (e.action === 'delete') {
      const col = e.targetType === 'product' ? s.products : s.posts
      const doc = col.find((x) => x._id === e.targetId)
      if (doc) doc.status = 'deleted'
      for (const r of s.reports) {
        if (r.targetId === e.targetId && r.status === 'pending') r.status = 'resolved'
      }
      save()
      return { deleted: true }
    }
    if (e.action === 'resolve') {
      const r = s.reports.find((x) => x._id === e.reportId)
      if (r) r.status = 'resolved'
      save()
      return { resolved: true }
    }
    if (e.action === 'ban' || e.action === 'unban') {
      if (String(e.targetUserId || '') === s.user._id) {
        s.user.verifyStatus = e.action === 'ban' ? 'banned' : 'unverified'
        save()
      }
      return { action: e.action, updated: 1 }
    }
    if (
      e.action === 'pin' ||
      e.action === 'unpin' ||
      e.action === 'essence' ||
      e.action === 'unessence'
    ) {
      const post = s.posts.find((x) => x._id === e.postId)
      if (post) {
        if (e.action === 'pin') post.isPinned = true
        if (e.action === 'unpin') post.isPinned = false
        if (e.action === 'essence') post.isEssence = true
        if (e.action === 'unessence') post.isEssence = false
        save()
      }
      return { action: e.action, postId: e.postId }
    }
    throw new Error('未知管理操作')
  },

  'feedback-create': (e) => {
    const s = load()
    s.feedbacks.unshift({
      _id: nextId('fb'),
      userId: s.user._id,
      nickname: s.user.nickname,
      content: String(e.content || ''),
      contact: String(e.contact || ''),
      type: e.type || 'suggest',
      status: 'pending',
      createdAt: new Date().toISOString()
    })
    save()
    return { message: '感谢反馈，我们已经收到' }
  },

  report: (e) => {
    const s = load()
    s.reports.unshift({
      _id: nextId('rp'),
      targetId: e.targetId,
      targetType: e.targetType,
      reporterId: s.user._id,
      reason: String(e.reason || ''),
      description: String(e.description || ''),
      status: 'pending',
      createdAt: new Date().toISOString()
    })
    save()
    return { message: '举报已提交，我们会尽快处理' }
  }
}

/* ---------------------------------- 入口 ---------------------------------- */

/** 该函数名是否有本地实现。没有的话调用方应明确报「演示模式不支持」。 */
export function hasDemoHandler(fn: string): boolean {
  return Object.prototype.hasOwnProperty.call(handlers, fn)
}

/**
 * 以演示数据执行一次调用。
 * 同步返回后包成 Promise，并刻意加一个 60~120ms 的微延迟：
 * 让 loading / 骨架屏路径与真实网络请求走同一段代码，避免演示模式下这些分支永不执行。
 */
export async function callDemo(fn: string, event: Record<string, any> = {}): Promise<DemoResult> {
  const h = handlers[fn]
  if (!h) {
    throw new Error(
      `演示模式暂不支持「${fn}」：请先在 src/config/school.config.js 填入 envId 接入真实云环境`
    )
  }
  await new Promise((r) => setTimeout(r, 60 + Math.random() * 60))
  return clone(h(event) ?? {})
}
