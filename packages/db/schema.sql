-- ============================================================
-- CampusHub v2 · Supabase 数据模型（唯一事实源）
-- 在 Supabase 控制台 → SQL Editor 依次执行：schema.sql → seed.sql
-- 设计原则（吸取 v1 教训）：
--   1. 不冗余计数：点赞/评论/收藏数由触发器按 count() 维护，删除"对账 cron"
--   2. 原生全文/模糊检索：pg_trgm + GIN 索引，删除"正则全表扫描"
--   3. 无补丁表：不要 idempotency / rate_limits / view_logs
--   4. RLS 行级安全：公开读 + 本人写 + 管理员全权，安全逻辑在数据库层
--   5. 通用模板：所有数据不绑定任何具体学校
-- ============================================================

create extension if not exists pg_trgm;

-- ============================================================
-- 1. 用户资料（关联 Supabase Auth）
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '',
  avatar text not null default '',
  bio text not null default '',
  college text not null default '',
  major text not null default '',
  grade text not null default '',
  gender smallint not null default 0,          -- 0 未知 / 1 男 / 2 女
  tags text[] not null default '{}',
  points integer not null default 0,            -- 积分（签到等）
  checkin_streak integer not null default 0,    -- 连续签到天数
  last_checkin_date date,
  is_admin boolean not null default false,      -- 管理员（控制台直接改或 Edge Function 授权）
  is_banned boolean not null default false,     -- 封禁
  created_at timestamptz not null default now()
);
comment on table public.profiles is '用户资料，id 关联 auth.users';

-- 新用户注册自动建 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'nickname', ''), '同学' || substr(new.id::text, 1, 6)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 2. 内容分类（校园场景式，二级足够）
-- ============================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  emoji text not null default '',
  sort integer not null default 0,
  status text not null default 'active',        -- active / hidden
  created_at timestamptz not null default now()
);
create index if not exists idx_categories_parent on public.categories(parent_id);

-- ============================================================
-- 3. 帖子（信息/任务/失物/招领/表白）
-- ============================================================
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  kind text not null default 'post',            -- post / task / lost / found / confession
  title text not null,
  content text not null default '',
  images text[] not null default '{}',          -- 云存储 URL
  tags text[] not null default '{}',
  location text not null default '',            -- 失物/招领地点
  is_anonymous boolean not null default false,
  expire_at timestamptz,                        -- 任务帖过期时间
  resolved boolean not null default false,      -- 失物/招领/任务 已解决
  status text not null default 'normal',        -- normal / expired / deleted
  is_pinned boolean not null default false,     -- 置顶
  is_essence boolean not null default false,    -- 精华
  like_count integer not null default 0,
  comment_count integer not null default 0,
  collect_count integer not null default 0,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 中文检索：pg_trgm 模糊匹配索引（覆盖标题/正文）
create index if not exists idx_posts_title_trgm on public.posts using gin (title gin_trgm_ops);
create index if not exists idx_posts_content_trgm on public.posts using gin (content gin_trgm_ops);
create index if not exists idx_posts_feed on public.posts(status, is_pinned desc, created_at desc);
create index if not exists idx_posts_category on public.posts(category_id, created_at desc);
create index if not exists idx_posts_author on public.posts(author_id, created_at desc);

-- ============================================================
-- 4. 二手商品
-- ============================================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  title text not null,
  description text not null default '',
  images text[] not null default '{}',
  price numeric(10,2) not null check (price >= 0),
  original_price numeric(10,2) check (original_price is null or original_price >= 0),
  condition text not null default 'good',       -- 全新/几乎全新/良好/一般/损坏
  trade_type text not null default 'face',      -- face 当面 / mail 邮寄 / both
  location text not null default '',            -- 交易地点
  contact_info text not null default '',        -- 联系方式
  status text not null default 'on_sale',       -- on_sale / sold / off_shelf / deleted
  like_count integer not null default 0,
  comment_count integer not null default 0,
  collect_count integer not null default 0,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_products_title_trgm on public.products using gin (title gin_trgm_ops);
create index if not exists idx_products_feed on public.products(status, created_at desc);
create index if not exists idx_products_category on public.products(category_id, created_at desc);
create index if not exists idx_products_seller on public.products(seller_id, created_at desc);

-- ============================================================
-- 5. 评论（多态：帖子/商品）
-- ============================================================
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'product')),
  target_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete set null,  -- 回复的楼层
  reply_to_user_id uuid references public.profiles(id) on delete set null,
  content text not null,
  status text not null default 'normal',        -- normal / deleted
  like_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_comments_target on public.comments(target_type, target_id, created_at);
create index if not exists idx_comments_parent on public.comments(parent_id);

-- ============================================================
-- 6. 点赞 / 收藏（多态，唯一约束天然幂等）
-- ============================================================
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'product', 'comment')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);
create index if not exists idx_likes_target on public.likes(target_type, target_id);

create table if not exists public.collects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'product')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);
create index if not exists idx_collects_target on public.collects(target_type, target_id);

-- ============================================================
-- 7. 关注
-- ============================================================
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists idx_follows_following on public.follows(following_id);

-- ============================================================
-- 8. 签到
-- ============================================================
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  streak integer not null default 1,
  points integer not null default 1,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ============================================================
-- 9. 通知
-- ============================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,  -- 接收者
  type text not null,                            -- like / comment / follow / system / report_result
  target_type text not null default '',
  target_id uuid,
  actor_id uuid,                                 -- 触发者
  content text not null default '',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, is_read, created_at desc);

-- ============================================================
-- 10. 举报 / 反馈
-- ============================================================
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'product', 'comment', 'user')),
  target_id uuid not null,
  reason text not null,
  detail text not null default '',
  status text not null default 'pending',        -- pending / handled / dismissed
  handled_by uuid references public.profiles(id),
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_reports_status on public.reports(status, created_at);

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  contact text not null default '',
  status text not null default 'pending',        -- pending / done
  created_at timestamptz not null default now()
);

-- ============================================================
-- 11. 公告 / 指南
-- ============================================================
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null default '',
  is_pinned boolean not null default false,
  status text not null default 'active',         -- active / inactive
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.guide_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null default '',
  sort integer not null default 0
);

create table if not exists public.guides (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.guide_categories(id) on delete set null,
  title text not null,
  summary text not null default '',
  content text not null default '',              -- HTML 富文本（前端用 vditor/wangEditor 渲染）
  cover_image text not null default '',
  tags text[] not null default '{}',
  view_count integer not null default 0,
  status text not null default 'published',      -- published / draft
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_guides_status on public.guides(status, sort, created_at desc);

-- ============================================================
-- 12. 积分订单 / 管理日志
-- ============================================================
create table if not exists public.points_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item text not null,                            -- 兑换物品（如改名卡）
  cost integer not null check (cost > 0),
  status text not null default 'done',           -- done / refunded
  created_at timestamptz not null default now()
);

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id),
  action text not null,                          -- 如 ban_user / resolve_report / pin_post
  target_type text not null default '',
  target_id uuid,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_logs_created on public.admin_logs(created_at desc);

-- ============================================================
-- 13. 计数维护触发器（取代 v1 的"冗余计数 + 对账 cron"）
-- ============================================================

-- 点赞数
create or replace function public.sync_like_count()
returns trigger language plpgsql security definer set search_path = public
as $$
declare t text; tid uuid;
begin
  t := coalesce(new.target_type, old.target_type);
  tid := coalesce(new.target_id, old.target_id);
  if t = 'comment' then
    update public.comments set like_count = (select count(*) from public.likes where target_type='comment' and target_id=tid)
      where id = tid;
  elsif t = 'post' then
    update public.posts set like_count = (select count(*) from public.likes where target_type='post' and target_id=tid)
      where id = tid;
  elsif t = 'product' then
    update public.products set like_count = (select count(*) from public.likes where target_type='product' and target_id=tid)
      where id = tid;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_likes_sync on public.likes;
create trigger trg_likes_sync after insert or delete on public.likes
  for each row execute procedure public.sync_like_count();

-- 收藏数
create or replace function public.sync_collect_count()
returns trigger language plpgsql security definer set search_path = public
as $$
declare t text; tid uuid;
begin
  t := coalesce(new.target_type, old.target_type);
  tid := coalesce(new.target_id, old.target_id);
  if t = 'post' then
    update public.posts set collect_count = (select count(*) from public.collects where target_type='post' and target_id=tid)
      where id = tid;
  elsif t = 'product' then
    update public.products set collect_count = (select count(*) from public.collects where target_type='product' and target_id=tid)
      where id = tid;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_collects_sync on public.collects;
create trigger trg_collects_sync after insert or delete on public.collects
  for each row execute procedure public.sync_collect_count();

-- 评论数（软删时也回退）
create or replace function public.sync_comment_count()
returns trigger language plpgsql security definer set search_path = public
as $$
declare t text; tid uuid;
begin
  t := coalesce(new.target_type, old.target_type);
  tid := coalesce(new.target_id, old.target_id);
  if t = 'post' then
    update public.posts set comment_count = (select count(*) from public.comments where target_type='post' and target_id=tid and status='normal')
      where id = tid;
  elsif t = 'product' then
    update public.products set comment_count = (select count(*) from public.comments where target_type='product' and target_id=tid and status='normal')
      where id = tid;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_comments_sync on public.comments;
create trigger trg_comments_sync after insert or update of status or delete on public.comments
  for each row execute procedure public.sync_comment_count();

-- 浏览量（详情页调用 RPC，不做按人去重；脚本刷量由 Supabase 网关层限频兜底）
create or replace function public.incr_view(t_type text, t_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if t_type = 'post' then
    update public.posts set view_count = view_count + 1 where id = t_id;
  elsif t_type = 'product' then
    update public.products set view_count = view_count + 1 where id = t_id;
  elsif t_type = 'guide' then
    update public.guides set view_count = view_count + 1 where id = t_id;
  end if;
end;
$$;

-- ============================================================
-- 14. 行级安全（RLS）——公开读 / 本人写 / 管理员全权
-- ============================================================
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.products enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.collects enable row level security;
alter table public.follows enable row level security;
alter table public.checkins enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.feedbacks enable row level security;
alter table public.announcements enable row level security;
alter table public.guides enable row level security;
alter table public.guide_categories enable row level security;
alter table public.points_orders enable row level security;
alter table public.admin_logs enable row level security;

-- 管理员判定（RLS 内复用）
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- profiles
create policy profiles_select on public.profiles for select using (true);                       -- 公开可见
create policy profiles_insert on public.profiles for insert with check (auth.uid() = id);       -- 仅注册回调（service role）
create policy profiles_update on public.profiles for update using (auth.uid() = id or public.is_admin());
create policy profiles_delete on public.profiles for delete using (public.is_admin());

-- posts：公开读（排除 deleted），登录可发，作者/管理员可改可删
create policy posts_select on public.posts for select using (status <> 'deleted');
create policy posts_insert on public.posts for insert with check (auth.uid() = author_id);
create policy posts_update on public.posts for update using (auth.uid() = author_id or public.is_admin());
create policy posts_delete on public.posts for delete using (auth.uid() = author_id or public.is_admin());

-- products
create policy products_select on public.products for select using (status <> 'deleted');
create policy products_insert on public.products for insert with check (auth.uid() = seller_id);
create policy products_update on public.products for update using (auth.uid() = seller_id or public.is_admin());
create policy products_delete on public.products for delete using (auth.uid() = seller_id or public.is_admin());

-- comments
create policy comments_select on public.comments for select using (status = 'normal');
create policy comments_insert on public.comments for insert with check (auth.uid() = user_id);
create policy comments_update on public.comments for update using (auth.uid() = user_id or public.is_admin());
create policy comments_delete on public.comments for delete using (auth.uid() = user_id or public.is_admin());

-- likes / collects：本人管理
create policy likes_select on public.likes for select using (auth.uid() = user_id);
create policy likes_insert on public.likes for insert with check (auth.uid() = user_id);
create policy likes_delete on public.likes for delete using (auth.uid() = user_id);

create policy collects_select on public.collects for select using (auth.uid() = user_id);
create policy collects_insert on public.collects for insert with check (auth.uid() = user_id);
create policy collects_delete on public.collects for delete using (auth.uid() = user_id);

-- follows：本人管理；following 列表公开（粉丝数展示）
create policy follows_select_own on public.follows for select using (auth.uid() = follower_id or auth.uid() = following_id or public.is_admin());
create policy follows_insert on public.follows for insert with check (auth.uid() = follower_id);
create policy follows_delete on public.follows for delete using (auth.uid() = follower_id);

-- checkins：本人
create policy checkins_select on public.checkins for select using (auth.uid() = user_id);
create policy checkins_insert on public.checkins for insert with check (auth.uid() = user_id);

-- notifications：本人
create policy notifications_select on public.notifications for select using (auth.uid() = user_id);
create policy notifications_update on public.notifications for update using (auth.uid() = user_id);

-- reports：本人提交，本人/管理员查看
create policy reports_select on public.reports for select using (auth.uid() = reporter_id or public.is_admin());
create policy reports_insert on public.reports for insert with check (auth.uid() = reporter_id);
create policy reports_update on public.reports for update using (public.is_admin());

-- feedbacks
create policy feedbacks_select on public.feedbacks for select using (auth.uid() = user_id or public.is_admin());
create policy feedbacks_insert on public.feedbacks for insert with check (auth.uid() = user_id);
create policy feedbacks_update on public.feedbacks for update using (public.is_admin());

-- announcements：公开读，管理员写
create policy announcements_select on public.announcements for select using (status = 'active');
create policy announcements_insert on public.announcements for insert with check (public.is_admin());
create policy announcements_update on public.announcements for update using (public.is_admin());
create policy announcements_delete on public.announcements for delete using (public.is_admin());

-- guides / guide_categories
create policy guides_select on public.guides for select using (status = 'published');
create policy guides_insert on public.guides for insert with check (public.is_admin());
create policy guides_update on public.guides for update using (public.is_admin());
create policy guides_delete on public.guides for delete using (public.is_admin());

create policy guide_categories_select on public.guide_categories for select using (true);
create policy guide_categories_insert on public.guide_categories for insert with check (public.is_admin());
create policy guide_categories_update on public.guide_categories for update using (public.is_admin());
create policy guide_categories_delete on public.guide_categories for delete using (public.is_admin());

-- points_orders：本人
create policy points_orders_select on public.points_orders for select using (auth.uid() = user_id or public.is_admin());
create policy points_orders_insert on public.points_orders for insert with check (auth.uid() = user_id);

-- admin_logs：管理员
create policy admin_logs_select on public.admin_logs for select using (public.is_admin());
create policy admin_logs_insert on public.admin_logs for insert with check (public.is_admin());

-- ============================================================
-- 15. 签到逻辑（服务端函数，原子防重）
-- ============================================================
create or replace function public.checkin()
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Shanghai')::date;
  yesterday date := (now() at time zone 'Asia/Shanghai')::date - 1;
  new_streak integer;
  points integer;
begin
  if uid is null then raise exception 'NOT_LOGGED_IN'; end if;
  if exists (select 1 from public.checkins where user_id = uid and date = today) then
    raise exception 'ALREADY_CHECKED_IN';
  end if;

  select case when last_checkin_date = yesterday then checkin_streak + 1 else 1 end
  into new_streak
  from public.profiles where id = uid;

  points := 1 + floor(new_streak / 7)::int * 5;

  insert into public.checkins (user_id, date, streak, points) values (uid, today, new_streak, points);
  update public.profiles
     set checkin_streak = new_streak,
         last_checkin_date = today,
         points = points + points
   where id = uid;

  return jsonb_build_object('date', today, 'streak', new_streak, 'points', points);
end;
$$;
