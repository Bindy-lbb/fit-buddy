import { useState } from 'react'

/**
 * 主动作：一次点击完成打卡。
 * 空态就是一个空的印章框，点下去盖章 —— 不需要任何文字说明就知道该干什么。
 */
export function StampButton({
  done,
  streak,
  busy,
  onStamp,
  onEdit,
}: {
  done: boolean
  streak: number
  busy: boolean
  onStamp: () => void
  onEdit: () => void
}) {
  const [hits, setHits] = useState(0)

  if (done) {
    return (
      <button
        onClick={onEdit}
        className="stamp-hit mt-4 flex w-full items-center gap-3 rounded-xl border-2 border-stamp bg-stamp-soft/60 px-4 py-3.5 text-left"
      >
        <span className="stamp flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] text-xl font-bold">
          ✓
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">今天已打卡</span>
          <span className="block font-mono text-xs text-muted">点一下补充运动 / 体重</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-mono text-2xl leading-none font-bold text-stamp">
            {streak}
          </span>
          <span className="block font-mono text-[10px] tracking-widest text-muted uppercase">
            连续天
          </span>
        </span>
      </button>
    )
  }

  return (
    <button
      disabled={busy}
      onClick={() => {
        setHits((n) => n + 1)
        onStamp()
      }}
      className="relative mt-4 flex w-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-stamp/70 bg-stamp-soft/25 py-5 transition-transform active:scale-[0.985] disabled:opacity-60"
    >
      {hits > 0 && (
        <span
          key={hits}
          className="ink-bleed pointer-events-none absolute h-24 w-24 rounded-full bg-stamp/25"
        />
      )}
      <span className="text-xl font-bold text-stamp">今天动了</span>
      <span className="mt-1 font-mono text-[11px] tracking-[0.16em] text-stamp/70 uppercase">
        点一下盖章 · 一步完成
      </span>
      {streak > 0 && (
        <span className="mt-1.5 text-xs text-muted">
          已连续 <span className="font-mono font-bold text-ink">{streak}</span> 天，别断在今天
        </span>
      )}
    </button>
  )
}
