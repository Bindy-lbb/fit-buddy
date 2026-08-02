-- 001：角色必须先于建表存在，RLS 策略引用了它们（仅首次初始化时执行）
create role anon nologin;
create role authenticated nologin;
