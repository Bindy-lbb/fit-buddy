-- 003：自建 PostgREST 要给 anon/authenticated 授表权限（Supabase 云版默认配好，这里补上）
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.groups, public.members, public.checkins, public.weights to anon, authenticated;
grant select on public.member_progress to anon, authenticated;
