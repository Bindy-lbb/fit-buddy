import type { Member, Progress } from '../types'
import { rankByLoss } from '../lib/stats'
import { Label } from './ui'

/**
 * 排行只比减重百分比：体重基数不同，比绝对公斤数既不公平，也会让人不敢参加。
 * 默认只显示前三 + 自己，避免主页被排行榜挤长。
 */
export function Leaderboard({
  members,
  progress,
  selfId,
  onMember,
  onRecordWeight,
}: {
  members: Member[]
  progress: Map<string, Progress>
  selfId: string | null
  onMember: (member: Member) => void
  onRecordWeight: () => void
}) {
  const ranked = rankByLoss(
    members.map((m) => ({ memberId: m.id, member: m })),
    progress,
  )
  const top = ranked.slice(0, 3)
  const selfIndex = ranked.findIndex((r) => r.row.memberId === selfId)
  const selfRow = selfIndex >= 3 ? ranked[selfIndex] : null
  const best = Math.max(1, ...ranked.map((r) => r.lossPct ?? 0))

  return (
    <section className="mt-4 rounded-xl border border-rule bg-card px-4 py-3">
      <div className="flex items-baseline justify-between">
        <Label>减重榜 · 按百分比</Label>
        <button onClick={onRecordWeight} className="font-mono text-[11px] text-stamp uppercase">
          记体重
        </button>
      </div>

      <div className="mt-2 divide-y divide-rule/50">
        {top.map((r) => (
          <Row
            key={r.row.memberId}
            member={r.row.member}
            rank={r.rank}
            lossPct={r.lossPct}
            best={best}
            isSelf={r.row.memberId === selfId}
            onClick={() => onMember(r.row.member)}
          />
        ))}
        {selfRow && (
          <Row
            key={selfRow.row.memberId}
            member={selfRow.row.member}
            rank={selfRow.rank}
            lossPct={selfRow.lossPct}
            best={best}
            isSelf
            onClick={() => onMember(selfRow.row.member)}
          />
        )}
      </div>
    </section>
  )
}

function Row({
  member,
  rank,
  lossPct,
  best,
  isSelf,
  onClick,
}: {
  member: Member
  rank: number | null
  lossPct: number | null
  best: number
  isSelf: boolean
  onClick: () => void
}) {
  const pct = lossPct ?? 0
  const width = pct > 0 ? Math.max(4, (pct / best) * 100) : 0
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 py-2 text-left">
      <span className="w-5 shrink-0 font-mono text-xs text-muted">
        {rank ? String(rank).padStart(2, '0') : '--'}
      </span>
      <span className="shrink-0 text-base">{member.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${isSelf ? 'font-semibold' : ''}`}>
          {member.name}
          {isSelf && <span className="ml-1 font-mono text-[10px] text-muted">你</span>}
        </span>
        <span className="mt-1 block h-[3px] w-full rounded-full bg-rule/60">
          <span
            className="block h-full rounded-full bg-stamp"
            style={{ width: `${width}%` }}
          />
        </span>
      </span>
      <span className="shrink-0 text-right">
        {lossPct == null ? (
          <span className="font-mono text-[11px] text-muted">待记录</span>
        ) : (
          <span
            className={`font-mono text-base font-bold ${lossPct > 0 ? 'text-stamp' : 'text-muted'}`}
          >
            {lossPct > 0 ? '−' : lossPct < 0 ? '+' : ''}
            {Math.abs(lossPct).toFixed(1)}%
          </span>
        )}
      </span>
    </button>
  )
}
