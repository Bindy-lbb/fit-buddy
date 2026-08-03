# FitBuddy 自托管部署实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 把 FitBuddy 部署到大陆云服务器上：Docker Compose 跑 Postgres + PostgREST + Caddy，先 IP 访问（备案等待期），备案通过后切域名 HTTPS。

**Architecture:** 前端 build 产物 + PostgREST + Postgres 三件套跑在同一台服务器（同源，无 CORS）。Caddy 托管静态文件并反代 `/rest/v1/*`（去前缀）到 PostgREST。前端代码零改动，只换 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`。备案等待期（阶段 1）用 IP+HTTP，备案通过（阶段 2）切域名+HTTPS。

**Tech Stack:** Docker Compose · Postgres 16 · PostgREST v12 · Caddy 2 · Vite（前端不变）

**执行方式说明：** 这是部署到远程服务器的计划，服务器上没有 Node，仓库只在本地。前端 build 在本地做，用 `scp` 把 `deploy/` 目录和构建产物上传到服务器。服务器只需 Docker。所有「SSH」步骤由你登录服务器执行，其余在本地。

---

## 阶段 1：备案等待期，IP 访问跑通

### Task 1: 预检（服务器 + 备案并行）

**Files:** 无（纯信息收集与外部操作）

- [x] **Step 1: 确认服务器可达**

  本地执行：
  ```bash
  ssh root@<服务器IP>
  ```
  期望：能登录，看到 `root@...:~#`。如果第一次连不上，确认服务器已开通、密码/密钥正确、SSH 端口（默认 22）已放行。记下服务器 IP 和操作系统发行版（`cat /etc/os-release` 看名字，计划按 Ubuntu 写，其它发行版命令略不同）。

- [x] **Step 2: 安全组放行端口**

  在云厂商控制台 → 安全组/防火墙，放行入站：**80**（阶段 1 用）和 **443**（阶段 2 用）。

- [ ] **Step 3: 立即启动备案**

  买域名（.com 约 ¥50/年）→ 在云厂商提交个人 ICP 备案 → 填服务器 IP。备案通过前先做阶段 1 的其余任务，不等它。

---

### Task 2: 本地写部署文件

**Files:**
- Create: `deploy/docker-compose.yml`
- Create: `deploy/Caddyfile`
- Create: `deploy/postgres/init/001_roles.sql`
- Create: `deploy/postgres/init/002_schema.sql`
- Create: `deploy/postgres/init/003_grants.sql`
- Create: `deploy/scripts/gen-anon-jwt.mjs`
- Create: `deploy/scripts/backup.sh`
- Create: `deploy/.env.example`
- Modify: `.gitignore`

- [x] **Step 1: 创建目录**

  ```bash
  mkdir -p deploy/postgres/init deploy/scripts
  ```

- [x] **Step 2: 写 `deploy/docker-compose.yml`**

  ```yaml
  services:
    postgres:
      image: postgres:16
      restart: unless-stopped
      environment:
        POSTGRES_DB: fitbuddy
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      volumes:
        - pgdata:/var/lib/postgresql/data
        - ./postgres/init:/docker-entrypoint-initdb.d:ro
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U postgres -d fitbuddy"]
        interval: 5s
        timeout: 5s
        retries: 10
      networks: [app]

    postgrest:
      image: postgrest/postgrest:v12
      restart: unless-stopped
      depends_on:
        postgres:
          condition: service_healthy
      environment:
        PGRST_DB_URI: postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/fitbuddy
        PGRST_DB_SCHEMAS: public
        PGRST_DB_ANON_ROLE: anon
        PGRST_JWT_SECRET: ${JWT_SECRET}
      networks: [app]

    caddy:
      image: caddy:2
      restart: unless-stopped
      depends_on:
        - postgrest
      ports:
        - "80:80"
        - "443:443"
      volumes:
        - ./Caddyfile:/etc/caddy/Caddyfile:ro
        - ./site:/srv/site:ro
        - caddy_data:/data
        - caddy_config:/config
      networks: [app]

  volumes:
    pgdata:
    caddy_data:
    caddy_config:

  networks:
    app:
  ```

- [x] **Step 3: 写 `deploy/Caddyfile`（阶段 1：IP + HTTP 版）**

  ```
  # 阶段 1：等待备案期间用 http://<IP> 访问。
  # 阶段 2 备案通过后，把第一行换成你的域名（见 Task 12）。
  http://:80 {
      root * /srv/site
      encode gzip

      handle /rest/v1/* {
          uri strip_prefix /rest/v1
          reverse_proxy postgrest:3000
      }

      handle {
          file_server
      }
  }
  ```

  > `uri strip_prefix /rest/v1` 是关键：PostgREST 默认在根路径 `/` 提供服务，而 supabase-js 请求的是 `/rest/v1/...`，所以反代前必须去掉前缀。

- [x] **Step 4: 写 `deploy/postgres/init/001_roles.sql`**

  ```sql
  -- 001：角色必须先于建表存在，RLS 策略引用了它们（仅首次初始化时执行）
  create role anon nologin;
  create role authenticated nologin;
  ```

- [x] **Step 5: 复制建表脚本为 `002_schema.sql`**

  ```bash
  cp supabase/schema.sql deploy/postgres/init/002_schema.sql
  ```

- [x] **Step 6: 写 `deploy/postgres/init/003_grants.sql`**

  ```sql
  -- 003：自建 PostgREST 要给 anon/authenticated 授表权限（Supabase 云版默认配好，这里补上）
  grant usage on schema public to anon, authenticated;
  grant select, insert, update, delete on public.groups, public.members, public.checkins, public.weights to anon, authenticated;
  grant select on public.member_progress to anon, authenticated;
  ```

- [x] **Step 7: 写 `deploy/scripts/gen-anon-jwt.mjs`**

  ```js
  // 用法：node scripts/gen-anon-jwt.mjs <jwt-secret> [过期秒数，默认 10 年]
  // 输出：anon JWT，作为 VITE_SUPABASE_ANON_KEY；与 PostgREST 的 PGRST_JWT_SECRET 配套
  import { createHmac } from 'node:crypto'

  const [, , secret = '', expiresIn = String(10 * 365 * 24 * 3600)] = process.argv

  if (!secret) {
    console.error('缺少 jwt-secret 参数：node gen-anon-jwt.mjs <secret>')
    process.exit(1)
  }

  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const header = b64({ alg: 'HS256', typ: 'JWT' })
  const now = Math.floor(Date.now() / 1000)
  const payload = b64({ role: 'anon', iat: now, exp: now + Number(expiresIn) })
  const sig = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url')

  console.log(`${header}.${payload}.${sig}`)
  ```

- [x] **Step 8: 写 `deploy/scripts/backup.sh`**

  ```bash
  #!/usr/bin/env bash
  # 每日备份 fitbuddy 数据库，保留最近 14 份。用法：./scripts/backup.sh（在 deploy/ 下执行）
  set -euo pipefail
  cd "$(dirname "$0")/.."
  mkdir -p backups
  STAMP=$(date +%Y%m%d-%H%M%S)
  docker compose exec -T postgres pg_dump -U postgres -Fc -d fitbuddy > "backups/fitbuddy-$STAMP.dump"
  ls -1t backups/fitbuddy-*.dump 2>/dev/null | tail -n +15 | xargs -r rm --
  echo "backup ok: backups/fitbuddy-$STAMP.dump"
  ```

- [x] **Step 9: 写 `deploy/.env.example`**

  ```
  # 复制成 .env 并填写（.env 已 gitignore，不进仓库）
  # 生成方法见 Task 4
  POSTGRES_PASSWORD=
  JWT_SECRET=
  ```

- [x] **Step 10: 更新 `.gitignore`**

  追加三行（`dist`、`.env.local` 已有）：
  ```
  deploy/.env
  deploy/site/
  deploy/backups/
  ```

- [x] **Step 11: 校验并提交**

  ```bash
  cd "D:/work/projects/fit-buddy"
  docker compose -f deploy/docker-compose.yml config -q   # 本地有 Docker 就校验 YAML，没有则跳过
  git add deploy/ .gitignore
  git commit -m "feat(deploy): add self-hosted docker compose stack"
  ```
  期望：无输出（config 校验通过）；commit 成功。

---

### Task 3: 服务器安装 Docker

**Files:** 无（SSH 上执行）

- [x] **Step 1: SSH 登录服务器**

  ```bash
  ssh root@<服务器IP>
  ```

- [x] **Step 2: 安装 Docker + Compose 插件（Ubuntu/Debian）**

  ```bash
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  apt-get install -y docker-compose-plugin
  ```

- [x] **Step 3: 验证**

  ```bash
  docker --version && docker compose version
  ```
  期望：两行都打印版本号（docker ≥ 24，compose ≥ 2.x）。

---

### Task 4: 本地生成密钥和 anon JWT

**Files:**
- Create: `deploy/.env`（gitignored）

- [x] **Step 1: 生成随机密码和 JWT 密钥**

  ```bash
  cd "D:/work/projects/fit-buddy"
  openssl rand -base64 24   # → 记作 POSTGRES_PASSWORD
  openssl rand -base64 48   # → 记作 JWT_SECRET
  ```

- [x] **Step 2: 写 `deploy/.env`**

  把上一步两个值填进去：
  ```
  POSTGRES_PASSWORD=<上面第一个值>
  JWT_SECRET=<上面第二个值>
  ```

- [x] **Step 3: 生成 anon JWT 并保存到本地一个临时文件备用**

  ```bash
  node deploy/scripts/gen-anon-jwt.mjs "$(grep JWT_SECRET deploy/.env | cut -d= -f2)"
  ```
  期望：打印一行 `eyJ...`。复制这行，稍后 Task 8 作为 `VITE_SUPABASE_ANON_KEY`。可临时存到 `deploy/.anon-key.tmp`（记得删除，或直接留在剪贴板）。

- [x] **Step 4: 验证 JWT 可解码（可选）**

  到 [jwt.io](https://jwt.io) 粘贴，Payload 应看到 `"role": "anon"`。

---

### Task 5: 上传部署目录到服务器

**Files:** 无（本地 → 服务器）

- [x] **Step 1: 建 site 占位目录**

  ```bash
  cd "D:/work/projects/fit-buddy"
  mkdir -p deploy/site
  echo '<h1>fitbuddy site ready</h1>' > deploy/site/index.html
  ```

- [x] **Step 2: scp 上传整个 deploy/ 到服务器**

  ```bash
  scp -r deploy root@<服务器IP>:/opt/fitbuddy/
  ```

- [x] **Step 3: 服务器上确认**

  ```bash
  ssh root@<服务器IP> 'ls -R /opt/fitbuddy | head -40'
  ```
  期望：看到 `docker-compose.yml`、`Caddyfile`、`postgres/init/*.sql`、`scripts/*`、`site/index.html`、`.env`。

---

### Task 6: 起 Postgres 并灌 schema

**Files:** 无（SSH 上执行）

- [x] **Step 1: 启动 postgres（首次启动会执行 init 脚本）**

  ```bash
  cd /opt/fitbuddy
  docker compose up -d postgres
  ```

- [x] **Step 2: 等健康检查通过**

  ```bash
  docker compose ps
  ```
  期望：`postgres ... (healthy)`。若一直 unhealthy，看日志：`docker compose logs postgres`。

- [x] **Step 3: 验证表、角色、视图都在**

  ```bash
  docker compose exec -T postgres psql -U postgres -d fitbuddy -c '\dt' -c '\dv' -c 'select rolname from pg_roles where rolname in (''anon'',''authenticated'');'
  ```
  期望：`\dt` 列出 4 张表（groups/members/checkins/weights），`\dv` 列出 `member_progress`，角色查询返回 `anon` 和 `authenticated` 两行。若表为空，检查 init 日志：`docker compose logs postgres | grep -i error`（最常见：`003_grants.sql` 引用视图时 `002_schema.sql` 未成功）。

---

### Task 7: 起 PostgREST + Caddy

**Files:** 无（SSH 上执行）

- [x] **Step 1: 起全部服务**

  ```bash
  cd /opt/fitbuddy
  docker compose up -d
  ```

- [x] **Step 2: 验证 PostgREST 内部可访问**

  ```bash
  curl -s http://localhost:3000/ -H 'apikey: <anon JWT>' | head -20
  ```
  期望：返回 PostgREST 的 OpenAPI/Swagger JSON（包含 `groups`、`members` 等路径）。若 404/401，看日志 `docker compose logs postgrest`（最常见：JWT_SECRET 与 anon JWT 不匹配，或 grants 没生效）。

- [x] **Step 3: 验证 Caddy 反代链路**

  ```bash
  curl -s http://localhost:80/rest/v1/ -H 'apikey: <anon JWT>' -o /dev/null -w '%{http_code}\n'
  ```
  期望：`200`。此时 site/ 还是占位页，`curl http://localhost:80/` 应返回占位 HTML。

- [x] **Step 4: 从本机试外网 IP**

  本地执行：
  ```bash
  curl -s http://<服务器IP>/rest/v1/ -H 'apikey: <anon JWT>' -o /dev/null -w '%{http_code}\n'
  ```
  期望：`200`（前提：Task 1 安全组放行了 80）。若超时，回云控制台复查安全组。

---

### Task 8: 本地构建前端（IP 版）并上传静态

**Files:**
- Modify: `.env.local`（gitignored）

- [x] **Step 1: 写 `.env.local`**

  ```
  VITE_SUPABASE_URL=http://<服务器IP>
  VITE_SUPABASE_ANON_KEY=<anon JWT>
  ```

- [x] **Step 2: 构建**

  ```bash
  cd "D:/work/projects/fit-buddy"
  npm install
  npm run build
  ```
  期望：`tsc` 和 `vite build` 都通过，产物在 `dist/`。

- [x] **Step 3: 上传构建产物到 site**

  ```bash
  scp -r dist/* root@<服务器IP>:/opt/fitbuddy/site/
  ```

- [x] **Step 4: 验证页面可访问**

  本地执行：
  ```bash
  curl -s http://<服务器IP>/ | head -20
  ```
  期望：返回 index.html 内容（不再是占位页）。浏览器打开 `http://<服务器IP>`（手机模拟 375 宽度）应看到落地页且**没有「演示模式」提示**。

---

### Task 9: 端到端验证 + RLS 冒烟

**Files:** 无

- [x] **Step 1: 用正确邀请码建组**

  本地执行（`<anon JWT>` 替换为真实值）：
  ```bash
  curl -s -X POST http://<服务器IP>/rest/v1/groups \
    -H 'apikey: <anon JWT>' -H 'Authorization: Bearer <anon JWT>' \
    -H 'Content-Type: application/json' -H 'x-group-code: ABC123' -H 'Prefer: return=representation' \
    -d '{"code":"ABC123","name":"测试组","target_days":5,"min_minutes":30}'
  ```
  期望：返回 `201` + 一条含 `"code":"ABC123"` 的 JSON。

- [x] **Step 2: 用错误邀请码查询 → 应为空（RLS 生效）**

  ```bash
  curl -s 'http://<服务器IP>/rest/v1/groups?select=*' \
    -H 'apikey: <anon JWT>' -H 'Authorization: Bearer <anon JWT>' -H 'x-group-code: WRONG9'
  ```
  期望：`[]`。

- [x] **Step 3: 用正确邀请码查询 → 应有 1 条**

  ```bash
  curl -s 'http://<服务器IP>/rest/v1/groups?select=*' \
    -H 'apikey: <anon JWT>' -H 'Authorization: Bearer <anon JWT>' -H 'x-group-code: ABC123'
  ```
  期望：`[{"code":"ABC123",...}]`。这说明 RLS 认请求头、隔离正确。

- [x] **Step 4: 浏览器完整走一遍**

  手机/浏览器开 `http://<服务器IP>`：建组 → 添加自己 → 打卡 → 看打卡墙印章 → 切回来能刷新。确认顶部无「演示模式」。
  > 注：此时是 HTTP + IP，微信内置浏览器会提示不安全——这是阶段 1 预期内，正式发链接等阶段 2。

---

### Task 10: 配置每日备份

**Files:** 无（SSH 上执行）

- [x] **Step 1: 让脚本可执行并试跑一次**

  ```bash
  cd /opt/fitbuddy
  chmod +x scripts/backup.sh
  ./scripts/backup.sh
  ls -l backups/
  ```
  期望：打印 `backup ok: ...`，`backups/` 下出现一个 `.dump` 文件。

- [x] **Step 2: 加入 cron（每天凌晨 3 点）**

  ```bash
  crontab -e
  ```
  追加一行：
  ```
  0 3 * * * cd /opt/fitbuddy && ./scripts/backup.sh >> backups/backup.log 2>&1
  ```

- [x] **Step 3: 验证 cron 已装**

  ```bash
  crontab -l | grep backup
  ```
  期望：打印那行 cron。

---

## 阶段 2：备案通过，切域名 HTTPS

### Task 11: 切域名 + HTTPS

**Files:** 无（SSH 上执行，需备案已通过）

- [ ] **Step 1: 域名解析到服务器**

  在域名控制台添加 A 记录：`@` 和 `www` → 服务器 IP。等生效（`dig <域名>` 或 `ping <域名>` 能看到 IP）。

- [ ] **Step 2: 改 Caddyfile 为域名版**

  编辑 `/opt/fitbuddy/Caddyfile`，把第一行 `http://:80 {` 换成：
  ```
  <你的域名> {
  ```
  （删掉原 `http://:80` 那行的其余部分即可，文件其余内容不变。）

- [ ] **Step 3: 重载 Caddy 让它自动签证书**

  ```bash
  cd /opt/fitbuddy
  docker compose restart caddy
  docker compose logs --tail=20 caddy
  ```
  期望：日志出现 `certificate obtained successfully` 或 `server started`。首次签发约 10–60 秒。

- [ ] **Step 4: 验证 HTTPS**

  本地执行：
  ```bash
  curl -sI https://<域名> | head -5
  ```
  期望：`HTTP/2 200`，且证书有效（无自签名警告）。

---

### Task 12: 重新构建前端（域名版）并上传

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: 改 `.env.local`**

  ```
  VITE_SUPABASE_URL=https://<域名>
  VITE_SUPABASE_ANON_KEY=<anon JWT>
  ```

- [ ] **Step 2: 重新构建并上传**

  ```bash
  cd "D:/work/projects/fit-buddy"
  npm run build
  scp -r dist/* root@<服务器IP>:/opt/fitbuddy/site/
  ```

- [ ] **Step 3: 端到端验证**

  - `curl -sI https://<域名>` → 200
  - `curl -s 'https://<域名>/rest/v1/groups?select=*' -H 'apikey: <anon JWT>' -H 'Authorization: Bearer <anon JWT>' -H 'x-group-code: ABC123'` → 有数据
  - 手机微信打开 `https://<域名>/g/ABC123` 深链接 → 无安全提示，打卡墙正常。

---

### Task 13: 收尾文档

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture.md`

- [ ] **Step 1: 更新 README 的部署章节**

  把「部署（拿到能发群里的链接）」一节改为指向新方案：域名、服务器、`docker compose up -d`、构建上传步骤。删除 Vercel 相关步骤。

- [ ] **Step 2: 更新架构文档「一句话架构」**

  `docs/architecture.md` 第 8 行「没有自己的服务器」已不成立，改成：
  ```
  一个纯静态前端 + Postgres/PostgREST，自托管在云服务器上。
  ```

- [ ] **Step 3: 提交**

  ```bash
  cd "D:/work/projects/fit-buddy"
  git add README.md docs/architecture.md
  git commit -m "docs: reflect self-hosted deployment"
  ```

---

## Self-Review

**Spec coverage（对 docs/deployment.md）：**
- 三件套 + 同源 + 前端零改动 → Task 2/7/8 ✅
- schema.sql 复用 + grants 补丁 → Task 2 (002/003) / Task 6 ✅
- anon JWT 自签 → Task 4 ✅
- 阶段 1 IP / 阶段 2 域名 HTTPS → Task 8/11/12 ✅
- 每日备份 → Task 10 ✅
- 不做：完整 Supabase / Node 重写 / 香港机器 / 数据迁移 → 计划中未引入 ✅

**Placeholder scan：** `<服务器IP>`、`<anon JWT>`、`<你的域名>` 是运行时值（执行者提供），非计划缺项；均已标注「替换为真实值」。

**Type/名一致：** `.env` 键名（`POSTGRES_PASSWORD`/`JWT_SECRET`）在 compose、.env.example、Task 4、脚本中一致；`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` 与前端 `db.ts` 读取一致。
