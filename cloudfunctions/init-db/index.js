// cloudfunctions/init-db/index.js
// 数据库初始化云函数 — 首次部署时调用一次
// 根本性修复指南分类模型：分类使用稳定 categoryId，指南存储 categoryId 与之对应。
//
// ⚠️ 安全：本函数原无任何鉴权，任意客户端均可触发。现增加 INIT_SECRET 守卫：
// 部署后在云函数环境变量中配置 INIT_SECRET，调用时须携带相同 secret 才允许执行；
// 未配置 INIT_SECRET 时保持原行为（向后兼容），但强烈建议部署即配置。
const { getDB, ok, wrap, AppError } = require('./common-bundle')

exports.main = wrap(async (event = {}) => {
  // 安全防护：若部署时配置了 INIT_SECRET，则必须携带正确 secret 才允许初始化
  const expected = process.env.INIT_SECRET
  if (expected && event.secret !== expected) {
    throw new AppError('无权执行数据库初始化', 'FORBIDDEN')
  }

  const db = getDB()
  const results = []

  // 1. 创建集合
  const collections = [
    'users', 'posts', 'products', 'comments', 'likes', 'collects',
    'guides', 'guide_categories', 'reports', 'feedbacks'
  ]
  for (const name of collections) {
    try {
      await db.createCollection(name)
      results.push({ collection: name, status: 'created' })
    } catch (e) {
      results.push({ collection: name, status: 'exists' })
    }
  }

  // 2. 导入指南分类（使用稳定 categoryId 作为筛选主键）
  const categories = [
    { categoryId: 'freshman', name: '新生入学', sort: 1, schoolId: 'HSFNC', icon: '🎓' },
    { categoryId: 'study', name: '学习攻略', sort: 2, schoolId: 'HSFNC', icon: '📚' },
    { categoryId: 'life', name: '生活指南', sort: 3, schoolId: 'HSFNC', icon: '🌿' },
    { categoryId: 'food', name: '美食地图', sort: 4, schoolId: 'HSFNC', icon: '🍜' },
    { categoryId: 'traffic', name: '交通出行', sort: 5, schoolId: 'HSFNC', icon: '🚌' },
    { categoryId: 'play', name: '周边玩乐', sort: 6, schoolId: 'HSFNC', icon: '🎮' }
  ]
  const existingCats = await db.collection('guide_categories').where({ schoolId: 'HSFNC' }).count()
  if (existingCats.total === 0) {
    for (const cat of categories) {
      await db.collection('guide_categories').add({ data: { ...cat, createdAt: new Date() } })
    }
    results.push({ item: 'guide_categories', status: 'imported', count: categories.length })
  } else {
    results.push({ item: 'guide_categories', status: 'exists', count: existingCats.total })
  }

  // 3. 导入指南内容（categoryId 与分类表对齐）
  const guides = [
    {
      title: '韩山师范学院新生入学全攻略',
      summary: '录取通知书收到后该做什么？这份指南帮你一步步完成入学准备。',
      categoryId: 'freshman', category: '新生入学',
      tags: ['新生', '入学', '攻略'],
      content: '<h2>一、收到录取通知书后</h2><p>1. 仔细阅读录取通知书及附带材料</p><p>2. 关注学校官方微信公众号"韩山师范学院"</p><p>3. 加入新生QQ群/微信群（注意识别官方群）</p><p>4. 准备近期免冠证件照若干</p><h2>二、报到所需材料</h2><p>1. 录取通知书原件</p><p>2. 身份证及正反面复印件</p><p>3. 户口迁移证（如需迁移户口）</p><p>4. 团组织关系转接证明</p><p>5. 近期免冠证件照（1寸、2寸各若干）</p><p>6. 银行卡（学校随通知书寄送的银行卡）</p><h2>三、生活用品准备</h2><p>床上用品可到校购买或自带，建议自带被褥枕头。日常用品学校超市均有售。</p><h2>四、到校路线</h2><p>潮州站下车后可乘坐公交车或打车到学校，具体路线见"交通出行"指南。</p>',
      sort: 1, schoolId: 'HSFNC', status: 'published', viewCount: 0, createdAt: new Date()
    },
    {
      title: '宿舍生存指南：韩师各校区宿舍详解',
      summary: '东丽A/B区、东湖区的宿舍条件、设施、注意事项一网打尽。',
      categoryId: 'life', category: '生活指南',
      tags: ['宿舍', '生活', '新生'],
      content: '<h2>宿舍概况</h2><p>韩山师范学院宿舍主要分布在东丽A区、东丽B区和东湖区。</p><h2>各宿舍区情况</h2><p><strong>东丽A区</strong>：距离教学区较近，6人间为主，有独立卫浴和阳台。</p><p><strong>东丽B区</strong>：新建宿舍区，条件较好，4-6人间，设施较新。</p><p><strong>东湖区</strong>：靠近东湖，环境优美，部分宿舍可看湖景。</p><h2>宿舍注意事项</h2><p>1. 宿舍门禁时间：一般为23:00</p><p>2. 禁止使用大功率电器（如热得快、电饭锅等）</p><p>3. 宿舍电费需自行充值</p><p>4. 每学期开学需到宿管处登记入住</p><p>5. 水电维修可联系宿管阿姨报修</p>',
      sort: 2, schoolId: 'HSFNC', status: 'published', viewCount: 0, createdAt: new Date()
    },
    {
      title: '韩师食堂美食全攻略',
      summary: '各食堂特色菜、人均消费、营业时间，吃货必备指南。',
      categoryId: 'food', category: '美食地图',
      tags: ['美食', '食堂', '生活'],
      content: '<h2>各食堂简介</h2><p><strong>第一食堂</strong>：位于教学区附近，菜品丰富，人均8-12元。推荐：烧鸭饭、麻辣香锅。</p><p><strong>第二食堂</strong>：位于宿舍区，早餐品种多，人均6-10元。推荐：肠粉、皮蛋瘦肉粥。</p><p><strong>第三食堂</strong>：特色小吃窗口多，人均8-15元。推荐：牛肉面、螺蛳粉。</p><h2>周边外卖</h2><p>学校周边有较多小吃店和奶茶店，外卖可送到校门口。</p><h2>省钱小贴士</h2><p>1. 食堂使用校园卡支付有优惠</p><p>2. 晚8点后部分窗口有打折菜</p>',
      sort: 3, schoolId: 'HSFNC', status: 'published', viewCount: 0, createdAt: new Date()
    },
    {
      title: '选课攻略：通识选修课推荐',
      summary: '哪些选修课好过又有趣？学长学姐的真实评价。',
      categoryId: 'study', category: '学习攻略',
      tags: ['选课', '选修', '学习'],
      content: '<h2>选课时间</h2><p>一般每学期开学第1-2周进行选课，具体时间关注教务系统通知。</p><h2>热门选修课推荐</h2><p>1. <strong>中国茶文化</strong>：潮州是茶乡，这门课很有地方特色，老师讲得好。</p><p>2. <strong>心理学与生活</strong>：内容有趣，考核方式为论文，给分较高。</p><p>3. <strong>影视鉴赏</strong>：看电影写观后感，轻松有趣。</p><p>4. <strong>公共关系学</strong>：实用性强，对未来就业有帮助。</p><h2>选课技巧</h2><p>1. 提前登录教务系统，选课开始后立即操作</p><p>2. 准备好备选课程，热门课可能秒没</p><p>3. 注意选修课学分要求，一般需修满指定学分</p>',
      sort: 4, schoolId: 'HSFNC', status: 'published', viewCount: 0, createdAt: new Date()
    },
    {
      title: '潮州交通出行指南',
      summary: '从韩师出发，公交、高铁、飞机怎么坐最方便。',
      categoryId: 'traffic', category: '交通出行',
      tags: ['交通', '出行', '潮州'],
      content: '<h2>校内出行</h2><p>校区不大，步行即可。东丽区和东湖区之间步行约10分钟。</p><h2>市内公交</h2><p>校门口有多路公交车，可达潮州古城、牌坊街等景点。</p><h2>高铁出行</h2><p><strong>潮汕站</strong>：距离学校约30分钟车程，可打车或坐公交前往。有通往广州、深圳、厦门等地方向列车。</p><h2>飞机出行</h2><p><strong>揭阳潮汕机场</strong>：距离约40分钟车程，有通往全国主要城市的航班。</p><h2>打车/网约车</h2><p>滴滴等网约车在潮州可正常使用，市内出行方便。</p>',
      sort: 5, schoolId: 'HSFNC', status: 'published', viewCount: 0, createdAt: new Date()
    },
    {
      title: '韩师周边吃喝玩乐地图',
      summary: '牌坊街、广济桥、西湖公园...周末去哪玩？',
      categoryId: 'play', category: '周边玩乐',
      tags: ['周边', '游玩', '周末'],
      content: '<h2>必去景点</h2><p>1. <strong>牌坊街</strong>：潮州古城标志性景点，有22座牌坊，沿街有各种小吃和手工艺品店。</p><p>2. <strong>广济桥</strong>：中国四大古桥之一，晚上有灯光秀。</p><p>3. <strong>西湖公园</strong>：免费开放，适合散步休闲。</p><p>4. <strong>韩文公祠</strong>：纪念韩愈的文化景点，可了解潮州历史文化。</p><h2>美食推荐</h2><p>1. 牛肉丸（推荐：官塘兄弟牛肉店）</p><p>2. 肠粉（推荐：牌坊街各家肠粉店）</p><p>3. 卤鹅（推荐：溪口刘卜鹅肉店）</p><p>4. 甘草水果（牌坊街多处有售）</p><h2>逛街购物</h2><p>潮州万达广场、潮州大润发等商场可满足日常购物需求。</p>',
      sort: 6, schoolId: 'HSFNC', status: 'published', viewCount: 0, createdAt: new Date()
    }
  ]

  const existingGuides = await db.collection('guides').where({ schoolId: 'HSFNC' }).count()
  if (existingGuides.total === 0) {
    for (const guide of guides) {
      await db.collection('guides').add({ data: guide })
    }
    results.push({ item: 'guides', status: 'imported', count: guides.length })
  } else {
    results.push({ item: 'guides', status: 'exists', count: existingGuides.total })
  }

  return ok({ message: '数据库初始化完成', results })
})
