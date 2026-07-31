import { useState } from 'react'
import type { Member } from '../types'
import { Chip, EMOJIS, Label, PrimaryButton, TextField } from './ui'

/**
 * 没有登录：第一次进来只需要在名单里点自己。
 * 名单本身就是最快的身份识别方式 —— 熟人小组里不需要密码。
 */
export function IdentityGate({
  groupName,
  members,
  onPick,
  onCreate,
}: {
  groupName: string
  members: Member[]
  onPick: (member: Member) => void
  onCreate: (name: string, emoji: string) => Promise<void>
}) {
  const [creating, setCreating] = useState(members.length === 0)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(EMOJIS[0])
  const [busy, setBusy] = useState(false)

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-paper">
      <div className="mx-auto w-full max-w-[430px] px-5 py-10">
        <Label>{groupName}</Label>
        <h1 className="mt-2 text-2xl font-bold">你是哪一位？</h1>
        <p className="mt-1.5 text-sm text-muted">选一次就记住了，之后打开链接直接打卡。</p>

        {!creating && (
          <>
            <div className="mt-6 divide-y divide-rule/60 overflow-hidden rounded-xl border border-rule bg-card">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onPick(m)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-ink/[0.04]"
                >
                  <span className="text-xl">{m.emoji}</span>
                  <span className="flex-1 truncate font-medium">{m.name}</span>
                  <span className="font-mono text-xs text-muted">选我 →</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setCreating(true)}
              className="mt-4 w-full rounded-lg border border-dashed border-rule py-3 text-sm text-muted active:text-ink"
            >
              名单里没有我，我是新人
            </button>
          </>
        )}

        {creating && (
          <div className="mt-6 space-y-5">
            <TextField label="你的昵称" value={name} onChange={setName} placeholder="朋友们怎么叫你" maxLength={12} />
            <div>
              <Label>挑个头像</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {EMOJIS.map((e) => (
                  <Chip key={e} active={e === emoji} onClick={() => setEmoji(e)}>
                    <span className="text-base">{e}</span>
                  </Chip>
                ))}
              </div>
            </div>
            <PrimaryButton
              disabled={!name.trim() || busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await onCreate(name.trim(), emoji)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? '加入中…' : '加入小组'}
            </PrimaryButton>
            {members.length > 0 && (
              <button
                onClick={() => setCreating(false)}
                className="w-full py-1 text-sm text-muted active:text-ink"
              >
                ← 返回名单
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
