'use client'

import { useT } from '@/lib/i18n/context'
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
    <>
      {result.overlap.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-[12px] font-medium text-neutral-800">{t('campaigns.overlap_question', { count: String(result.overlap.length) })}</legend>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            {result.campaigns.filter(c => result.overlap.includes(c.id)).map(c => c.name).join(', ')}
          </p>
          {(['pause', 'keep'] as const).map(v => (
            <label key={v} className="flex items-start gap-2 text-[12px] text-neutral-700 cursor-pointer">
              <input type="radio" name="overlap" checked={overlap === v} onChange={() => onOverlap(v)} className="mt-0.5" />
              <span><span className="font-medium">{t(`campaigns.overlap_${v}`)}</span> — {t(`campaigns.overlap_${v}_hint`)}</span>
            </label>
          ))}
        </fieldset>
      )}
      {result.eu_undeclared.length > 0 && (
        <label className="flex items-start gap-2 text-[12px] text-neutral-700 cursor-pointer">
          <input type="checkbox" checked={declareEu} onChange={e => onDeclareEu(e.target.checked)} className="mt-0.5" />
          <span>{t('campaigns.eu_confirm', { count: String(result.eu_undeclared.length) })}</span>
        </label>
      )}
    </>
  )
}
