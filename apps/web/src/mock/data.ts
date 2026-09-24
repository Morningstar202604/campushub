/**
 * 前端 Mock 数据层（无 Supabase 时用于完整跑通交互）
 * 仅开发/预览验证用：VITE_USE_MOCK=true 或 localStorage.campus_mock=1 时启用
 * 所有操作均在内存中，刷新页面即重置（登录态除外，存 localStorage）
 */

// ---------- 占位图（本地生成，避免外网依赖） ----------
const PALETTES = [
  ['#5b8def', '#8ab6ff'], ['#f6a02b', '#ffce85'], ['#2e9e5b', '#7fd6a8'],
  ['#f64f7c', '#ff9fb8'], ['#8f6bf6', '#c1a8ff'], ['#16a3b8', '#6fd8e8'],
  ['#e86f51', '#ffb39a'], ['#4f6df6', '#9db4ff']
]
export function phImg(seed: number, label = ''): string {
  const [a, b] = PALETTES[seed % PALETTES.length]
  const text = label || 'img'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="600" height="450" fill="url(#g)"/><text x="300" y="230" font-size="48" text-anchor="middle" fill="rgba(255,255,255,.9)" font-family="sans-serif">${text}</text></svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

// ---------- 基础数据 ----------
export const CATEGORIES = [
  { id: 'cat_idle', name: '二手闲置', emoji: '🛍️', icon: '🛍️', sort: 1, enabled: true },
  { id: 'cat_lost', name: '失物招领', emoji: '🔍', icon: '🔍', sort: 2, enabled: true },
  { id: 'cat_confess', name: '表白墙', emoji: '💌', icon: '💌', sort: 3, enabled: true },
  { id: 'cat_course', name: '课程学习', emoji: '📚', icon: '📚', sort: 4, enabled: true },
  { id: 'cat_activity', name: '校园活动', emoji: '🎉', icon: '🎉', sort: 5, enabled: true },
  { id: 'cat_parttime', name: '兼职实习', emoji: '💼', icon: '💼', sort: 6, enabled: true },
  { id: 'cat_carpool', name: '拼车拼团', emoji: '🚗', icon: '🚗', sort: 7, enabled: true },
  { id: 'cat_chat', name: '闲聊树洞', emoji: '💬', icon: '💬', sort: 8, enabled: true }
]

export const GUIDE_CATS = [
  { id: 'gid_freshman', name: '新生指南', icon: '🎓', sort: 1 },
  { id: 'gid_life', name: '生活贴士', icon: '🏠', sort: 2 },
  { id: 'gid_study', name: '学习攻略', icon: '✏️', sort: 3 },
  { id: 'gid_traffic', name: '交通出行', icon: '🚌', sort: 4 },
  { id: 'gid_food', name: '美食地图', icon: '🍜', sort: 5 },
  { id: 'gid_play', name: '玩乐指南', icon: '🎮', sort: 6 }
]

export const GUIDES = [
  {
    id: 'g1', category_id: 'gid_freshman', title: '新生入学准备清单（示例）',
    summary: '录取之后该做什么？一份通用的入学准备清单。',
    content: '## 一、入学前\n\n1. 仔细阅读录取通知书及附带材料\n2. 关注学校官方公众号，认准官方群\n3. 准备证件照（1寸、2寸各若干）\n\n## 二、报到时\n\n1. 录取通知书、身份证原件\n2. 团组织关系转接证明\n3. 按通知到指定地点办理入住\n\n## 三、开学后\n\n多参加社团招新和校园活动，尽快熟悉校园地图。',
    tags: ['新生', '入学', '攻略'], cover_image: phImg(0, '新生指南'), view_count: 128, created_at: ago(3)
  },
  {
    id: 'g2', category_id: 'gid_life', title: '宿舍生活小贴士（示例）',
    summary: '宿舍相处、用电安全、报修流程通用指南。',
    content: '## 宿舍常识\n\n1. 了解门禁时间，避免晚归\n2. 大功率电器多为违禁品，注意用电安全\n3. 水电报修找宿管或后勤报修平台\n\n## 室友相处\n\n提前商量作息与卫生分工，矛盾及时沟通。',
    tags: ['宿舍', '生活'], cover_image: phImg(1, '宿舍生活'), view_count: 86, created_at: ago(5)
  },
  {
    id: 'g3', category_id: 'gid_traffic', title: '高铁/机场出行指南（示例）',
    summary: '从高铁站、机场到学校的通用路线说明。',
    content: '## 高铁出行\n\n出站后可选择公交、地铁或网约车前往学校，建议提前查好末班车时间。\n\n## 机场出行\n\n机场距离市区较远，建议预留足够时间，多人可拼车。',
    tags: ['交通', '出行'], cover_image: phImg(2, '出行指南'), view_count: 64, created_at: ago(7)
  }
]

export const PROFILES: Record<string, any> = {
  'mock-me': { id: 'mock-me', nickname: '晨光同学', avatar: phImg(3, '我'), college: '示例大学', major: '计算机科学', grade: '2025级', gender: 1, bio: '爱学习也爱生活', points: 26, checkin_streak: 3, is_banned: false, is_admin: false },
  u1: { id: 'u1', nickname: '阿沐', avatar: phImg(4, '沐'), college: '示例大学', major: '软件工程', points: 88, checkin_streak: 12, is_banned: false, is_admin: false },
  u2: { id: 'u2', nickname: '小舟', avatar: phImg(5, '舟'), college: '示例大学', major: '设计学院', points: 54, checkin_streak: 6, is_banned: false, is_admin: false },
  u3: { id: 'u3', nickname: '青柠', avatar: phImg(6, '柠'), college: '示例大学', major: '外国语学院', points: 31, checkin_streak: 2, is_banned: false, is_admin: false }
}

// ---------- 帖子 ----------
export const POSTS: any[] = [
  { id: 'p1', author_id: 'u1', category_id: 'cat_idle', kind: 'post', title: '出九成新机械键盘，手感超好', content: '青轴 104 键，用了一年多，无进水无维修，配件齐全。在校内可面交，看中的同学评论区滴滴～', images: [phImg(7, '键盘'), phImg(0, '细节')], tags: [], location: '东区宿舍', is_anonymous: false, resolved: false, is_pinned: false, is_essence: false, like_count: 23, comment_count: 5, view_count: 341, status: 'normal', created_at: ago(0.2) },
  { id: 'p2', author_id: 'u2', category_id: 'cat_lost', kind: 'lost', title: '在东门捡到一张校园卡', content: '今天上午在东门公交站附近捡到一张校园卡，卡面姓"李"，已放在东门保安室，失主看到请速来认领！', images: [phImg(1, '校园卡')], tags: ['校园卡'], location: '东门', is_anonymous: false, resolved: false, is_pinned: false, is_essence: false, like_count: 8, comment_count: 2, view_count: 120, status: 'normal', created_at: ago(0.4) },
  { id: 'p3', author_id: 'u3', category_id: 'cat_confess', kind: 'confession', title: '给图书馆三楼常驻的女生', content: '经常看到你坐在靠窗的位置，认真记笔记的样子很可爱。想认识一下，如果有打扰到你很抱歉，没有别的意思，单纯欣赏你专注的样子。', images: [], tags: [], location: '', is_anonymous: true, resolved: false, is_pinned: false, is_essence: false, like_count: 56, comment_count: 18, view_count: 892, status: 'normal', created_at: ago(0.6) },
  { id: 'p4', author_id: 'u1', category_id: 'cat_course', kind: 'post', title: '高数期中复习资料整理（可共享）', content: '把重点章节的公式和典型例题整理成了一份 PDF，需要的同学回复邮箱，我看到就发。\n\n顺手放几个常考公式：\n- 极限存在准则\n- 洛必达法则适用条件\n- 分部积分法', images: [phImg(2, '高数')], tags: ['高数', '复习'], location: '', is_anonymous: false, resolved: false, is_pinned: false, is_essence: true, like_count: 45, comment_count: 11, view_count: 530, status: 'normal', created_at: ago(1) },
  { id: 'p5', author_id: 'u2', category_id: 'cat_activity', kind: 'post', title: '本周六操场社团文化节，欢迎来玩', content: '16 个社团联合摆摊，有抽奖、有表演、有奖品，晚上还有露天电影。时间：周六 18:00-21:30，地点：田径场。', images: [phImg(3, '文化节'), phImg(4, '节目单')], tags: ['社团', '活动'], location: '田径场', is_anonymous: false, resolved: false, is_pinned: true, is_essence: false, like_count: 102, comment_count: 30, view_count: 1200, status: 'normal', created_at: ago(1.2) },
  { id: 'p6', author_id: 'u3', category_id: 'cat_parttime', kind: 'post', title: '图书馆勤工俭学岗位招新', content: '图书馆二楼借阅室招两名学生助理，一周两次班，薪资面议。要求：细心、有责任心，每周可排班 4 小时以上。感兴趣的同学评论区留言或私我。', images: [], tags: ['兼职'], location: '图书馆', is_anonymous: false, resolved: false, is_pinned: false, is_essence: false, like_count: 33, comment_count: 9, view_count: 410, status: 'normal', created_at: ago(1.5) },
  { id: 'p7', author_id: 'u1', category_id: 'cat_carpool', kind: 'post', title: '周五晚回市里拼车，还剩两个位置', content: '周五 20:00 从南门出发回市区，走高速约 40 分钟，费用 AA。有需要的同学拼一下，行李多的话提前说。', images: [], tags: ['拼车'], location: '南门', is_anonymous: false, resolved: false, is_pinned: false, is_essence: false, like_count: 12, comment_count: 4, view_count: 156, status: 'normal', created_at: ago(2) },
  { id: 'p8', author_id: 'u2', category_id: 'cat_chat', kind: 'post', title: '大家晚上一般都几点睡？', content: '最近总是凌晨才睡，白天上课犯困，想看看大家的时间表，有没有早睡的好方法推荐？', images: [], tags: ['闲聊'], location: '', is_anonymous: false, resolved: false, is_pinned: false, is_essence: false, like_count: 19, comment_count: 22, view_count: 287, status: 'normal', created_at: ago(2.5) },
  { id: 'p9', author_id: 'u3', category_id: 'cat_lost', kind: 'lost', title: '伞落在二食堂，求助', content: '昨晚在二食堂二楼吃饭，走的时候忘记拿伞了，黑色折叠伞，伞柄有个小挂件。去食堂问了还没找到，有看到的同学麻烦联系一下，谢谢！', images: [phImg(5, '雨伞')], tags: ['雨伞'], location: '二食堂', is_anonymous: false, resolved: false, is_pinned: false, is_essence: false, like_count: 5, comment_count: 1, view_count: 98, status: 'normal', created_at: ago(3) },
  { id: 'p10', author_id: 'u1', category_id: 'cat_course', kind: 'task', title: '求帮忙带一份三食堂的炒饭', content: '下午 5 点半到三食堂，有人能顺路带一份鸡蛋炒饭吗？放门口就行，转你饭钱 +1 块辛苦费，谢啦！', images: [], tags: ['求助'], location: '三食堂', is_anonymous: false, resolved: false, expire_at: days(2), like_count: 3, comment_count: 6, view_count: 80, status: 'normal', created_at: ago(0.3) },
  { id: 'p11', author_id: 'u2', category_id: 'cat_lost', kind: 'found', title: '捡到一只橘猫，求主人', content: '在综合楼后面捡到一只橘猫，很亲人，脖子上没有项圈。暂时寄养在宿舍，希望主人尽快联系，也欢迎想领养的来。', images: [phImg(6, '橘猫')], tags: ['橘猫'], location: '综合楼', is_anonymous: false, resolved: false, is_pinned: false, is_essence: false, like_count: 67, comment_count: 14, view_count: 760, status: 'normal', created_at: ago(4) },
  { id: 'p12', author_id: 'u3', category_id: 'cat_idle', kind: 'post', title: '毕业清仓：台灯、书架、小风扇', content: '临近毕业，宿舍一堆东西带不走：\n1. 台灯（带 USB 充电口）15 元\n2. 三层书架 20 元\n3. 小风扇 10 元\n打包 40 元全拿走，欢迎来宿舍看货。', images: [phImg(7, '清仓'), phImg(0, '台灯')], tags: ['毕业'], location: '西区宿舍', is_anonymous: false, resolved: false, is_pinned: false, is_essence: false, like_count: 28, comment_count: 7, view_count: 365, status: 'normal', created_at: ago(5) },
  { id: 'p13', author_id: 'mock-me', category_id: 'cat_chat', kind: 'post', title: '求推荐校内好吃的麻辣烫', content: '刚搬来这边，有没有推荐的麻辣烫店？要那种汤底浓郁的，最好离教学楼近一点～评论区蹲一个答案。', images: [], tags: ['美食'], location: '', is_anonymous: false, resolved: false, is_pinned: false, is_essence: false, like_count: 6, comment_count: 3, view_count: 45, status: 'normal', created_at: ago(0.5) }
]

// ---------- 商品 ----------
export const PRODUCTS: any[] = [
  { id: 'pr1', seller_id: 'u1', category_id: 'cat_idle', title: '九成新机械键盘（青轴 104 键）', description: '自用一年，无进水无维修，键帽无打油，配件齐全。可试手感再买。', images: [phImg(7, '键盘'), phImg(0, '细节')], price: 120, original_price: 299, condition: '9成新', trade_type: '面交', location: '东区宿舍', contact_info: 'VX: mock-demo-01', status: 'on_sale', like_count: 15, collect_count: 8, comment_count: 3, view_count: 220, created_at: ago(1) },
  { id: 'pr2', seller_id: 'u2', category_id: 'cat_idle', title: '宿舍小冰箱 60L（毕业出）', description: '制冷正常，噪音小，适合两人宿舍。毕业急出，可帮忙送到楼下。', images: [phImg(1, '冰箱')], price: 180, original_price: 599, condition: '8成新', trade_type: '面交', location: '西区宿舍', contact_info: '企鹅 1024xxxx', status: 'on_sale', like_count: 9, collect_count: 5, comment_count: 2, view_count: 145, created_at: ago(2) },
  { id: 'pr3', seller_id: 'u3', category_id: 'cat_idle', title: '《数据结构》教材 + 习题集', description: '教材是第 5 版，几乎全新，只有少量划线。习题集送。', images: [phImg(2, '教材')], price: 25, original_price: 68, condition: '9成新', trade_type: '面交/快递', location: '', contact_info: '评论区留言', status: 'on_sale', like_count: 4, collect_count: 6, comment_count: 1, view_count: 89, created_at: ago(3) },
  { id: 'pr4', seller_id: 'u1', category_id: 'cat_idle', title: '小米手环 7 标准版', description: '功能正常，屏幕无划痕，送一条备用表带。', images: [phImg(3, '手环')], price: 90, original_price: 249, condition: '95新', trade_type: '面交', location: '图书馆门口', contact_info: 'VX: mock-demo-01', status: 'on_sale', like_count: 11, collect_count: 9, comment_count: 2, view_count: 178, created_at: ago(4) },
  { id: 'pr5', seller_id: 'u2', category_id: 'cat_idle', title: '懒人沙发（可拆洗）', description: '宿舍躺平神器，颜色是浅灰，套了洗过。', images: [phImg(4, '沙发')], price: 60, original_price: 150, condition: '7成新', trade_type: '面交', location: '北区宿舍', contact_info: '私我约时间', status: 'on_sale', like_count: 6, collect_count: 3, comment_count: 0, view_count: 77, created_at: ago(5) },
  { id: 'pr6', seller_id: 'u3', category_id: 'cat_idle', title: '考研英语真题（英语一）', description: '2018-2025 全套，含解析，个别年份有笔记。', images: [phImg(5, '真题')], price: 35, original_price: 120, condition: '8成新', trade_type: '快递', location: '', contact_info: '评论区留言', status: 'on_sale', like_count: 3, collect_count: 2, comment_count: 1, view_count: 66, created_at: ago(6) },
  { id: 'pr7', seller_id: 'mock-me', category_id: 'cat_idle', title: '全新台灯（带 USB 充电口）', description: '开学买错型号了，一次没用过，原包装都在。宿舍用很合适，可小刀。', images: [phImg(0, '台灯')], price: 15, original_price: 39, condition: '全新', trade_type: '面交', location: '东区宿舍', contact_info: 'VX: mock-demo', status: 'on_sale', like_count: 2, collect_count: 1, comment_count: 0, view_count: 33, created_at: ago(1) }
]

// ---------- 评论 ----------
export const COMMENTS: any[] = [
  { id: 'c1', target_type: 'post', target_id: 'p1', user_id: 'u2', parent_id: null, reply_to_user_id: null, content: '帮顶，这个键盘手感真的不错', status: 'normal', like_count: 3, created_at: ago(0.1) },
  { id: 'c2', target_type: 'post', target_id: 'p1', user_id: 'u3', parent_id: null, reply_to_user_id: null, content: '还在吗？想周末看货', status: 'normal', like_count: 1, created_at: ago(0.08) },
  { id: 'c3', target_type: 'post', target_id: 'p3', user_id: 'u1', parent_id: null, reply_to_user_id: null, content: '坐等后续！勇敢一点', status: 'normal', like_count: 9, created_at: ago(0.5) },
  { id: 'c4', target_type: 'post', target_id: 'p4', user_id: 'u2', parent_id: null, reply_to_user_id: null, content: '已私邮箱，谢谢学长！', status: 'normal', like_count: 2, created_at: ago(0.7) },
  { id: 'c5', target_type: 'product', target_id: 'pr1', user_id: 'u3', parent_id: null, reply_to_user_id: null, content: '键盘轴体是啥？', status: 'normal', like_count: 0, created_at: ago(0.6) }
]

// ---------- 通知 ----------
export const NOTIFICATIONS: any[] = [
  { id: 'n1', user_id: 'mock-me', type: 'like', content: '阿沐 赞了你的帖子《毕业清仓：台灯、书架、小风扇》', target_type: 'post', target_id: 'p12', is_read: false, created_at: ago(0.2) },
  { id: 'n2', user_id: 'mock-me', type: 'comment', content: '小舟 评论了你的帖子《毕业清仓：台灯、书架、小风扇》：书架还在吗？', target_type: 'post', target_id: 'p12', is_read: false, created_at: ago(0.5) },
  { id: 'n3', user_id: 'mock-me', type: 'system', content: '欢迎加入校园社区！完善个人资料可以获得更好体验～', target_type: null, target_id: null, is_read: true, created_at: ago(2) }
]

export const ANNOUNCEMENTS = [
  { id: 'a1', title: '欢迎来到校园社区', content: '这里是同学们自己的交流社区：二手闲置、失物招领、课程学习、校园活动都能在这找到。请文明发言，友善交流。', is_active: true, created_at: ago(1) }
]

// ---------- 内存可变状态（持久化到 localStorage，刷新不丢，更接近真实体验） ----------
const STATE_KEY = 'campus_mock_state_v1'

function freshState() {
  return {
    posts: [...POSTS],
    products: [...PRODUCTS],
    comments: [...COMMENTS],
    likes: [] as string[],        // `${type}:${id}`
    collects: [] as string[],
    follows: [] as string[],
    notifications: [...NOTIFICATIONS],
    checkins: [] as any[],        // {date, streak, points}
    reports: [] as any[],
    feedbacks: [] as any[],
    me: { ...PROFILES['mock-me'] },
    postSeq: 100,
    productSeq: 100,
    commentSeq: 100
  }
}

/** 从 localStorage 恢复（异常或版本不符则用种子数据） */
function loadState(): ReturnType<typeof freshState> {
  const fresh = freshState()
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (!raw) return fresh
    const saved = JSON.parse(raw)
    if (!saved || saved.v !== 1) return fresh
    return {
      ...fresh,
      ...saved,
      likes: saved.likes || [],
      collects: saved.collects || [],
      follows: saved.follows || [],
      me: saved.me || fresh.me
    }
  } catch {
    return fresh
  }
}

const _raw = loadState()
const state = {
  posts: _raw.posts,
  products: _raw.products,
  comments: _raw.comments,
  likes: new Set<string>(_raw.likes),
  collects: new Set<string>(_raw.collects),
  follows: new Set<string>(_raw.follows),
  notifications: _raw.notifications,
  checkins: _raw.checkins,
  reports: _raw.reports,
  feedbacks: _raw.feedbacks,
  me: _raw.me,
  postSeq: _raw.postSeq,
  productSeq: _raw.productSeq,
  commentSeq: _raw.commentSeq
}

/** 变更后调用：把当前状态写回 localStorage */
export function persist() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({
      v: 1,
      posts: state.posts,
      products: state.products,
      comments: state.comments,
      likes: [...state.likes],
      collects: [...state.collects],
      follows: [...state.follows],
      notifications: state.notifications,
      checkins: state.checkins,
      reports: state.reports,
      feedbacks: state.feedbacks,
      me: state.me,
      postSeq: state.postSeq,
      productSeq: state.productSeq,
      commentSeq: state.commentSeq
    }))
  } catch { /* 存储满则静默失败 */ }
}

function ago(days: number): string {
  return new Date(Date.now() - days * 86400000 - Math.random() * 3600000).toISOString()
}
function days(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString()
}

export const mock = {
  state,
  phImg,
  me: state.me,
  authorOf: (id: string) => (id === 'mock-me' ? state.me : PROFILES[id]) || PROFILES.u1,
  newPostId: () => `mock-p${++state.postSeq}`,
  newProductId: () => `mock-pr${++state.productSeq}`,
  newCommentId: () => `mock-c${++state.commentSeq}`
}
