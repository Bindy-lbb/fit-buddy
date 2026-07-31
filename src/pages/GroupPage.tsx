import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Checkin, Member } from '../types'
import { EXERCISES } from '../types'
import * as db from '../lib/db'
import { addDays, shortLabel, today, weekStart } from '../lib/date'
import { currentStreak, dateSetOf, weekStatus } from '../lib/stats'
import { getIdentity, setIdentity } from '../lib/identity'
import { groupInviteUrl } from '../lib/links'
import { useGroupData } from '../lib/useGroupData'
import { CheckinWall } from '../components/CheckinWall'
import { IdentityGate } from '../components/IdentityGate'
import { Leaderboard } from '../components/Leaderboard'
import { Sheet } from '../components/Sheet'
import { StampButton } from '../components/StampButton'
import { Chip, DemoBanner, Label, PrimaryButton, Shell, Spinner, TextField } from '../components/ui'

const MINUTE_CHOICES = [15, 30, 45, 60, 90]
/**
 * 7 天内只给一次补卡机会：完全禁止太严苛（真有忘记的时候），无限补卡则打卡墙失去意义。
 * 按滚动 7 天算而不是按日历周算，周一补周日的卡才不会出现「跨周不占额度」的漏洞。
 */
const MAKEUP_WINDOW_DAYS = 7

export default function GroupPage() {
  const code = (useParams().code ?? '').toUpperCase()
  const navigate = useNavigate()
  const data = useGroupData(code)
  const { group, members, checkins, progress, loading, notFound, error, reload, setCheckins } = data

  const [selfId, setSelfId] = useState<string | null>(() => getIdentity(code))
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sheetDate, setSheetDate] = useState<string | null>(null)
  const [exercise, setExercise] = useState<string | null>(null)
  const [minutes, setMinutes] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [weightInput, setWeightInput] = useState('')

  const todayStr = today()
  const self = members.find((m) => m.id === selfId) ?? null
  const myCheckins = useMemo(
    () => checkins.filter((c) => c.memberId === selfId),
    [checkins, selfId],
  )
  const myDates = useMemo(() => dateSetOf(myCheckins), [myCheckins])
  const doneToday = myDates.has(todayStr)
  const streak = currentStreak(myDates, todayStr)
  const status = weekStatus(myDates, todayStr, group?.targetDays ?? 5)
  const weekStartStr = weekStart(todayStr)
  const yesterdayStr = addDays(todayStr, -1)
  const makeupsUsed = myCheckins.filter(
    (c) => c.isMakeup && c.date >= addDays(todayStr, -MAKEUP_WINDOW_DAYS),
  ).length
  const canMakeupYesterday = !myDates.has(yesterdayStr) && makeupsUsed < 1

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 2600)
    return () => clearTimeout(t)
  }, [notice])

  if (loading) return <Spinner />

  if (notFound) {
    return (
      <Shell>
        <div className="pt-20 text-center">
          <p className="font-mono text-sm tracking-widest text-muted uppercase">{code}</p>
          <h1 className="mt-3 text-xl font-bold">没找到这个小组</h1>
          <p className="mt-2 text-sm text-muted">邀请码可能输错了，或者建组的人还没把链接发给你。</p>
          <Link to="/" className="mt-6 inline-block font-mono text-sm text-stamp">
            ← 回首页
          </Link>
        </div>
      </Shell>
    )
  }

  if (!group) return <Spinner />

  if (!self) {
    return (
      <IdentityGate
        groupName={group.name}
        members={members}
        onPick={(m) => {
          setIdentity(code, m.id)
          setSelfId(m.id)
        }}
        onCreate={async (name, emoji) => {
          const m = await db.createMember(code, { groupId: group.id, name, emoji })
          setIdentity(code, m.id)
          setSelfId(m.id)
          reload()
        }}
      />
    )
  }

  // 上面已排除 null，取成局部常量后闭包里也不用再判空
  const me = self
  const grp = group

  function openSheet(date: string, checkin: Checkin | null) {
    setSheetDate(date)
    setExercise(checkin?.exercise ?? null)
    setMinutes(checkin?.minutes ?? null)
    setNote(checkin?.note ?? '')
    setWeightInput('')
  }

  async function stamp(date: string, isMakeup: boolean) {
    setBusy(true)
    try {
      const created = await db.upsertCheckin(code, { memberId: me.id, date, isMakeup })
      setCheckins((prev) => [...prev.filter((c) => c.id !== created.id), created])
      openSheet(date, created)
      reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '打卡没保存成功，再试一次')
    } finally {
      setBusy(false)
    }
  }

  function handleCell(member: Member, date: string, checkin: Checkin | null) {
    if (member.id !== me.id) {
      navigate(`/g/${code}/m/${member.id}`)
      return
    }
    if (checkin) {
      openSheet(date, checkin)
      return
    }
    if (date === todayStr) {
      void stamp(date, false)
      return
    }
    if (date === yesterdayStr) {
      if (makeupsUsed >= 1) {
        setNotice('7 天内的补卡机会用完了，今天的别再忘')
        return
      }
      void stamp(date, true)
      return
    }
    setNotice('只能补昨天的卡，更早的补不了')
  }

  async function saveDetails() {
    if (!sheetDate) return
    setBusy(true)
    try {
      await db.upsertCheckin(code, {
        memberId: me.id,
        date: sheetDate,
        exercise,
        minutes,
        note: note.trim() || null,
      })
      const kg = Number(weightInput)
      if (weightInput.trim() && kg > 20 && kg < 300) {
        await db.upsertWeight(code, me.id, sheetDate, kg)
        // 第一次记体重就当作起始体重，减重百分比才有基准
        if (me.startWeight == null) await db.updateMember(code, me.id, { startWeight: kg })
      }
      setSheetDate(null)
      setNotice('已记下')
      reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  async function undoCheckin() {
    if (!sheetDate) return
    const target = myCheckins.find((c) => c.date === sheetDate)
    if (!target) return
    setBusy(true)
    try {
      await db.deleteCheckin(code, target.id)
      setCheckins((prev) => prev.filter((c) => c.id !== target.id))
      setSheetDate(null)
      setNotice('已撤销这天的打卡')
      reload()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '撤销失败')
    } finally {
      setBusy(false)
    }
  }

  async function copyInvite() {
    const url = groupInviteUrl(code)
    try {
      await navigator.clipboard.writeText(`来一起打卡：${grp.name}\n${url}`)
      setNotice('邀请链接已复制，发到群里')
    } catch {
      setNotice(url)
    }
  }

  const sheetCheckin = sheetDate ? myCheckins.find((c) => c.date === sheetDate) : undefined

  return (
    <Shell>
      <header className="flex items-start justify-between pt-8">
        <div className="min-w-0">
          <Label>{group.name}</Label>
          <button
            onClick={copyInvite}
            className="mt-1 flex items-center gap-1.5 font-mono text-xs tracking-[0.25em] text-muted"
          >
            {code}
            <span className="tracking-normal text-stamp">复制邀请</span>
          </button>
        </div>
        <Link
          to={`/g/${code}/me`}
          className="shrink-0 rounded-full border border-rule px-3 py-1.5 font-mono text-[11px] tracking-widest text-muted uppercase"
        >
          我的
        </Link>
      </header>

      <div className="mt-5 flex items-end justify-between border-b border-rule pb-3">
        <div className="min-w-0 pr-3">
          <Label>本周进度</Label>
          <p className="mt-1 text-sm leading-snug">{statusText(status)}</p>
        </div>
        <p className="shrink-0 font-mono text-3xl leading-none font-bold">
          {status.count}
          <span className="text-lg text-muted">/{status.target}</span>
        </p>
      </div>

      <StampButton
        done={doneToday}
        streak={streak}
        busy={busy}
        onStamp={() => void stamp(todayStr, false)}
        onEdit={() => openSheet(todayStr, sheetCheckin ?? null)}
      />

      {/* 周一时昨天属于上一周，格子不在画面上，所以补卡入口放在这里而不是只藏在格子里 */}
      {canMakeupYesterday && (
        <button
          onClick={() => void stamp(yesterdayStr, true)}
          className="mt-2 w-full py-1.5 text-center text-xs text-muted active:text-ink"
        >
          昨天练了但忘了打卡？<span className="text-stamp">补一次</span>
          <span className="font-mono"> · 7 天限 1 次</span>
        </button>
      )}

      <CheckinWall
        members={members}
        checkins={checkins}
        selfId={me.id}
        weekStartStr={weekStartStr}
        todayStr={todayStr}
        targetDays={grp.targetDays}
        onCell={handleCell}
        onMember={(m) => navigate(`/g/${code}/m/${m.id}`)}
      />

      <Leaderboard
        members={members}
        progress={progress}
        selfId={me.id}
        onMember={(m) => navigate(`/g/${code}/m/${m.id}`)}
        onRecordWeight={() => openSheet(todayStr, sheetCheckin ?? null)}
      />

      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
        点名字看某人的曲线 · 最后一列是上周达标天数
        {group.minMinutes > 0 && ` · 本组约定单次 ≥ ${group.minMinutes} 分钟`}
      </p>
      <DemoBanner />
      {error && <p className="mt-3 text-center text-xs text-stamp">{error}</p>}

      <Sheet
        open={sheetDate !== null}
        onClose={() => setSheetDate(null)}
        title={sheetCheckin ? '补充今天的细节' : '这一天'}
        subtitle={sheetDate ? shortLabel(sheetDate) : undefined}
      >
        <div className="space-y-5">
          <div>
            <Label>练了什么（可跳过）</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXERCISES.map((e) => (
                <Chip
                  key={e}
                  active={e === exercise}
                  onClick={() => setExercise(e === exercise ? null : e)}
                >
                  {e}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <Label>多久</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {MINUTE_CHOICES.map((m) => (
                <Chip key={m} active={m === minutes} onClick={() => setMinutes(m === minutes ? null : m)}>
                  {m} 分
                </Chip>
              ))}
            </div>
          </div>
          <TextField label="一句话（可跳过）" value={note} onChange={setNote} placeholder="今天跑得挺轻松" maxLength={40} />
          {sheetDate === todayStr && (
            <TextField
              label={me.startWeight == null ? '今日体重（第一次记就是起始体重）' : '今日体重'}
              value={weightInput}
              onChange={(v) => setWeightInput(v.replace(/[^0-9.]/g, ''))}
              placeholder="早上空腹称"
              suffix="kg"
              inputMode="decimal"
            />
          )}
          <PrimaryButton disabled={busy} onClick={() => void saveDetails()}>
            {busy ? '保存中…' : '保存'}
          </PrimaryButton>
          {sheetCheckin && (
            <button
              onClick={() => void undoCheckin()}
              className="w-full py-1 text-center text-sm text-stamp"
            >
              撤销这天的打卡
            </button>
          )}
        </div>
      </Sheet>

      {notice && (
        <div className="fade-in pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-6">
          <p className="max-w-full rounded-full bg-ink px-4 py-2 text-center text-sm text-paper shadow-lg">
            {notice}
          </p>
        </div>
      )}
    </Shell>
  )
}

function statusText(s: ReturnType<typeof weekStatus>): string {
  switch (s.kind) {
    case 'done':
      return `目标已达成，剩下的都是白赚`
    case 'onTrack':
      return `还差 ${s.need} 天 · 本周还剩 ${s.left} 天`
    case 'atRisk':
      return `还差 ${s.need} 天，剩下 ${s.left} 天一天都不能漏`
    case 'failed':
      return `本周已经补不回来了，下周一重开`
  }
}
