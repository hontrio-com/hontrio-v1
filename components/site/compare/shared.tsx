'use client'

import type { ReactNode } from 'react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { PRICING, type PricingCurrency } from '@/lib/pricing'
import { Reveal } from '../fx'
import { TITLE, TITLE_SIZE, TwoTone } from '../section'

// =============================================
// Piesele comparației „Singur, cu o agenție sau cu Hontrio?” (compare.tsx): drumurile,
// rândurile, textele lor (cheile site.cmp_*), prețul Hontrio luat din lib/pricing.ts și
// nota de la final. La agenții, totul e
// „de obicei”: prețurile și contractele lor diferă de la una la alta.
// =============================================

export const PATHS = ['solo', 'agency', 'hontrio'] as const
export type Path = (typeof PATHS)[number]

export const ROWS = ['cost', 'cadence', 'budget', 'contract', 'seen', 'time'] as const
export type Row = (typeof ROWS)[number]

/** Grila Hontrio, în moneda paginii: lei în română, euro în engleză (ca la secțiunea de prețuri). */
export function usePrice() {
  const { t, locale, intlLocale } = useT()
  const currency: PricingCurrency = locale === 'ro' ? 'RON' : 'EUR'
  const g = PRICING[currency]
  const number = (value: number) => new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 }).format(value)
  const money = (value: number) => t(currency === 'RON' ? 'site.pricing_money_ron' : 'site.pricing_money_eur', { value: number(value) })
  return { percent: number(g.percent), free: money(g.freeUpTo), fee: money(g.flatFee), upTo: money(g.flatUpTo) }
}

/** Răspunsul unui drum la un rând: textul și, unde e cazul, o precizare dedesubt. */
export function useAnswers() {
  const { t } = useT()
  const price = usePrice()
  return (row: Row, path: Path) => {
    const key = `site.cmp_${row}_${path}`
    return { main: t(key, price), detail: t.has(`${key}_detail`) ? t(`${key}_detail`, price) : null }
  }
}

/**
 * Titlul secțiunii, în cele două tonuri ale paginii (ca SectionHeader), cu întrebarea pe
 * rândul ei de la ecranele mici în sus: „Singur, cu o agenție / sau cu Hontrio?”.
 */
export function CompareHeader({ desc }: { desc?: ReactNode }) {
  const { t } = useT()
  return (
    <Reveal className="mx-auto max-w-4xl text-center">
      <h2 className={cn('text-balance', TITLE_SIZE, TITLE)}>
        <TwoTone a={t('site.cmp_title_a')} b={t('site.cmp_title_b')} lineBreak="sm" />
      </h2>
      <p className="mx-auto mt-5 max-w-xl text-pretty text-[16px] leading-relaxed text-neutral-500 sm:text-[17px]">{desc ?? t('site.cmp_desc')}</p>
    </Reveal>
  )
}

/**
 * Nota de la final: bugetul merge direct la Google, agențiile diferă (`before` o poate spune
 * altfel, atunci propoziția despre agenții nu se repetă), iar acum Hontrio e gratuit.
 */
export function CompareNote({ before, className }: { before?: ReactNode; className?: string }) {
  const { t } = useT()
  return (
    <p className={cn('text-balance text-[13px] leading-relaxed text-neutral-500', className)}>
      {before ? <>{before} {t('site.cmp_note')}</> : <>{t('site.cmp_note')} {t('site.cmp_note_agencies')}</>}{' '}
      <span className="font-medium text-neutral-800">{t('site.cmp_note_launch')}</span>
    </p>
  )
}
