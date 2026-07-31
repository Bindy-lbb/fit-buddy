# 打卡墙 · FitBuddy

几个朋友互相看着彼此的减肥运动打卡。不用注册，链接发进群就能开始。

## 文档

| 想知道什么 | 看哪份 |
|---|---|
| 怎么装、怎么部署 | 本文件 |
| 怎么用（给朋友们看的） | [docs/usage.md](docs/usage.md) |
| 技术方案、代码怎么组织的 | [docs/architecture.md](docs/architecture.md) |
| 产品要解决什么问题、为什么这么设计 | [docs/requirements.md](docs/requirements.md) |
| 改代码前的约束 | [CLAUDE.md](CLAUDE.md) |

## 现在就能跑（演示模式）

```bash
npm install
```

```bash
npm run dev
```

打开 http://127.0.0.1:5180 就能建组打卡。此时是**演示模式**：数据只存在这台设备的浏览器里，自动放了三位示例成员，用来看界面和体验流程。朋友之间还看不到彼此。

界面是按手机做的，电脑上看请开浏览器的移动端模拟（F12 → 切换设备工具栏），宽度选 375。

## 接上 Supabase（多人共享的必要一步）

「互相监督」要求数据共享，所以必须有一个后端。用 Supabase 免费版，大约 5 分钟：

1. 到 [supabase.com](https://supabase.com) 建一个免费项目（区域选 Singapore 或 Tokyo，国内访问快些）。
2. 左侧 **SQL Editor** → 新建查询 → 把 [supabase/schema.sql](supabase/schema.sql) 全文粘进去 → Run。脚本可重复执行。
3. 左侧 **Settings → API**，复制 `Project URL` 和 `anon public` 两个值。
4. 在项目根目录创建 `.env.local`：

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

5. 重启 `npm run dev`。顶部的「演示模式」提示消失，就是接上了。

## 部署（拿到能发群里的链接）

```bash
npm i -g vercel
vercel
```

首次会问项目名，一路回车即可。然后在 Vercel 项目的 **Settings → Environment Variables** 里加上和 `.env.local` 相同的两个变量，重新部署一次。

`vercel.json` 已配好 SPA 重写规则，`/g/ABC234` 这类深链接直接打开不会 404。

## 国内访问

**Vercel + Supabase 这套在国内基本不可用**：`vercel.app` 域名被污染，自定义域名走 Vercel 的 CDN 节点国内也连不上；`supabase.co` 时通时不通。给国内朋友用必须换。

字体依赖已经处理掉了（`@fontsource` 自托管，构建产物零外部请求），剩下静态托管和数据库两件事：

| 方案 | 改多少代码 | 多久能用 | 每月成本 | 适合 |
|---|---|---|---|---|
| **香港轻量服务器自建**<br>Caddy 托管静态 + 反代 PostgREST | 只换一个环境变量 | 当天 | ¥25–60 | 想马上用起来 |
| **国内云 + ICP 备案**<br>COS/OSS + CDN + 云数据库 | 只换一个环境变量 | 2–3 周（等备案） | ¥10–30 | 长期最稳最快 |
| **微信小程序 + 云开发** | 前端重写 + 数据层重写 | 数周 | 基本免费额度内 | 想要微信原生入口 |

推荐**香港自建**：Supabase 是开源的，自己跑一份，前端一行代码不用改，只把 `VITE_SUPABASE_URL` 指过去。香港到内地延迟 30–80ms，对打卡这种操作完全够。免备案意味着今天就能发链接进群。

愿意等备案的话，国内节点长期体验更好，成本反而更低 —— 备案本身免费，只是要 2–3 周和一次拍照核验。

小程序现在同样需要备案，还要多付出一次重写和审核，为几个人的小组不划算。

> 无论哪种方案，链接都要走 **HTTPS**：微信内置浏览器对 HTTP 页面有不安全提示。

## 权限模型

没有账号体系，**小组邀请码就是凭证**：

- 前端每个请求都带 `x-group-code` 请求头
- 数据库 RLS 只放行「请求头里的码所对应的那个小组」的数据
- 所以 anon key 公开在前端代码里没有关系，不知道 6 位邀请码就读不到任何东西

已知的边界，先说清楚：**同一个小组内的人理论上能冒充别人打卡**。熟人小组里没人有动机替别人打卡，用信任换掉整套账号系统是有意的取舍。如果哪天需要，再加轻量校验。

体重隐私是数据库层生效的：排行榜读的是 `member_progress` 视图，未勾选「公开体重」的成员，视图直接返回 `null`，别人的公斤数不会进到前端。

## 开发

| 命令 | 作用 |
|---|---|
| `npm run dev` | 起开发服务器，改代码热更新 |
| `npm test` | 统计逻辑单测（streak、周达标、减重百分比、上周成绩） |
| `npm run build` | 类型检查 + 构建，**改完必须过** |
| `npm run preview` | 本地预览构建产物，验证部署前的真实表现 |

关键约束都写在 [CLAUDE.md](CLAUDE.md) 里，动手前先看一眼，尤其是「打卡 ≤ 2 次点击」和「打卡墙不滚动看完全组」这两条。代码怎么分层、为什么这么分，看 [docs/architecture.md](docs/architecture.md)。

## 启动遇到问题

| 现象 | 原因和解法 |
|---|---|
| 端口 5180 被占用 | 改 `vite.config.ts` 里的 `port` |
| 顶部一直显示「演示模式」 | `.env.local` 没建、变量名写错，或者改完没重启。Vite 只在启动时读环境变量 |
| 页面白屏 | 打开控制台看报错；多半是 `npm install` 没装完 |
| 部署后刷新页面 404 | `vercel.json` 的 SPA 重写没生效，确认这个文件在仓库根目录 |
| Supabase 报 `new row violates row-level security policy` | schema.sql 没跑，或者只跑了建表部分没跑 RLS 部分。重新完整执行一次，脚本可重复运行 |
| 能建组但读不到数据 | Supabase 控制台 → Table Editor 确认 `groups` 表里有数据；再确认四张表都开了 RLS 且各有一条策略（`groups_rw` / `members_rw` / `checkins_rw` / `weights_rw`） |

## 目录

```
docs/           需求、技术方案、使用说明
supabase/       建表 SQL（含 RLS 与进度视图）
src/
  lib/          日期、统计、数据层（db.ts 是唯一数据出入口）
  components/   UI 组件，只负责画
  pages/        路由级页面
  types/        共享类型定义
```

四个页面：`/` 落地页 · `/g/:code` 打卡墙 · `/g/:code/m/:id` 个人页 · `/g/:code/me` 设置。
