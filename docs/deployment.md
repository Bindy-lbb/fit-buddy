# FitBuddy 部署技术方案（V1）

> 状态：待确认 · 最后更新 2026-08-02
> 目的：记录「有服务器之后怎么部署」的技术选型，作为后续实施计划的依据。

## 1. 一句话结论

已购**大陆云服务器**，用 **Docker Compose 跑 Postgres + PostgREST + Caddy** 三件套，前端代码**零改动**。先直接用 IP 访问搭起来，等 **ICP 备案**通过后绑域名切 HTTPS 上线。

## 2. 为什么这么选

- **不用改前端。** 前端只用到了 PostgREST 的 REST 接口 + RLS（`db.ts` 里没有任何 Auth/Storage/Realtime 调用），自建 PostgREST 就是原样复刻 Supabase 暴露的那一层，`VITE_SUPABASE_URL` 一改即可。
- **不用跑完整 Supabase。** 自托管 Supabase 要 15+ 个容器，这项目只用到 PostgREST 一层，跑三件套轻一个数量级。
- **复用已有资产。** `supabase/schema.sql`（含 RLS 和隐私视图）直接复用，22 个统计单测不变，权限模型不重写。
- **没有存量数据。** Supabase 云库可丢弃，无需迁移。
- **备案等待期不浪费。** 服务器可以先在 IP 上把整套系统搭好、测通，备案一过只差绑域名一步。

## 3. 架构

```
微信/浏览器
   │  HTTPS 域名（备案后）/ IP（等待期）
   ▼
Caddy ──► 静态产物（dist/，前端页面）
   │  /rest/v1 反代
   ▼
PostgREST ──► Postgres（RLS + member_progress 视图）
```

前端和 API **同源**（同一个域名/IP），无 CORS、一张证书，`vercel.json` 的 SPA 重写不再需要（HashRouter + 相对 `base` 在任意静态托管下深链接都不 404）。

## 4. 技术栈清单

| 组件 | 选型 | 说明 |
|---|---|---|
| 服务器 | 已购大陆云服务器 | 2C2G 足够，4 张表几个人的量 |
| 容器编排 | Docker Compose | 一键起三件套，升级/备份都好办 |
| Web 服务器 | Caddy | 托管静态 + 反代 PostgREST + 自动 HTTPS（备案后） |
| API | PostgREST | 单二进制，连 Postgres，暴露 `/rest/v1` |
| 数据库 | Postgres 16 | 跑在容器里，备份 = `pg_dump` |
| 前端 | 不变（Vite + React） | 只改两个环境变量重新 build |

## 5. 分阶段实施

### 阶段 0：备案（立即开始，不阻塞搭系统）

1. 买域名（.com 几十块/年，如 `fitbuddy.example`）。
2. 提交**个人 ICP 备案**（免费，2–3 周，一次拍照核验）。
3. 备案材料里要填服务器 IP，先确认服务器已开通。

### 阶段 1：等待期，服务器上搭系统（IP 访问）

在服务器上完成全部搭建，通过 `http://服务器IP` 访问验证：

1. 服务器装 Docker + Compose 插件。
2. 写 `docker-compose.yml`：postgres / postgrest / caddy 三个服务。
3. 写 `Caddyfile`：阶段 1 监听 `:80`，托管静态 + 反代 `/rest/v1`。
4. 建库：跑 `supabase/schema.sql` + 一段补丁脚本（创建 `anon`/`authenticated` 角色、授表权限）。
5. 生成 anon JWT（`{"role":"anon"}` 签名后作为 `VITE_SUPABASE_ANON_KEY`）。
6. 前端 build：`VITE_SUPABASE_URL=http://服务器IP`，产物丢给 Caddy。
7. 配 cron 每日 `pg_dump` 备份。

> 注意：等待期用 IP + HTTP 访问，微信内置浏览器会对 HTTP 有安全提示——这是预期内的，阶段 1 只是搭好测通，正式发链接在阶段 2。若个别云厂商对未备案 IP 的 80 端口有拦截，可临时换非标准端口。

### 阶段 2：备案通过，切域名（上线）

1. 域名解析（A 记录）指向服务器 IP。
2. `Caddyfile` 改成 `域名`，Caddy 自动签发 HTTPS 证书。
3. 前端用 `VITE_SUPABASE_URL=https://域名` 重新 build。
4. 验证微信内打开、深链接、打卡全流程。

## 6. 需要新买 / 新配的东西

| 东西 | 说明 |
|---|---|
| 域名 | 一次性，¥50/年 |
| anon JWT | 自签，代替 Supabase 发的 anon key |
| schema 补丁脚本 | 创建角色 + 授表权限（云版默认配好，自建要加） |
| Caddyfile / docker-compose.yml | 本次实施要写的两个文件 |

## 7. 明确不做的事

- **不**跑完整 Supabase 自托管（15+ 容器，用不上）。
- **不**重写数据层为 Node + SQLite（动核心数据通路，有回归风险，省的那点运维不值得）。
- **不**迁移数据（无存量）。
- **不**买香港服务器（等得起备案，不养闲置机器）。

## 8. 待确认项

- 域名具体买哪个（不阻塞，阶段 0 才需要）。
- 服务器操作系统发行版（Ubuntu/Debian，影响 Docker 安装命令，阶段 1 才需要）。
- 服务器安全组是否已放行 80 端口（阶段 1 前确认）。
