# 技术方案

> 这份文档解释「为什么这么搭」和「代码怎么跑起来的」。
> 想知道产品要解决什么问题看 [requirements.md](requirements.md)，想知道怎么装怎么部署看 [README](../README.md)。

## 一句话架构

一个纯静态前端 + Supabase 托管的 Postgres，**没有自己的服务器**。

```
手机浏览器
   │
   │  静态资源（HTML/JS/CSS）
   ├────────────────────────►  Vercel CDN
   │
   │  数据读写（HTTPS + x-group-code 请求头）
   └────────────────────────►  Supabase / PostgREST
                                    │
                                    ▼
                              Postgres + RLS
                              （邀请码决定能看到哪个小组）
```

## 为什么是这个架构

从需求倒推，只有三条硬约束：

1. **数据必须共享。** 互相监督的前提是能看到彼此，纯 localStorage 方案直接出局。
2. **用的人只有几个。** 峰值 QPS 接近零，写自己的后端是纯粹的浪费。
3. **要能随时改。** 这是自用产品，加个字段不该走一遍发版流程。

结论就是 BaaS：前端直连数据库，权限交给数据库自己管。省掉了后端服务、API 层、部署运维和一整套 CRUD 样板代码。

代价是**权限逻辑写在 SQL 里而不是 TypeScript 里**，调试时要去 Supabase 控制台看策略。对这个体量来说值得。

## 一次打卡都发生了什么

```
用户点「今天动了」
   │
   ├─► StampButton 立刻播放盖章动画          ← 0ms，不等网络
   │
   ├─► db.upsertCheckin(code, {...})
   │      └─► supabase-js 带 x-group-code 头发出 POST
   │             └─► Postgres 检查 RLS：这个码对应的小组里有这个 member 吗？
   │                    └─► 通过则 upsert (member_id, date) 唯一键
   │
   ├─► setCheckins() 本地先插进去              ← 打卡墙立刻出现印章
   │
   ├─► 弹出补充细节的 Sheet（运动 / 时长 / 体重，全部可选）
   │
   └─► reload() 后台回源，用服务端数据覆盖本地
```

关键是**动画和本地状态都不等网络**。上传失败会 toast 提示，但用户感知到的打卡是瞬时的。

## 分层职责

| 层 | 位置 | 职责 | 不该做什么 |
|---|---|---|---|
| 页面 | `src/pages/` | 组织流程、持有交互状态 | 不直接调 supabase |
| 组件 | `src/components/` | 只负责画 | 不算统计、不发请求 |
| 数据层 | `src/lib/db.ts` | 唯一的数据出入口，snake_case ↔ camelCase 转换 | 不放业务规则 |
| 统计 | `src/lib/stats.ts` | 所有派生数值 | 不碰 DOM、不碰网络 |
| 日期 | `src/lib/date.ts` | 本地日期字符串运算 | 不用 UTC |
| 状态 | `src/lib/useGroupData.ts` | 拉数据、缓存、刷新时机 | 不做业务判断 |

这个分层不是形式主义：统计逻辑全部集中在 `stats.ts` 才有 22 个单测可跑；组件里但凡藏一个 `filter(...).length`，那段逻辑就永远测不到。

## 关键技术决策

| 决策 | 理由 | 代价 |
|---|---|---|
| **不做账号体系，邀请码即凭证** | 熟人小组里账号是纯负担，注册流程会劝退一半人 | 组内可以互相冒充打卡 —— 但没人有动机替别人打卡 |
| **RLS 认请求头 `x-group-code`** | anon key 公开在前端，必须有别的东西当凭证；6 位码就是那个东西 | 每个小组一个 supabase 客户端实例（已按 code 缓存） |
| **统计不落库，全部实时算** | streak 存进数据库就会和实际记录不一致，且需要维护更新逻辑 | 每次要拉 120 天记录 —— 几个人的量可以忽略 |
| **日期用本地 `YYYY-MM-DD` 字符串** | 东八区下 UTC 会把早上 8 点前的打卡算到前一天 | 需要自己写日期运算，不能直接用 Date 比较 |
| **`member_progress` 视图做隐私裁剪** | 「不公开体重」如果只在前端隐藏，等于没隐藏 | 多一个视图要维护 |
| **演示模式双实现** | 没配 Supabase 也能立刻看到界面，降低第一次跑起来的门槛 | `localDb.ts` 要跟 `db.ts` 接口保持一致 |
| **Tailwind v4 `@theme` + 变量覆盖** | 深色模式只需覆盖 CSS 变量，不用给每个元素写 `dark:` | 依赖 v4 的 `@theme`，降级到 v3 要重写 |
| **HashRouter + 相对 `base`** | 免备案托管（Supabase Storage / 任意对象存储）没有 SPA 重写规则，`/g/ABC234` 直接访问会 404；只有 `#/g/ABC234` 能保证深链接任何时候都落回 `index.html` | URL 带 `#`，邀请链接不如干净路径好看；换成有重写规则的托管（Vercel/Nginx）可以随时切回 `BrowserRouter` |

## 数据模型

```
groups ──┬──< members ──┬──< checkins   (member_id, date) 唯一
         │              └──< weights    (member_id, date) 唯一
         └── code 是邀请码，也是 RLS 的凭证

member_progress  视图：member_id / loss_pct / latest_kg / latest_date
                 未公开体重的人 latest_kg 返回 null
```

唯一键 `(member_id, date)` 是有意的：一天只能有一条打卡记录，重复打卡自然变成更新而不是新增，不需要在前端做去重。

字段细节见 [supabase/schema.sql](../supabase/schema.sql)，注释写在 SQL 里。

## 状态管理

没有引入 Redux / Zustand 这类东西 —— 全局状态只有「当前小组的数据」一件事，一个 hook 足够。

`useGroupData(code)` 负责：

- 首次进入拉全量（小组 → 成员 → 打卡记录 + 进度）
- 暴露 `reload()` 给写操作用完回源
- 暴露 `setCheckins()` 给乐观更新用
- **切回页面时静默刷新**：监听 `visibilitychange` 和 `focus`，这样从微信切回来看到的是朋友刚打的卡，而不是几小时前的快照

没有做 WebSocket 实时推送。几个人的打卡不需要秒级同步，切回来刷新就够了 —— 少一套连接管理和断线重连。

## 身份识别

```
localStorage
  fitbuddy:identity:{CODE}  →  memberId    // 我在这个小组里是谁
  fitbuddy:recent           →  最近 5 个小组，落地页用
  fitbuddy:demo             →  演示模式的全部数据
```

换手机或清缓存只需要在名单里重新点一次自己，历史数据挂在 `memberId` 上，不会丢。

## 样式系统

- 颜色、字体全部是 `src/index.css` 里 `@theme` 定义的 CSS 变量
- 深色模式靠 `@media (prefers-color-scheme: dark)` 覆盖同名变量实现 —— Tailwind v4 的工具类编译成 `var()` 引用，改变量就全站生效
- 只有两个颜色：墨黑 `--color-ink` 和朱红 `--color-stamp`。朱红专供打卡相关，别的地方一律墨黑或灰
- 动效只在两个时刻：打卡墙逐行入场、盖章瞬间。全部尊重 `prefers-reduced-motion`

## 已知边界

先说清楚，不装作没有：

- **组内可冒充。** 没有账号就没有身份校验，这是换掉整套注册登录的代价。
- **打卡历史只拉 120 天。** 「历史最长连续」实际是这个窗口内的最长值。
- **演示模式的数据不共享。** 没配 Supabase 时只是个本机记事本。
- **没有实时推送。** 别人打卡后你要切回页面才看得到。
- **补卡额度靠前端判断。** 数据库层没拦，改前端能绕过。熟人小组不值得为这个加约束。

## 想加东西改哪里

| 想做的事 | 动哪 |
|---|---|
| 加一个统计口径 | `src/lib/stats.ts` + 对应单测，组件只负责显示 |
| 加一个字段 | `supabase/schema.sql` → `src/types/index.ts` → `db.ts` 的行映射 → `localDb.ts` |
| 欠账记账（V2） | 表加 `debts`，统计放 stats，界面挂在排行榜下面 |
| 提醒推送（V2） | Supabase Edge Function + cron，查当天没打卡的人，推飞书 / 企微群机器人 |
| 换视觉 | 只改 `src/index.css` 的 `@theme` 变量，组件不用动 |
