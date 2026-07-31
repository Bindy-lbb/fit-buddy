import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { isDemoMode } from '../lib/db'

export const EMOJIS = ['🐣', '🐬', '🐺', '🥝', '🦊', '🐧', '🦈', '🌵', '🍉', '🐳', '🍋', '🦌']

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <div className="mx-auto w-full max-w-[430px] px-4 pb-12">{children}</div>
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-rule bg-card ${className}`}>{children}</div>
  )
}

/** 小标签：全大写等宽，考勤卡上的印刷字 */
export function Label({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10px] tracking-[0.18em] text-muted uppercase">{children}</div>
  )
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'border-ink bg-ink text-paper'
          : 'border-rule bg-card text-muted active:border-ink active:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  inputMode,
  maxLength,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  suffix?: string
  inputMode?: 'text' | 'decimal'
  maxLength?: number
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <div className="mt-1.5 flex items-baseline gap-2 border-b border-rule pb-1.5 focus-within:border-ink">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          maxLength={maxLength}
          className="w-full bg-transparent text-lg outline-none placeholder:text-muted/60"
        />
        {suffix && <span className="font-mono text-sm text-muted">{suffix}</span>}
      </div>
    </label>
  )
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-lg bg-ink py-3.5 text-base font-semibold text-paper transition-transform active:scale-[0.99] disabled:opacity-40"
    >
      {children}
    </button>
  )
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="font-mono text-xs tracking-widest text-muted uppercase active:text-ink"
    >
      ← {children}
    </Link>
  )
}

/** 演示模式提示：说清现状，并给出下一步怎么做，而不是只报告状态 */
export function DemoBanner() {
  if (!isDemoMode) return null
  return (
    <div className="mt-3 rounded-lg border border-dashed border-stamp/50 bg-stamp-soft/40 px-3 py-2">
      <p className="text-xs leading-relaxed text-ink/80">
        <span className="font-semibold text-stamp">演示模式</span>
        ：数据只存在这台设备，朋友之间还看不到彼此。示例成员是假的。
        <br />
        配好 <span className="font-mono">.env.local</span> 里的 Supabase 两个变量后重启，就能真正多人共享。
      </p>
    </div>
  )
}

export function Spinner({ text = '加载中' }: { text?: string }) {
  return (
    <div className="flex h-dvh items-center justify-center">
      <div className="font-mono text-xs tracking-[0.2em] text-muted uppercase">{text}…</div>
    </div>
  )
}
