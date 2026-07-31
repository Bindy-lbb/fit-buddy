-- FitBuddy 建表脚本
-- 用法：Supabase 控制台 → SQL Editor → 粘贴全文 → Run（可重复执行）
--
-- 权限模型：本项目没有账号体系，小组邀请码本身就是凭证。
-- 前端每个请求都带 x-group-code 请求头，RLS 只放行「请求头里的码所对应的那个小组」的数据。
-- 因此拿到 anon key 也无法遍历其他小组，除非知道对方的 6 位邀请码。

-- ---------- 表 ----------

create table if not exists public.groups (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name         text not null,
  target_days  int  not null default 5,   -- 每周目标打卡天数
  min_minutes  int  not null default 30,  -- 单次最低分钟数，0 = 不限
  created_at   timestamptz not null default now()
);

create table if not exists public.members (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups(id) on delete cascade,
  name          text not null,
  emoji         text not null default '🐣',
  start_weight  numeric(5,1),
  target_weight numeric(5,1),
  show_weight   boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.checkins (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members(id) on delete cascade,
  date       date not null,
  exercise   text,
  minutes    int,
  note       text,
  is_makeup  boolean not null default false,
  created_at timestamptz not null default now(),
  unique (member_id, date)
);

create table if not exists public.weights (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members(id) on delete cascade,
  date       date not null,
  kg         numeric(5,1) not null,
  created_at timestamptz not null default now(),
  unique (member_id, date)
);

create index if not exists members_group_idx  on public.members(group_id);
create index if not exists checkins_member_idx on public.checkins(member_id, date desc);
create index if not exists weights_member_idx  on public.weights(member_id, date desc);

-- ---------- 请求头取小组码 ----------

create or replace function public.request_group_code()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.headers', true)::json ->> 'x-group-code', '')
$$;

create or replace function public.request_group_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select g.id from public.groups g where g.code = public.request_group_code()
$$;

-- ---------- RLS ----------

alter table public.groups   enable row level security;
alter table public.members  enable row level security;
alter table public.checkins enable row level security;
alter table public.weights  enable row level security;

drop policy if exists groups_rw   on public.groups;
drop policy if exists members_rw  on public.members;
drop policy if exists checkins_rw on public.checkins;
drop policy if exists weights_rw  on public.weights;

-- 小组：只能读写请求头里那个码对应的小组；建组时前端先带上自己生成的码
create policy groups_rw on public.groups
  for all to anon, authenticated
  using (code = public.request_group_code())
  with check (code = public.request_group_code());

create policy members_rw on public.members
  for all to anon, authenticated
  using (group_id = public.request_group_id())
  with check (group_id = public.request_group_id());

create policy checkins_rw on public.checkins
  for all to anon, authenticated
  using (member_id in (select id from public.members where group_id = public.request_group_id()))
  with check (member_id in (select id from public.members where group_id = public.request_group_id()));

create policy weights_rw on public.weights
  for all to anon, authenticated
  using (member_id in (select id from public.members where group_id = public.request_group_id()))
  with check (member_id in (select id from public.members where group_id = public.request_group_id()));

-- ---------- 进度视图 ----------
-- 排行榜只需要减重百分比。让绝对体重留在数据库里：
-- 未勾选「公开体重」的成员，latest_kg 返回 null，前端拿不到别人的体重数字。
-- security_invoker = on 让视图沿用上面的 RLS，不会绕过小组隔离。

drop view if exists public.member_progress;
create view public.member_progress with (security_invoker = on) as
select
  m.id       as member_id,
  m.group_id as group_id,
  case when m.show_weight then w.kg end as latest_kg,
  case
    when m.start_weight is not null and m.start_weight > 0 and w.kg is not null
    then round((m.start_weight - w.kg) / m.start_weight * 100, 1)
  end        as loss_pct,
  w.date     as latest_date
from public.members m
left join lateral (
  select kg, date from public.weights
  where member_id = m.id
  order by date desc
  limit 1
) w on true;

grant select on public.member_progress to anon, authenticated;
