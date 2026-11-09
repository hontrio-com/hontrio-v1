'use client'

import Link from 'next/link'
import { ArrowUpRight, Eye, Lock, Megaphone, PenLine, ShoppingBag, Store } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { Reveal } from './fx'
import { SectionHeader } from './section'

// =============================================
// Ce face Hontrio cu datele: ce citim și ce facem, din magazin, din Google Ads
// și din Merchant Center. E și explicația pe care Google o cere pentru
// accesul la contul de reclame (verificarea aplicației OAuth).
// =============================================

const SOURCES = [
  { id: 'store', icon: Store },
  { id: 'ads', icon: Megaphone },
  { id: 'mc', icon: ShoppingBag },
] as const

const POLICY = 'https://developers.google.com/terms/api-services-user-data-policy'

export function DataUse() {
  const { t } = useT()
  return (
    <section id="data" className="scroll-mt-24 px-5 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeader badge={t('site.data_badge')} icon={<Lock />} titleA={t('site.data_title_a')} titleB={t('site.data_title_b')} desc={t('site.data_desc')} />

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          {SOURCES.map((s, i) => (
            <Reveal key={s.id} delay={0.08 * i} className="flex h-full flex-col rounded-[1.6rem] border border-line bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <span className="grid size-11 place-items-center rounded-2xl bg-black text-white"><s.icon className="size-5" /></span>
              <h3 className="mt-5 text-[17px] font-semibold tracking-tight text-neutral-950">{t(`site.data_${s.id}_title`)}</h3>
              <dl className="mt-4 space-y-4 text-[14px] leading-relaxed">
                <div>
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400"><Eye className="size-3.5" />{t('site.data_read')}</dt>
                  <dd className="mt-1 text-neutral-600">{t(`site.data_${s.id}_read`)}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400"><PenLine className="size-3.5" />{t('site.data_write')}</dt>
                  <dd className="mt-1 text-neutral-600">{t(`site.data_${s.id}_write`)}</dd>
                </div>
              </dl>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2} className="mx-auto mt-8 flex max-w-4xl flex-col gap-4 rounded-[1.4rem] border border-line bg-neutral-50 p-5 text-[13.5px] leading-relaxed text-neutral-600 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="space-y-1.5">
            <p>
              {t('site.data_limited_a')}{' '}
              <a href={POLICY} target="_blank" rel="noopener noreferrer" className="font-semibold text-black underline decoration-neutral-300 underline-offset-[3px] hover:decoration-black">
                Google API Services User Data Policy{/* i18n-ignore */}
              </a>
              {t('site.data_limited_b')}
            </p>
            <p className="text-neutral-500">{t('site.data_revoke')}</p>
          </div>
          <Link href="/legal/privacy" className="inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-line bg-white px-4 py-2 text-[13px] font-semibold text-neutral-900 transition hover:border-black sm:self-center">
            {t('site.data_privacy')}<ArrowUpRight className="size-3.5" />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}
