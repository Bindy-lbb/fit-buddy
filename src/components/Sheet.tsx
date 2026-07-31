import type { ReactNode } from 'react'

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <button
        aria-label="关闭"
        onClick={onClose}
        className="absolute inset-0 bg-ink/45 fade-in"
      />
      <div className="sheet-up absolute inset-x-0 bottom-0 mx-auto max-w-[430px] rounded-t-2xl border-t border-rule bg-card px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-rule" />
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 font-mono text-xs text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="font-mono text-xs tracking-widest text-muted uppercase">
            关闭
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
