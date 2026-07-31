import type { Checkin, Progress } from '../types'
import { addDays, monthStart, weekDates, weekStart } from './date'

/**
 * 所有统计量都从打卡记录实时算出，不落库，避免出现「数据库里的 streak 和实际记录不一致」。
 */

export function dateSetOf(checkins: Checkin[]): Set<string> {
  return new Set(checkins.map((c) => c.date))
}

/**
 * 当前连续天数。
 * 今天还没打卡不算断卡（一天还没过完），此时从昨天开始往前数。
 * 只有昨天和今天都没打卡，才归零。
 */
export function currentStreak(dates: Set<string>, todayStr: string): number {
  let cursor = dates.has(todayStr) ? todayStr : addDays(todayStr, -1)
  if (!dates.has(cursor)) return 0
  let n = 0
  while (dates.has(cursor)) {
    n++
    cursor = addDays(cursor, -1)
  }
  return n
}

/** 历史最长连续天数（受拉取到的记录窗口限制） */
export function bestStreak(dates: Set<string>): number {
  const sorted = [...dates].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const d of sorted) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1
    if (run > best) best = run
    prev = d
  }
  return best
}

/** 本周已打卡天数 */
export function weekCount(dates: Set<string>, todayStr: string): number {
  return weekDates(weekStart(todayStr)).filter((d) => dates.has(d)).length
}

/**
 * 上周每人打了几天。
 * 周一时本周还没有任何数据，光看本周等于什么都没看到，所以打卡墙要留一列上周成绩。
 */
export function lastWeekCounts(checkins: Checkin[], weekStartStr: string): Map<string, number> {
  const from = addDays(weekStartStr, -7)
  const out = new Map<string, number>()
  for (const c of checkins) {
    if (c.date >= from && c.date < weekStartStr) {
      out.set(c.memberId, (out.get(c.memberId) ?? 0) + 1)
    }
  }
  return out
}

/** 本月已打卡天数 */
export function monthCount(dates: Set<string>, todayStr: string): number {
  const prefix = monthStart(todayStr).slice(0, 7)
  let n = 0
  for (const d of dates) if (d.startsWith(prefix)) n++
  return n
}

/** 本周还剩几天可打卡（含今天），用来判断目标还来不来得及 */
export function daysLeftInWeek(todayStr: string): number {
  const week = weekDates(weekStart(todayStr))
  return week.filter((d) => d >= todayStr).length
}

export type WeekStatus =
  | { kind: 'done'; count: number; target: number }
  | { kind: 'onTrack'; count: number; target: number; need: number; left: number }
  | { kind: 'atRisk'; count: number; target: number; need: number; left: number }
  | { kind: 'failed'; count: number; target: number }

/** 本周达标状态。need > left 时本周已不可能达标 */
export function weekStatus(dates: Set<string>, todayStr: string, target: number): WeekStatus {
  const count = weekCount(dates, todayStr)
  const left = daysLeftInWeek(todayStr)
  const need = target - count
  if (need <= 0) return { kind: 'done', count, target }
  if (need > left) return { kind: 'failed', count, target }
  if (need === left) return { kind: 'atRisk', count, target, need, left }
  return { kind: 'onTrack', count, target, need, left }
}

/** 减重百分比，正数表示已减掉。缺数据返回 null，不要用 0 冒充 */
export function lossPct(startWeight: number | null, latestKg: number | null): number | null {
  if (!startWeight || startWeight <= 0 || latestKg == null) return null
  return Math.round(((startWeight - latestKg) / startWeight) * 1000) / 10
}

/** 排行：有减重数据的按百分比降序在前，无数据的排最后 */
export function rankByLoss<T extends { memberId: string }>(
  rows: T[],
  progress: Map<string, Progress>,
): { row: T; lossPct: number | null; rank: number | null }[] {
  const withPct = rows.map((row) => ({ row, lossPct: progress.get(row.memberId)?.lossPct ?? null }))
  withPct.sort((a, b) => {
    if (a.lossPct == null && b.lossPct == null) return 0
    if (a.lossPct == null) return 1
    if (b.lossPct == null) return -1
    return b.lossPct - a.lossPct
  })
  let rank = 0
  return withPct.map((item) => ({
    ...item,
    rank: item.lossPct == null ? null : ++rank,
  }))
}
