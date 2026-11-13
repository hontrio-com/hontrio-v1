'use client'

import Link from 'next/link'
import { useId, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Store } from 'lucide-react'
import { cn } from '@/lib/utils'
import { feeShare, monthlyFee, pricingTier, type PricingCurrency } from '@/lib/pricing'
import { Reveal } from '../fx'
import { TITLE, TITLE_SIZE, TwoTone } from '../section'
import { IsoFilters } from '../iso/primitives'
import { MoneyScene, PLATE } from './money-scene'
import { primaryPill, Shine } from '../header'
import { useTeaserMoney } from './shared'

// =============================================
// Prețurile, pe prima pagină (#pricing; pagina separată /pricing nu mai există,
// la cererea proprietarului, 14.11.2026): „Unde merg banii”, o lună a unui
// magazin, ca exemplu. Hontrio aduce vânzări de 50.000 de lei; reclamele (aici,
// o cincime din vânzări) se plătesc direct la Google, iar Hontrio ia 2%. Se
// poate alege și o lună mai mică (20.000) sau una sub pragul gratuit (4.000).
// În dreapta, banii ca teancuri izometrice, la aceeași scară; în stânga,
// aceleași sume pe rânduri, apoi grila întreagă pe un rând și butonul de cont.
// Regulile de numărare sunt în Termeni, la articolul 9.
// =============================================

/** Vânzările lunilor din exemplu; implicit, cea mare (50.000 de lei / 10.000 €). */
const EXAMPLES: Record<PricingCurrency, number[]> = { RON: [4000, 20000, 50000], EUR: [800, 4000, 10000] }
/** Un strat (o placă) din ilustrație: 5.000 de lei sau 1.000 €, aceeași scară în toate exemplele; scrisă și pe ilustrație. */
const PLATE_VALUE: Record<PricingCurrency, number> = { RON: 5000, EUR: 1000 }
/** Reclamele din exemplu: o cincime din vânzări (cifre de exemplu, nu rezultate promise). */
const adsFor = (sales: number) => Math.round(sales / 5)

export function PriceTeaser() {
  const { t, currency, grid, number, money } = useTeaserMoney()
  const reduce = useReducedMotion()
  const uid = useId()
  const examples = EXAMPLES[currency]
  const [pick, setPick] = useState(examples.length - 1)

  const sales = examples[pick]
  const ads = adsFor(sales)
  const fee = monthlyFee(sales, currency)
  const tier = pricingTier(sales, currency)
  const scale = (value: number) => (value / PLATE_VALUE[currency]) * PLATE
  // Luna gratuită: suma din dreapta spune deja „Gratuit”, rândul spune de ce
  const feeText = tier === 'free' ? t('site.pricing_calc_free', { limit: money(grid.freeUpTo) })
    : tier === 'flat' ? t('site.ptzc_fee_flat', { share: number(feeShare(sales, currency)) })
    : t('site.ptz_fee_percent', { percent: number(grid.percent) })

  const rows: { id: string; icon: ReactNode; title: string; text: string; amount: string }[] = [
    { id: 'sales', icon: <Store className="size-[18px]" strokeWidth={1.8} />, title: t('site.ptzc_sales_title'), text: t('site.ptzc_sales_text'), amount: money(sales) },
    {
      id: 'ads',
      // eslint-disable-next-line @next/next/no-img-element
      icon: <img src="/site/logos/google-ads.svg" alt="" className="h-[15px] w-auto brightness-0" />,
      title: t('site.ptzc_ads_title'), text: t('site.ptzc_ads_text'), amount: money(ads),
    },
    {
      id: 'fee',
      // eslint-disable-next-line @next/next/no-img-element
      icon: <img src="/logo-icon.png" alt="" className="h-[17px] w-auto" />,
      title: t('site.ptzc_fee_title'), text: feeText, amount: fee === 0 ? t('site.pricing_free') : money(fee),
    },
  ]

  return (
    <section id="pricing" className="scroll-mt-24 px-5 py-24 md:py-32">
      <IsoFilters />
      {/* Pe telefon: titlul, alegerea lunii, ilustrația chiar sub ea, apoi sumele; pe ecranele mari, ilustrația stă în dreapta */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 [grid-template-areas:'head'_'pick'_'art'_'legend'] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:grid-rows-[auto_auto_1fr] lg:gap-x-16 lg:[grid-template-areas:'head_head'_'pick_art'_'legend_art']">
        <Reveal className="mb-10 [grid-area:head] lg:mb-14">
          {/* Mărimea înaintea literei: altfel tailwind-merge scoate leading-[1.06] din TITLE */}
          <h2 className={cn('text-balance', TITLE_SIZE, TITLE)}>
            <TwoTone a={t('site.ptz_title_a')} b={t('site.ptz_title_b')} lineBreak />
          </h2>
          <p className="mt-5 max-w-xl text-pretty text-[16px] leading-relaxed text-neutral-500 sm:text-[17px]">{t('site.ptzc_desc')}</p>
        </Reveal>

        {/* Ilustrația: teancurile, pe negru, ca în „Cum funcționează” */}
        <Reveal delay={0.1} className="mb-8 [grid-area:art] lg:mb-0 lg:self-start">
          <div className="relative overflow-hidden rounded-[1.75rem] bg-black sm:rounded-[2rem]">
            <MoneyScene label={t('site.ptzc_art', { sales: money(sales), ads: money(ads), fee: money(fee) })}
              salesName={t('site.ptzc_art_sales')} sales={money(sales)} ads={money(ads)}
              fee={fee === 0 ? t('site.pricing_free') : money(fee)}
              heights={{ sales: scale(sales), ads: scale(ads), fee: fee === 0 ? 0 : Math.max(1.2, scale(fee)) }} />
            {/* Scara, ca la un grafic: teancurile se compară cinstit */}
            <p aria-hidden className="absolute bottom-4 left-5 text-[12px] tabular-nums text-white/40 sm:bottom-5 sm:left-6">
              {t('site.ptzc_art_scale', { value: money(PLATE_VALUE[currency]) })}
            </p>
          </div>
        </Reveal>

        {/* Exemplul: trei luni de mărimi diferite */}
        <Reveal delay={0.06} className="mb-6 [grid-area:pick] lg:mb-0">
          <p id={`${uid}-pick`} className="text-[14px] text-neutral-500">{t('site.ptzc_example')}</p>
          <div role="group" aria-labelledby={`${uid}-pick`} className="mt-3 flex gap-7 border-b border-line">
            {examples.map((value, i) => {
              const on = i === pick
              return (
                <button key={value} type="button" aria-pressed={on} onClick={() => setPick(i)}
                  className={cn('relative -mb-px rounded-sm pb-3 text-[15.5px] font-semibold tabular-nums tracking-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950',
                    on ? 'text-neutral-950' : 'text-neutral-400 hover:text-neutral-700')}>
                  {money(value)}
                  {on && (
                    <motion.span layoutId={`${uid}-pick-line`} aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-neutral-950"
                      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42 }} />
                  )}
                </button>
              )
            })}
          </div>
        </Reveal>

        <Reveal delay={0.14} className="[grid-area:legend]">
          <ul className="lg:mt-2" aria-live="polite">
            {rows.map(row => (
              <li key={row.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] gap-x-3 border-b border-line py-4 last:border-0">
                <span aria-hidden className="grid h-6 place-items-start pt-0.5 text-neutral-950">{row.icon}</span>
                <div>
                  <h3 className="text-[16px] font-semibold tracking-tight text-neutral-950">{row.title}</h3>
                  <p className="mt-1 text-pretty text-[14.5px] leading-relaxed text-neutral-500">{row.text}</p>
                </div>
                <p className="whitespace-nowrap text-right text-[17px] font-semibold tabular-nums tracking-tight text-neutral-950">{row.amount}</p>
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-line pt-5">
            <p className="text-pretty text-[13.5px] leading-relaxed text-neutral-500">{t('site.ptzc_note')} {t('site.pricing_vat')}</p>
            <p className="mt-2 text-pretty text-[13.5px] leading-relaxed text-neutral-500">{t('site.ptz_launch')}</p>
            {/* Grila întreagă, pe un rând, și butonul de cont */}
            <p className="mt-5 text-pretty text-[15px] font-semibold leading-relaxed text-neutral-950">
              {t('site.prc_grid_line', { free: money(grid.freeUpTo), flat: money(grid.flatFee), to: money(grid.flatUpTo), percent: number(grid.percent) })}
            </p>
            <Link href="/register" className={cn(primaryPill, 'mt-6 h-12 px-7 text-[15px]')}>
              <Shine /><span className="relative">{t('site.cta_primary')}</span>
              <ArrowRight className="relative size-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
