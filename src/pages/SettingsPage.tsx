import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as db from '../lib/db'
import { clearIdentity, getIdentity } from '../lib/identity'
import { groupInviteUrl } from '../lib/links'
import { useGroupData } from '../lib/useGroupData'
import {
  BackLink,
  Card,
  Chip,
  DemoBanner,
  EMOJIS,
  Label,
  PrimaryButton,
  Shell,
  Spinner,
  TextField,
} from '../components/ui'

export default function SettingsPage() {
  const code = (useParams().code ?? '').toUpperCase()
  const navigate = useNavigate()
  const { members, loading, group, reload } = useGroupData(code)
  const selfId = getIdentity(code)
  const me = members.find((m) => m.id === selfId) ?? null

  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(EMOJIS[0])
  const [startWeight, setStartWeight] = useState('')
  const [targetWeight, setTargetWeight] = useState('')
  const [showWeight, setShowWeight] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!me) return
    setName(me.name)
    setEmoji(me.emoji)
    setStartWeight(me.startWeight?.toString() ?? '')
    setTargetWeight(me.targetWeight?.toString() ?? '')
    setShowWeight(me.showWeight)
  }, [me])

  if (loading) return <Spinner />
  if (!group || !me) {
    return (
      <Shell>
        <div className="pt-20 text-center">
          <p className="text-sm text-muted">还没选择身份</p>
          <button onClick={() => navigate(`/g/${code}`)} className="mt-4 font-mono text-sm text-stamp">
            ← 回小组
          </button>
        </div>
      </Shell>
    )
  }

  // 上面已排除 null，取成局部常量后闭包里也不用再判空
  const grp = group
  const self = me

  const parse = (v: string) => {
    const n = Number(v)
    return v.trim() && n > 20 && n < 300 ? n : null
  }

  async function save() {
    setBusy(true)
    try {
      await db.updateMember(code, self.id, {
        name: name.trim() || self.name,
        emoji,
        startWeight: parse(startWeight),
        targetWeight: parse(targetWeight),
        showWeight,
      })
      reload()
      setNotice('已保存')
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  async function copyInvite() {
    const url = groupInviteUrl(code)
    try {
      await navigator.clipboard.writeText(`来一起打卡：${grp.name}\n${url}`)
      setNotice('邀请链接已复制')
    } catch {
      setNotice(url)
    }
  }

  return (
    <Shell>
      <div className="pt-8">
        <BackLink to={`/g/${code}`}>打卡墙</BackLink>
      </div>
      <h1 className="mt-4 text-2xl font-bold">我的设置</h1>

      <Card className="mt-5 space-y-6 px-4 py-5">
        <TextField label="昵称" value={name} onChange={setName} maxLength={12} />
        <div>
          <Label>头像</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {EMOJIS.map((e) => (
              <Chip key={e} active={e === emoji} onClick={() => setEmoji(e)}>
                <span className="text-base">{e}</span>
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="起始体重"
            value={startWeight}
            onChange={(v) => setStartWeight(v.replace(/[^0-9.]/g, ''))}
            suffix="kg"
            inputMode="decimal"
            placeholder="62.0"
          />
          <TextField
            label="目标体重"
            value={targetWeight}
            onChange={(v) => setTargetWeight(v.replace(/[^0-9.]/g, ''))}
            suffix="kg"
            inputMode="decimal"
            placeholder="56.0"
          />
        </div>
        <button
          onClick={() => setShowWeight((v) => !v)}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium">公开体重数字</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted">
              默认关闭。关掉也不影响排行 —— 减重百分比始终公开，只是别人看不到你的公斤数。
            </span>
          </span>
          <span
            className={`mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
              showWeight ? 'border-stamp bg-stamp' : 'border-rule bg-rule/40'
            }`}
          >
            <span
              className={`h-4 w-4 rounded-full bg-card transition-transform ${
                showWeight ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </span>
        </button>
        <PrimaryButton disabled={busy} onClick={() => void save()}>
          {busy ? '保存中…' : '保存'}
        </PrimaryButton>
      </Card>

      <Card className="mt-4 divide-y divide-rule/60">
        <div className="px-4 py-3.5">
          <Label>小组</Label>
          <p className="mt-1 text-sm">
            {group.name} · 每周 {group.targetDays} 天
            {group.minMinutes > 0 ? ` · 单次 ≥ ${group.minMinutes} 分钟` : ''}
          </p>
        </div>
        <button onClick={copyInvite} className="w-full px-4 py-3.5 text-left">
          <span className="text-sm">复制邀请链接</span>
          <span className="ml-2 font-mono text-xs tracking-[0.2em] text-muted">{code}</span>
        </button>
        <button
          onClick={() => {
            clearIdentity(code)
            navigate(`/g/${code}`)
          }}
          className="w-full px-4 py-3.5 text-left text-sm text-stamp"
        >
          我不是 {me.name}，换个身份
        </button>
      </Card>

      <DemoBanner />

      {notice && (
        <div className="fade-in pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-6">
          <p className="rounded-full bg-ink px-4 py-2 text-sm text-paper shadow-lg">{notice}</p>
        </div>
      )}
    </Shell>
  )
}
