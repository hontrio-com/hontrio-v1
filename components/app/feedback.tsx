'use client'

import type { ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'

// =============================================
// Mesajele pe pagină: o notă (informație, reușită, atenție, problemă), o
// stare goală (nimic încă: ce înseamnă și ce faci) și scheletul de încărcare.
// =============================================

type CalloutTone = 'info' | 'success' | 'warning' | 'danger'

const CALLOUT: Record<CalloutTone, { box: string; icon: string; Icon: typeof Info }> = {
  info: { box: 'bg-neutral-50 border-neutral-200 text-neutral-700', icon: 'text-neutral-400', Icon: Info },
  success: { box: 'bg-emerald-50/70 border-emerald-200/70 text-emerald-900', icon: 'text-emerald-600', Icon: CheckCircle2 },
  warning: { box: 'bg-amber-50/70 border-amber-200/70 text-amber-900', icon: 'text-amber-600', Icon: AlertTriangle },
  danger: { box: 'bg-red-50/70 border-red-200/70 text-red-800', icon: 'text-red-500', Icon: AlertCircle },
}

export function Callout({ tone = 'info', title, children, action, onClose, className }: {
  tone?: CalloutTone; title?: ReactNode; children?: ReactNode; action?: ReactNode; onClose?: () => void; className?: string
}) {
  const { t } = useT()
  const s = CALLOUT[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-2xl border px-4 py-3', s.box, className)}>
      <s.Icon className={cn('mt-0.5 size-4 shrink-0', s.icon)} />
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5 opacity-90')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onClose && (
        <button onClick={onClose} className="shrink-0 rounded-md p-0.5 opacity-50 transition-opacity hover:opacity-100" aria-label={t('common.close')}>
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

export function EmptyState({ icon, title, description, action, className }: {
  icon: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="grid size-14 place-items-center rounded-2xl bg-neutral-950 text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.6)] [&_svg]:size-6">{icon}</div>
      <p className="mt-5 text-lg font-semibold tracking-tight text-neutral-950">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-neutral-500">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  )
}

/** Un bloc gri care strălucește cât se încarcă datele, cu forma conținutului. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('rounded-xl bg-[linear-gradient(90deg,#f2f2f2_0%,#e8e8e8_50%,#f2f2f2_100%)] bg-[length:200%_100%] animate-shimmer', className)} />
}
