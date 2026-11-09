'use client'

import { Check, Minus, Scale } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { Reveal } from './fx'
import { SectionHeader } from './section'

// =============================================
// De ce Hontrio: o campanie obișnuită față de una construită pe marjă, rând cu
// rând. Coloana Hontrio e cea neagră.
// =============================================

const ROWS = ['target', 'products', 'budget', 'searches', 'reports'] as const

export function Why() {
  const { t } = useT()
  return (
    <section className="px-5 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <SectionHeader align="left" badge={t('site.why_badge')} icon={<Scale />} titleA={t('site.why_title_a')} titleB={t('site.why_title_b')} desc={t('site.why_desc')} />

        <Reveal delay={0.1} className="overflow-hidden rounded-[1.75rem] border border-line bg-white shadow-[var(--shadow-surface)]">
          <div className="grid grid-cols-2 sm:grid-cols-[150px_1fr_1fr]">
            <div className="hidden sm:block" />
            <p className="px-4 py-4 text-[13px] font-semibold text-neutral-500 sm:px-5">{t('site.why_col_usual')}</p>
            <p className="flex items-center gap-2 bg-[#0a0a0a] px-4 py-4 text-[13px] font-semibold text-white sm:px-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-icon.png" alt="" className="size-4 invert" />{t('site.why_col_hontrio')}
            </p>
          </div>
          {ROWS.map((row, i) => (
            <Reveal key={row} delay={0.15 + i * 0.06} y={10} className="grid grid-cols-2 border-t border-line sm:grid-cols-[150px_1fr_1fr]">
              <p className="col-span-2 px-4 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400 sm:col-span-1 sm:px-5 sm:py-4 sm:text-[12.5px] sm:normal-case sm:tracking-normal sm:text-neutral-900">
                {t(`site.why_${row}`)}
              </p>
              <p className="flex items-start gap-2 px-4 py-3 text-[13.5px] leading-snug text-neutral-500 sm:px-5 sm:py-4">
                <Minus className="mt-0.5 size-3.5 shrink-0 text-neutral-300" />{t(`site.why_${row}_usual`)}
              </p>
              <p className="flex items-start gap-2 bg-[#0a0a0a] px-4 py-3 text-[13.5px] font-medium leading-snug text-white sm:px-5 sm:py-4">
                <Check className="mt-0.5 size-3.5 shrink-0" strokeWidth={3} />{t(`site.why_${row}_hontrio`)}
              </p>
            </Reveal>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
