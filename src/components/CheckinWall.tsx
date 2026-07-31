import type { Checkin, Member } from '../types'
import { WEEKDAY_LABELS, weekDates } from '../lib/date'
import { lastWeekCounts } from '../lib/stats'

type CellState = 'done' | 'makeup' | 'missed' | 'open' | 'future'

/**
 * 打卡墙：整个产品的信息核心。
 * 硬约束是一屏看完全组 —— 谁在偷懒必须靠余光就能发现，而不是靠翻页。
 */
export function CheckinWall({
  members,
  checkins,
  selfId,
  weekStartStr,
  todayStr,
  targetDays,
  onCell,
  onMember,
}: {
  members: Member[]
  checkins: Checkin[]
  selfId: string | null
  weekStartStr: string
  todayStr: string
  targetDays: number
  onCell: (member: Member, date: string, checkin: Checkin | null) => void
  onMember: (member: Member) => void
}) {
  const days = weekDates(weekStartStr)
  const byKey = new Map(checkins.map((c) => [`${c.memberId}|${c.date}`, c]))
  const lastWeek = lastWeekCounts(checkins, weekStartStr)
  // 名字列要放得下 5~6 个字符的常见昵称，否则「Bindy」这种就被截断了
  const cols = '4.1rem repeat(7, minmax(0, 1fr)) 1.25rem'

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-rule bg-card">
      <div className="perforated h-2 w-full" />

      <div className="px-3 pb-3">
        <div className="grid items-end gap-1 pb-1.5" style={{ gridTemplateColumns: cols }}>
          <div className="font-mono text-[10px] tracking-[0.16em] text-muted uppercase">本周</div>
          {days.map((d, i) => {
            const isToday = d === todayStr
            return (
              <div key={d} className="text-center">
                <div
                  className={`font-mono text-[11px] ${isToday ? 'font-bold text-stamp' : 'text-muted'}`}
                >
                  {WEEKDAY_LABELS[i]}
                </div>
                <div
                  className={`mx-auto mt-0.5 h-1 w-1 rounded-full ${isToday ? 'bg-stamp' : 'bg-transparent'}`}
                />
              </div>
            )
          })}
          <div className="pb-1.5 text-center font-mono text-[9px] leading-none text-muted">上周</div>
        </div>

        <div className="border-t border-rule/70">
          {members.map((m, rowIndex) => {
            const isSelf = m.id === selfId
            return (
              <div
                key={m.id}
                className="rise grid items-center gap-1 border-b border-rule/50 py-1 last:border-b-0"
                style={{ gridTemplateColumns: cols, ['--i' as string]: rowIndex }}
              >
                <button
                  onClick={() => onMember(m)}
                  className="flex min-w-0 items-center gap-1 py-1 text-left"
                >
                  <span className="text-[13px] leading-none">{m.emoji}</span>
                  <span
                    className={`truncate text-xs ${isSelf ? 'font-semibold text-ink' : 'text-ink/80'}`}
                  >
                    {m.name}
                  </span>
                </button>

                {days.map((d) => {
                  const checkin = byKey.get(`${m.id}|${d}`) ?? null
                  const state = cellState(checkin, d, todayStr)
                  const clickable = isSelf && d <= todayStr
                  return (
                    <button
                      key={d}
                      disabled={!clickable && !checkin}
                      onClick={() => onCell(m, d, checkin)}
                      aria-label={`${m.name} ${d} ${state === 'done' || state === 'makeup' ? '已打卡' : '未打卡'}`}
                      className="flex h-8 items-center justify-center disabled:cursor-default"
                    >
                      <CellMark state={state} highlight={isSelf} />
                    </button>
                  )
                })}

                <LastWeek count={lastWeek.get(m.id) ?? 0} target={targetDays} />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/** 上周达标就是墨黑的数字，没达标是朱红 —— 一列就能看出谁上周掉队了 */
function LastWeek({ count, target }: { count: number; target: number }) {
  const met = count >= target
  return (
    <div
      className={`text-center font-mono text-xs ${met ? 'font-semibold text-ink' : 'text-stamp'}`}
      title={`上周 ${count}/${target} 天`}
    >
      {count}
    </div>
  )
}

function cellState(checkin: Checkin | null, date: string, todayStr: string): CellState {
  if (checkin) return checkin.isMakeup ? 'makeup' : 'done'
  if (date > todayStr) return 'future'
  if (date === todayStr) return 'open'
  return 'missed'
}

function CellMark({ state, highlight }: { state: CellState; highlight: boolean }) {
  const box = 'flex h-7 w-full max-w-9 items-center justify-center rounded-[3px] text-[13px]'
  switch (state) {
    case 'done':
      return (
        <div className={`${box} stamp font-bold`} aria-hidden>
          ✓
        </div>
      )
    case 'makeup':
      return (
        <div className={`${box} stamp border-dashed font-mono text-[10px]`} aria-hidden>
          补
        </div>
      )
    case 'open':
      return (
        <div
          className={`${box} border border-dashed ${
            highlight ? 'border-ink/45 bg-ink/[0.05]' : 'border-rule'
          }`}
          aria-hidden
        />
      )
    case 'missed':
      return <div className={`${box} border border-dotted border-rule bg-transparent`} aria-hidden />
    case 'future':
      return <div className={`${box} border border-rule/40 opacity-50`} aria-hidden />
  }
}
