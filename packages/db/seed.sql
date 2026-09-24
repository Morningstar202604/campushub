-- ============================================================
-- CampusHub v2 · 种子数据（通用模板，不绑定任何学校）
-- 部署后可到管理后台自由增删改分类/公告/指南
-- ============================================================

-- 1. 内容分类（校园场景式二级，覆盖社区全部内容类型）
insert into public.categories (id, parent_id, name, emoji, sort) values
  ('cat_idle',     null, '二手闲置', '🛒', 1),
  ('cat_lost',     null, '失物招领', '🔍', 2),
  ('cat_confess',  null, '表白墙',   '💌', 3),
  ('cat_course',   null, '课程学习', '📚', 4),
  ('cat_activity', null, '校园活动', '🎉', 5),
  ('cat_parttime', null, '兼职互助', '💼', 6),
  ('cat_carpool',  null, '拼车拼单', '🚗', 7),
  ('cat_chat',     null, '闲聊水区', '💬', 8)
on conflict (id) do nothing;

-- 2. 指南分类
insert into public.guide_categories (id, name, icon, sort) values
  ('gid_freshman', '新生入学', '🎓', 1),
  ('gid_life',     '生活服务', '🏠', 2),
  ('gid_study',    '学习攻略', '📝', 3),
  ('gid_traffic',  '交通出行', '🚌', 4),
  ('gid_food',     '美食地图', '🍜', 5),
  ('gid_play',     '周边玩乐', '🎮', 6)
on conflict (id) do nothing;

-- 3. 示例指南（通用内容，学校部署后请在管理后台替换为真实内容）
insert into public.guides (category_id, title, summary, content, tags, sort, status) values
  ('gid_freshman', '新生入学准备清单（示例）',
   '录取之后该做什么？一份通用的入学准备清单。',
   '## 一、入学前

1. 仔细阅读录取通知书及附带材料
2. 关注学校官方公众号，认准官方群
3. 准备证件照（1寸、2寸各若干）

## 二、报到时

1. 录取通知书、身份证原件
2. 团组织关系转接证明
3. 按通知到指定地点办理入住

## 三、开学后

多参加社团招新和校园活动，尽快熟悉校园地图。',
   array['新生','入学','攻略'], 1, 'published'),
  ('gid_life', '宿舍生活小贴士（示例）',
   '宿舍相处、用电安全、报修流程通用指南。',
   '## 宿舍常识

1. 了解门禁时间，避免晚归
2. 大功率电器多为违禁品，注意用电安全
3. 水电报修找宿管或后勤报修平台

## 室友相处

提前商量作息与卫生分工，矛盾及时沟通。',
   array['宿舍','生活'], 2, 'published'),
  ('gid_traffic', '高铁/机场出行指南（示例）',
   '从高铁站、机场到学校的通用路线说明。',
   '## 高铁出行

出站后可选择公交、地铁或网约车前往学校，建议提前查好末班车时间。

## 机场出行

机场距离市区较远，建议预留足够时间，多人可拼车。',
   array['交通','出行'], 3, 'published')
on conflict do nothing;

-- 4. 欢迎公告
insert into public.announcements (title, content, is_pinned, status, created_at) values
  ('欢迎来到校园社区', '这里是同学们自己的交流社区：二手闲置、失物招领、课程学习、校园活动都能在这找到。请文明发言，友善交流。', true, 'active', now())
on conflict do nothing;
