import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Weight } from '../types'
import * as db from '../lib/db'
import { shortLabel, today } from '../lib/date'
import { bestStreak, currentStreak, dateSetOf, monthCount } from '../lib/stats'
import { getIdentity } from '../lib/identity'
import { useGroupData } from '../lib/useGroupData'
import { WeightChart } from '../components/WeightChart'
import { BackLink, Card, Label, Shell, Spinner } from '../components/ui'

export default function MemberPage() {
  const params = useParams()
  const code = (params.code ?? '').toUpperCase()
  const memberId = params.memberId ?? ''
  const { members, checkins, progress, loading, group } = useGroupData(code)
  const [weights, setWeights] = useState<Weight[]>([])

  const member = members.find((m) => m.id === memberId) ?? null
  const isSelf = getIdentity(code) === memberId
  const canSeeNumbers = isSelf || !!member?.showWeight

  useEffect(() => {
    if (!member || !canSeeNumbers) return
    let alive = true
    void db
      .listWeights(code, member.id)
      .then((w) => {
        if (alive) setWeights(w)
      })
      .catch(() => setWeights([]))
    return () => {
      alive = false
    }
  }, [code, member, canSeeNumbers])

  const mine = useMemo(
    () => checkins.filter((c) => c.memberId === memberId).sort((a, b) => b.date.localeCompare(a.date)),
    [checkins, memberId],
  )
  const dates = useMemo(() => dateSetOf(mine), [mine])

  if (loading) return <Spinner />
  if (!member || !group) {
    return (
      <Shell>
        <div className="pt-20 text-center text-sm text-muted">找不到这位成员</div>
      </Shell>
    )
  }

  const todayStr = today()
  const lossPct = progress.get(member.id)?.lossPct ?? null

  return (
    <Shell>
      <div className="pt-8">
        <BackLink to={`/g/${code}`}>打卡墙</BackLink>
      </div>

      <header className="mt-4 flex items-center gap-3">
        <span className="text-3xl">{member.emoji}</span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{member.name}</h1>
          <p className="font-mono text-[11px] tracking-widest text-muted uppercase">
            {isSelf ? '这是你' : `${group.name} 成员`}
          </p>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Stat label="连续" value={currentStreak(dates, todayStr)} unit="天" accent />
        <Stat label="本月" value={monthCount(dates, todayStr)} unit="天" />
        <Stat
          label="减重"
          value={lossPct == null ? '--' : Math.abs(lossPct).toFixed(1)}
          unit={lossPct == null ? '' : '%'}
          accent={lossPct != null && lossPct > 0}
        />
      </div>

      <Card className="mt-4 px-4 py-4">
        <div className="flex items-baseline justify-between">
          <Label>体重曲线</Label>
          <span className="font-mono text-[10px] text-muted">
            最长连续 {bestStreak(dates)} 天
          </span>
        </div>
        <div className="mt-3">
          {canSeeNumbers ? (
            <WeightChart
              weights={weights}
              targetWeight={member.targetWeight}
              showNumbers={isSelf || member.showWeight}
            />
          ) : (
            <p className="py-8 text-center text-xs leading-relaxed text-muted">
              {member.name} 没有公开体重数字
              <br />
              排行榜上的减重百分比仍然公开
            </p>
          )}
        </div>
      </Card>

      <section className="mt-4">
        <Label>打卡记录</Label>
        {mine.length === 0 ? (
          <p className="mt-3 text-sm text-muted">还没有任何打卡记录。</p>
        ) : (
          <div className="mt-2 divide-y divide-rule/60 overflow-hidden rounded-xl border border-rule bg-card">
            {mine.slice(0, 20).map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="stamp flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] text-[11px] font-bold">
                  {c.isMakeup ? '补' : '✓'}
                </span>
                <span className="w-24 shrink-0 font-mono text-xs text-muted">
                  {shortLabel(c.date)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {c.exercise ?? '已打卡'}
                  {c.minutes ? ` · ${c.minutes} 分` : ''}
                  {c.note ? ` · ${c.note}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </Shell>
  )
}

function Stat({
  label,
  value,
  unit,
  accent,
}: {
  label: string
  value: number | string
  unit: string
  accent?: boolean
}) {
  return (
    <div className="rounded-xl border border-rule bg-card px-3 py-3 text-center">
      <div className="font-mono text-[10px] tracking-[0.16em] text-muted uppercase">{label}</div>
      <div className={`mt-1 font-mono text-2xl leading-none font-bold ${accent ? 'text-stamp' : ''}`}>
        {value}
        <span className="ml-0.5 text-xs font-normal text-muted">{unit}</span>
      </div>
    </div>
  )
}
