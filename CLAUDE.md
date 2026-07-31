# FitBuddy 项目约定

朋友之间的减肥运动打卡互相监督网页。

- [docs/requirements.md](docs/requirements.md) —— 唯一需求来源，改需求先改它
- [docs/architecture.md](docs/architecture.md) —— 技术方案与分层职责
- [docs/usage.md](docs/usage.md) —— 使用说明
- [README.md](README.md) —— 安装、配置、部署

## 产品红线

1. **打卡 ≤ 2 次点击**。任何让打卡变慢的改动都要先砍掉别的东西。
2. **手机优先**。竖屏无横向滚动、无截断；桌面端只要求不难看。
3. **打卡墙不滚动就能看完全组**。这是产品的信息核心，任何布局改动不得破坏它。
4. **不做的功能就是不做**：动作库、卡路里、饮食记录、AI 训练计划、陌生人社交、积分商城。需求变更先改 requirements.md，再动代码。
5. **体重绝对值默认不对外可见**，只公开减重百分比。任何新界面都遵守。
6. **不引入任何境外 CDN、字体、脚本依赖**。用户在国内，`googleapis` / `gstatic` / `unpkg` 这类引用等于首屏白等一个超时。字体已用 `@fontsource` 自托管，新依赖一律打进构建产物。

## 目录结构

```
docs/            需求与设计文档，requirements.md 为准
src/
  pages/         路由级页面组件
  components/    可复用 UI
  lib/           日期、统计、数据层
  types/         共享类型定义
supabase/        建表 SQL 与迁移
```

- 统计逻辑（streak、达标进度、减重百分比、上周成绩）统一放 `src/lib/stats.ts`，**不散落在组件里** —— 组件只负责画，算全部走 stats，这样才测得动。
- 日期一律用本地日期字符串 `YYYY-MM-DD` 处理，不用 UTC 时间戳比较「哪一天」。东八区下 UTC 会把早上 8 点前的打卡算到前一天。
- `src/lib/db.ts` 是唯一的数据出入口，页面和组件不直接碰 supabase 客户端。它同时负责在没配环境变量时切到 `localDb.ts` 演示模式，两边接口必须保持一致。
- 涉及「周」的逻辑注意两个真实边界：周一时本周还没有数据（所以打卡墙有上周列），周一时昨天属于上一周（所以补卡入口不能只放在格子里，额度按滚动 7 天算）。

## 命名

- 组件文件 `PascalCase.tsx`，其余 `camelCase.ts`
- 数据库表和字段 `snake_case`，前端类型 `camelCase`，转换只在 `src/lib/` 边界处做

## 视觉

设计方向是**「打卡 = 盖章」的纸质考勤卡**：米白纸张 + 墨黑字 + 朱红印章。

- **只有两个颜色**：墨黑 `--color-ink` 和朱红 `--color-stamp`，不引入第三种。朱红只留给打卡相关的东西，别的地方一律墨黑或灰。
- 颜色全部走 `@theme` 里的 CSS 变量，深色模式靠覆盖变量实现，不要在组件里写死色值。
- 数字、日期、标签用 `font-mono`（IBM Plex Mono），中文正文用 `font-sans`。
- 动效集中在两个时刻：打卡墙逐行入场、盖章瞬间。不加零散的微动效，且都尊重 `prefers-reduced-motion`。

## 开发

- 改完执行 `npm test` 和 `npm run build`，两个都过才算完成
- 密钥只进 `.env.local`（已 gitignore），不写入代码；Supabase 只用 anon key
- commit message 用英文，简洁描述意图
- git push 需经许可，不自动执行
