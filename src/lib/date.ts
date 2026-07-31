/**
 * 全项目统一用本地日期字符串 YYYY-MM-DD 表示「哪一天」。
 * 不要用 UTC 时间戳比较日期：中国时区下 UTC 会把 08:00 前的打卡算到前一天。
 */

export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 解析成当天中午的本地时间，避免夏令时导致 addDays 偏移 */
export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

export function today(): string {
  return toDateStr(new Date())
}

export function addDays(s: string, n: number): string {
  const d = parseDateStr(s)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

export function daysBetween(from: string, to: string): number {
  const ms = parseDateStr(to).getTime() - parseDateStr(from).getTime()
  return Math.round(ms / 86_400_000)
}

/** 本周一。周一为一周起点（周日是 getDay()===0，要往前推 6 天） */
export function weekStart(s: string): string {
  const d = parseDateStr(s)
  const offset = (d.getDay() + 6) % 7
  return addDays(s, -offset)
}

export function weekDates(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** 周几索引，0 = 周一 */
export function weekdayIndex(s: string): number {
  return (parseDateStr(s).getDay() + 6) % 7
}

export function monthStart(s: string): string {
  return `${s.slice(0, 7)}-01`
}

/** 用于列表展示：7-27 周一 */
export function shortLabel(s: string): string {
  const [, m, d] = s.split('-')
  return `${Number(m)}-${Number(d)} 周${WEEKDAY_LABELS[weekdayIndex(s)]}`
}
