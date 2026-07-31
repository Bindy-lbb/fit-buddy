import { describe, expect, it } from 'vitest'
import { addDays, weekDates, weekStart, weekdayIndex } from './date'
import {
  bestStreak,
  currentStreak,
  daysLeftInWeek,
  lastWeekCounts,
  lossPct,
  monthCount,
  weekCount,
  weekStatus,
} from './stats'
import type { Checkin } from '../types'

const set = (...d: string[]) => new Set(d)

describe('date', () => {
  it('周一为一周起点', () => {
    expect(weekStart('2026-07-27')).toBe('2026-07-27') // 周一
    expect(weekStart('2026-07-29')).toBe('2026-07-27') // 周三
    expect(weekStart('2026-08-02')).toBe('2026-07-27') // 周日归上一周
  })

  it('跨月跨年加减天数', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('周几索引周一为 0', () => {
    expect(weekdayIndex('2026-07-27')).toBe(0)
    expect(weekdayIndex('2026-08-02')).toBe(6)
  })

  it('一周七天', () => {
    expect(weekDates('2026-07-27')).toEqual([
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
    ])
  })
})

describe('currentStreak', () => {
  it('今天打了卡从今天数', () => {
    expect(currentStreak(set('2026-07-27', '2026-07-26', '2026-07-25'), '2026-07-27')).toBe(3)
  })

  it('今天还没打卡不算断卡，从昨天数', () => {
    expect(currentStreak(set('2026-07-26', '2026-07-25'), '2026-07-27')).toBe(2)
  })

  it('昨天和今天都没打，归零', () => {
    expect(currentStreak(set('2026-07-25', '2026-07-24'), '2026-07-27')).toBe(0)
  })

  it('没有任何记录时为 0', () => {
    expect(currentStreak(set(), '2026-07-27')).toBe(0)
  })

  it('跨月连续', () => {
    expect(currentStreak(set('2026-08-01', '2026-07-31', '2026-07-30'), '2026-08-01')).toBe(3)
  })
})

describe('bestStreak', () => {
  it('取最长的一段', () => {
    expect(
      bestStreak(
        set('2026-07-01', '2026-07-02', '2026-07-03', '2026-07-10', '2026-07-11'),
      ),
    ).toBe(3)
  })

  it('空记录为 0，单条为 1', () => {
    expect(bestStreak(set())).toBe(0)
    expect(bestStreak(set('2026-07-01'))).toBe(1)
  })
})

describe('weekCount / monthCount', () => {
  it('只数本周，上周的不算', () => {
    // 2026-07-27 是周一，07-26 属于上一周
    expect(weekCount(set('2026-07-27', '2026-07-26'), '2026-07-27')).toBe(1)
  })

  it('只数本月', () => {
    expect(monthCount(set('2026-07-27', '2026-06-30', '2026-07-01'), '2026-07-27')).toBe(2)
  })
})

describe('lastWeekCounts', () => {
  const c = (memberId: string, date: string): Checkin => ({
    id: `${memberId}-${date}`,
    memberId,
    date,
    exercise: null,
    minutes: null,
    note: null,
    isMakeup: false,
  })

  it('只数上一周，本周和更早都不算', () => {
    const counts = lastWeekCounts(
      [
        c('a', '2026-07-20'), // 上周一
        c('a', '2026-07-26'), // 上周日
        c('a', '2026-07-27'), // 本周一，不算
        c('a', '2026-07-19'), // 上上周日，不算
        c('b', '2026-07-22'),
      ],
      '2026-07-27',
    )
    expect(counts.get('a')).toBe(2)
    expect(counts.get('b')).toBe(1)
    expect(counts.get('c')).toBeUndefined()
  })
})

describe('weekStatus', () => {
  it('达标', () => {
    const dates = set('2026-07-27', '2026-07-28', '2026-07-29')
    expect(weekStatus(dates, '2026-07-29', 3)).toMatchObject({ kind: 'done', count: 3 })
  })

  it('进度正常', () => {
    // 周三，已 1 天，目标 5，本周还剩 5 天（三四五六日）
    expect(weekStatus(set('2026-07-27'), '2026-07-29', 5)).toMatchObject({
      kind: 'onTrack',
      need: 4,
      left: 5,
    })
  })

  it('剩余天数刚好等于缺口 → 危险，一天都不能漏', () => {
    expect(weekStatus(set(), '2026-07-30', 4)).toMatchObject({ kind: 'atRisk', need: 4, left: 4 })
  })

  it('剩余天数不够 → 本周已不可能达标', () => {
    expect(weekStatus(set(), '2026-07-31', 4)).toMatchObject({ kind: 'failed', count: 0 })
  })

  it('周日剩 1 天', () => {
    expect(daysLeftInWeek('2026-08-02')).toBe(1)
  })
})

describe('lossPct', () => {
  it('正常减重', () => {
    expect(lossPct(80, 76)).toBe(5)
  })

  it('增重返回负数', () => {
    expect(lossPct(80, 82)).toBe(-2.5)
  })

  it('缺数据返回 null 而不是 0', () => {
    expect(lossPct(null, 76)).toBeNull()
    expect(lossPct(80, null)).toBeNull()
    expect(lossPct(0, 76)).toBeNull()
  })
})
