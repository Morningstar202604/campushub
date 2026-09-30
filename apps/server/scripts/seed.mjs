// 种子数据：8 内容分类 + 欢迎公告（对应 packages/db/seed.sql）
// 用法：node scripts/seed.mjs
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES = [
  { id: 'cat_idle', name: '二手闲置', emoji: '🛒', sort: 1 },
  { id: 'cat_lost', name: '失物招领', emoji: '🔍', sort: 2 },
  { id: 'cat_confess', name: '表白墙', emoji: '💌', sort: 3 },
  { id: 'cat_course', name: '课程学习', emoji: '📚', sort: 4 },
  { id: 'cat_activity', name: '校园活动', emoji: '🎉', sort: 5 },
  { id: 'cat_parttime', name: '兼职互助', emoji: '💼', sort: 6 },
  { id: 'cat_carpool', name: '拼车拼团', emoji: '🚗', sort: 7 },
  { id: 'cat_chat', name: '闲聊水区', emoji: '💬', sort: 8 },
];

for (const c of CATEGORIES) {
  await prisma.category.upsert({
    where: { id: c.id },
    update: {},
    create: { ...c, status: 'active' },
  });
}

const hasAnnouncement = await prisma.announcement.count();
if (!hasAnnouncement) {
  await prisma.announcement.create({
    data: {
      title: '欢迎来到校园社区',
      content: '这里是同学们自己的交流社区：二手闲置、失物招领、课程学习、校园活动都能在这找到。请文明发言，友善交流。',
      isPinned: true,
      status: 'active',
    },
  });
}

console.log(`seed done: ${CATEGORIES.length} categories, ${hasAnnouncement ? 0 : 1} announcement`);

// ---- 指南分类 + 示例指南（对应 packages/db/seed.sql） ----
const GUIDE_CATEGORIES = [
  { id: 'gid_freshman', name: '新生入学', icon: '🎓', sort: 1 },
  { id: 'gid_life', name: '生活服务', icon: '🏠', sort: 2 },
  { id: 'gid_study', name: '学习攻略', icon: '📝', sort: 3 },
  { id: 'gid_traffic', name: '交通出行', icon: '🚌', sort: 4 },
];
let guideCount = 0;
for (const g of GUIDE_CATEGORIES) {
  const created = await prisma.guideCategory.upsert({
    where: { id: g.id },
    update: {},
    create: g,
  });
  void created;
  guideCount++;
}

const hasGuide = await prisma.guide.count();
if (!hasGuide) {
  await prisma.guide.createMany({
    data: [
      {
        categoryId: 'gid_freshman',
        title: '新生入学准备清单',
        summary: '录取之后该做什么？一份通用的入学准备清单。',
        content:
          '<h2>一、入学前</h2><p>1. 确认录取通知书与报到时间；2. 办理银行卡并准备学费；3. 提前订好到校车票。</p><h2>二、到校后</h2><p>1. 完成宿舍入住登记；2. 领取校园卡；3. 参加迎新活动。</p>',
        tags: ['新生', '报到', '清单'],
        sort: 1,
        status: 'published',
      },
      {
        categoryId: 'gid_study',
        title: '图书馆使用指南',
        summary: '座位预约、借书流程与开放时间一览。',
        content:
          '<h2>开放时间</h2><p>周一至周日 8:00-22:00。</p><h2>座位预约</h2><p>通过校园 APP 预约，签到后保留 2 小时。</p>',
        tags: ['图书馆', '学习'],
        sort: 1,
        status: 'published',
      },
    ],
  });
  guideCount += 2;
}

console.log(`guide done: ${guideCount} categories, ${hasGuide ? 0 : 2} guides`);
await prisma.$disconnect();
