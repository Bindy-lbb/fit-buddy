import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as db from '../lib/db'
import { getRecentGroups, makeGroupCode, setIdentity } from '../lib/identity'
import { Card, Chip, DemoBanner, EMOJIS, Label, PrimaryButton, Shell, TextField } from '../components/ui'

const TARGET_DAYS = [3, 4, 5, 6, 7]
const MIN_MINUTES = [0, 20, 30, 45]

export default function Landing() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu')
  const [groupName, setGroupName] = useState('')
  const [myName, setMyName] = useState('')
  const [emoji, setEmoji] = useState(EMOJIS[0])
  const [targetDays, setTargetDays] = useState(5)
  const [minMinutes, setMinMinutes] = useState(30)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recent = getRecentGroups()

  async function createGroup() {
    setBusy(true)
    setError(null)
    try {
      const code = makeGroupCode()
      const group = await db.createGroup(code, { name: groupName.trim(), targetDays, minMinutes })
      const me = await db.createMember(code, {
        groupId: group.id,
        name: myName.trim(),
        emoji,
      })
      setIdentity(code, me.id)
      navigate(`/g/${code}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '建组失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <header className="pt-12 pb-8">
        <div className="flex items-end gap-2">
          <span className="stamp flex h-9 w-9 items-center justify-center rounded-[4px] text-lg font-bold">
            ✓
          </span>
          <h1 className="text-3xl leading-none font-bold tracking-tight">打卡墙</h1>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          几个朋友互相看着彼此的运动打卡。
          <br />
          不用注册，链接发进群就能开始。
        </p>
        <DemoBanner />
      </header>

      {mode === 'menu' && (
        <div className="space-y-3">
          {recent.length > 0 && (
            <div className="mb-6">
              <Label>回到小组</Label>
              <div className="mt-2 space-y-2">
                {recent.map((g) => (
                  <button
                    key={g.code}
                    onClick={() => navigate(`/g/${g.code}`)}
                    className="flex w-full items-center justify-between rounded-xl border border-rule bg-card px-4 py-3.5 text-left"
                  >
                    <span className="font-medium">{g.name}</span>
                    <span className="font-mono text-xs tracking-[0.2em] text-muted">{g.code}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => setMode('create')}
            className="w-full rounded-xl border-2 border-dashed border-stamp/70 bg-stamp-soft/25 py-5 text-lg font-bold text-stamp"
          >
            建一个小组
          </button>
          <button
            onClick={() => setMode('join')}
            className="w-full rounded-xl border border-rule bg-card py-4 text-base"
          >
            用邀请码加入
          </button>
        </div>
      )}

      {mode === 'create' && (
        <Card className="space-y-6 px-4 py-5">
          <TextField
            label="小组叫什么"
            value={groupName}
            onChange={setGroupName}
            placeholder="例如：夏天前减十斤"
            maxLength={16}
          />
          <TextField
            label="你的昵称"
            value={myName}
            onChange={setMyName}
            placeholder="朋友们怎么叫你"
            maxLength={12}
          />
          <div>
            <Label>你的头像</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <Chip key={e} active={e === emoji} onClick={() => setEmoji(e)}>
                  <span className="text-base">{e}</span>
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <Label>每周至少练几天</Label>
            <div className="mt-2 flex gap-2">
              {TARGET_DAYS.map((d) => (
                <Chip key={d} active={d === targetDays} onClick={() => setTargetDays(d)}>
                  {d} 天
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <Label>单次至少多久</Label>
            <div className="mt-2 flex gap-2">
              {MIN_MINUTES.map((m) => (
                <Chip key={m} active={m === minMinutes} onClick={() => setMinMinutes(m)}>
                  {m === 0 ? '不限' : `${m} 分`}
                </Chip>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-stamp">{error}</p>}
          <PrimaryButton disabled={!groupName.trim() || !myName.trim() || busy} onClick={createGroup}>
            {busy ? '创建中…' : '创建并进入'}
          </PrimaryButton>
          <button onClick={() => setMode('menu')} className="w-full text-sm text-muted">
            ← 返回
          </button>
        </Card>
      )}

      {mode === 'join' && (
        <Card className="space-y-6 px-4 py-5">
          <label className="block">
            <Label>邀请码</Label>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="ABC234"
              maxLength={6}
              autoCapitalize="characters"
              className="mt-2 w-full border-b border-rule bg-transparent pb-2 text-center font-mono text-3xl tracking-[0.3em] outline-none focus:border-ink placeholder:text-muted/40"
            />
          </label>
          <PrimaryButton
            disabled={joinCode.length !== 6}
            onClick={() => navigate(`/g/${joinCode}`)}
          >
            进入小组
          </PrimaryButton>
          <button onClick={() => setMode('menu')} className="w-full text-sm text-muted">
            ← 返回
          </button>
        </Card>
      )}
    </Shell>
  )
}
