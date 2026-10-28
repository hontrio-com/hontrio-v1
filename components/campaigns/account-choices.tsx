'use client'

import { Check } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { ChoiceCard } from '@/components/app/input'
import type { AuditResult } from '@/lib/google/audit'

// =============================================
// Alegerile omului înainte de o lansare, din auditul contului: ce facem cu
// campaniile lui care vând aceleași produse și declarația UE pentru cele
// nedeclarate. Aceleași la campania principală și la grupe.
// =============================================

export type Overlap = 'pause' | 'keep' | null

type Props = {
  result: AuditResult
  overlap: Overlap
  onOverlap: (v: 'pause' | 'keep') => void
  declareEu: boolean
  onDeclareEu: (v: boolean) => void
}

/** Alegerile sunt făcute (sau nu e nimic de ales). */
export function choicesDone(result: AuditResult | null, overlap: Overlap, declareEu: boolean): boolean {
  if (!result) return false
  return (!result.overlap.length || overlap !== null) && (!result.eu_undeclared.length || declareEu)
}

export function AccountChoices({ result, overlap, onOverlap, declareEu, onDeclareEu }: Props) {
  const { t } = useT()
  return (
    <div className="space-y-4">
      {result.overlap.length > 0 && (
        <fieldset>
          <legend className="text-[13px] font-semibold text-neutral-900">{t('campaigns.overlap_question', { count: String(result.overlap.length) })}</legend>
          <p className="mt-0.5 text-[12px] leading-relaxed text-neutral-500">
            {result.campaigns.filter(c => result.overlap.includes(c.id)).map(c => c.name).join(', ')}
          </p>
          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(['pause', 'keep'] as const).map(v => (
              <ChoiceCard key={v} active={overlap === v} onClick={() => onOverlap(v)}
                title={t(`campaigns.overlap_${v}`)} description={t(`campaigns.overlap_${v}_hint`)} />
            ))}
          </div>
        </fieldset>
      )}
      {result.eu_undeclared.length > 0 && (
        <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-3.5 transition-colors',
          declareEu ? 'border-brand-600 ring-1 ring-brand-600' : 'border-neutral-200 hover:border-neutral-300')}>
          <input type="checkbox" checked={declareEu} onChange={e => onDeclareEu(e.target.checked)} className="peer sr-only" />
          <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-[3px] peer-focus-visible:ring-brand-600/25',
            declareEu ? 'border-brand-600 bg-brand-600 text-white' : 'border-neutral-300 bg-white')}>
            {declareEu && <Check className="size-3" strokeWidth={3} />}
          </span>
          <span className="text-[13px] leading-relaxed text-neutral-700">{t('campaigns.eu_confirm', { count: String(result.eu_undeclared.length) })}</span>
        </label>
      )}
    </div>
  )
}
