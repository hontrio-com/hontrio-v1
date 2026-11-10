'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, Scale } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { SectionHeader } from './section'

// =============================================
// De ce Hontrio: două comenzi venite din aceeași campanie, amândouă cu ROAS 4
// în Google Ads. Bonurile lor se tipăresc pe măsură ce derulezi (în pași, ca
// la o imprimantă termică) și arată ce rămâne după TVA, costul produsului și
// reclamă: lampa îți lasă bani, căștile te costă. Pe fiecare bon cade o
// ștampilă, iar dedesubt stă pragul de profit al produsului și ce face Hontrio.
// Calculul e cel din calculator: prag = (1 + TVA) ÷ marjă.
// =============================================

const VAT = 0.21
const ROAS = 4
/** Câți pași face hârtia până iese tot bonul. */
const FEED_STEPS = 32

type Order = { id: 'lamp' | 'headphones'; number: number; ron: [number, number]; eur: [number, number] }
/** Prețul cu TVA și costul produsului, în lei și în euro. */
const ORDERS: Order[] = [
  { id: 'lamp', number: 10482, ron: [189, 85], eur: [39, 17.5] },
  { id: 'headphones', number: 10483, ron: [349, 229], eur: [69, 45.3] },
]

function breakdown(price: number, cost: number) {
  const net = price / (1 + VAT)
  const ad = price / ROAS
  return { vat: price - net, ad, left: net - cost - ad, breakEven: (1 + VAT) / ((net - cost) / net) }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Marginea de jos a bonului, rupt în zigzag. */
const TORN_EDGE = {
  WebkitMask: 'linear-gradient(#000 0 0) top / 100% calc(100% - 9px) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom / 14px 9px repeat-x',
  mask: 'linear-gradient(#000 0 0) top / 100% calc(100% - 9px) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom / 14px 9px repeat-x',
}

/** Codul de bare de pe bon, același pentru același număr de comandă. */
function Barcode({ seed }: { seed: number }) {
  const widths = Array.from({ length: 44 }, (_, i) => 1 + ((seed * (i + 7) * 31 + i * i) % 3))
  const total = widths.reduce((a, b) => a + b, 0)
  const bars: { x: number; w: number }[] = []
  widths.reduce((x, w, i) => { if (i % 2 === 0) bars.push({ x, w }); return x + w }, 0)
  return (
    <svg viewBox={`0 0 ${total} 36`} preserveAspectRatio="none" className="mx-auto h-9 w-[82%]" aria-hidden>
      {bars.map(b => <rect key={b.x} x={b.x} width={b.w} height="36" fill="#1c1c1c" />)}
    </svg>
  )
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <p className={cn('flex items-baseline justify-between gap-4', strong && 'font-bold text-neutral-950')}>
      <span className="truncate">{label}</span><span className="shrink-0 tabular-nums">{value}</span>
    </p>
  )
}

const Dashes = () => <div aria-hidden className="my-3 border-t border-dashed border-neutral-300" />

function Receipt({ order, index }: { order: Order; index: number }) {
  const { t, locale, intlLocale } = useT()
  const reduce = useReducedMotion()
  const column = useRef<HTMLDivElement>(null)
  // Fiecare bon se tipărește cât coloana lui urcă în ecran (pe telefon sunt unul sub altul)
  const { scrollYProgress } = useScroll({ target: column, offset: ['start 0.92', 'end 0.78'] })
  const start = index * 0.06
  const feed = useTransform(scrollYProgress, v => {
    const k = clamp01((v - start) / 0.68)
    return `${-100 + (Math.floor(k * FEED_STEPS) / FEED_STEPS) * 100}%`
  })
  const stamp = [0.78 + index * 0.04, 0.84 + index * 0.04]
  const stampOpacity = useTransform(scrollYProgress, stamp, [0, 1])
  const stampScale = useTransform(scrollYProgress, stamp, [1.7, 1])
  const noteOpacity = useTransform(scrollYProgress, [0.86, 0.96], [0, 1])

  const euro = locale !== 'ro'
  const [price, cost] = euro ? order.eur : order.ron
  const b = breakdown(price, cost)
  const loss = b.left < 0
  const num = (n: number) => new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
  const currency = euro ? 'EUR' : 'RON' // i18n-ignore: coduri de monedă

  return (
    <div ref={column} className="flex flex-col items-center">
      {/* Ce vede Google Ads: același ROAS la ambele */}
      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/site/logos/google-ads.svg" alt="" className="h-3.5 w-auto" />
        <span className="text-neutral-500">Google Ads</span>{/* i18n-ignore: nume de produs */}
        <span className="font-semibold text-neutral-950 tabular-nums">ROAS {num(ROAS)}</span>{/* i18n-ignore: termen Google Ads */}
      </span>

      <div className="relative mt-5 w-full max-w-[320px]">
        {/* Imprimanta */}
        <div aria-hidden className="relative z-10 h-5 rounded-full bg-[#121212] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_20px_-10px_rgba(0,0,0,0.7)]">
          <div className="absolute inset-x-6 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-black" />
        </div>

        {/* Bonul iese din imprimantă */}
        <div className="relative -mt-2 overflow-hidden px-3 pb-6">
          <motion.div style={{ y: reduce ? '0%' : feed }} className="relative [filter:drop-shadow(0_12px_14px_rgba(0,0,0,0.13))]">
            <div style={TORN_EDGE} className="bg-[#fffffb] px-5 pb-9 pt-6 font-mono text-[12.5px] leading-[1.75] text-neutral-700">
              <p className="text-center text-[13px] font-bold tracking-[0.2em] text-neutral-950">{t('site.why_store')}</p>
              <p className="text-center">{t('site.why_order', { n: order.number })}</p>
              <p className="text-center">{t('site.why_source')}</p>
              <Dashes />
              <Line label={t(`site.why_${order.id}`)} value={num(price)} strong />
              <Dashes />
              <Line label={t('site.why_vat')} value={`−${num(b.vat)}`} />
              <Line label={t('site.why_cost')} value={`−${num(cost)}`} />
              <Line label={t('site.why_ad', { roas: ROAS })} value={`−${num(b.ad)}`} />
              <Dashes />
              <p className="flex items-baseline justify-between gap-3 text-neutral-950">
                <span className="font-bold uppercase tracking-[0.08em]">{t('site.why_left')}</span>
                <span className="text-[16px] font-bold tabular-nums">{loss ? '−' : '+'}{num(Math.abs(b.left))} {currency}</span>
              </p>
              {/* Locul ștampilei, sub total (nu acoperă cifrele) */}
              <div className="relative h-16">
                <motion.span style={{ opacity: stampOpacity, scale: reduce ? 1 : stampScale, rotate: loss ? 7 : -8, x: '-50%', y: '-50%' }}
                  className={cn('pointer-events-none absolute left-1/2 top-1/2 block rounded-md border-[3px] px-3.5 py-1.5 font-sans text-[21px] font-black uppercase leading-none tracking-[0.16em] mix-blend-multiply',
                    loss ? 'border-red-600 text-red-600' : 'border-emerald-700 text-emerald-700')}>
                  <span className="block rounded-[3px] px-1 py-0.5 shadow-[0_0_0_2px_currentColor]">{loss ? t('site.why_stamp_loss') : t('site.why_stamp_profit')}</span>
                </motion.span>
              </div>
              <Dashes />
              <Barcode seed={order.number} />
              <p className="mt-1 text-center text-[11px] tracking-[0.35em] text-neutral-500">{order.number}</p>
            </div>

          </motion.div>
        </div>
      </div>

      {/* Ce știe Hontrio despre produs */}
      <motion.p style={{ opacity: reduce ? 1 : noteOpacity }} className="mt-1 max-w-[300px] text-center text-[14.5px] leading-relaxed text-neutral-600">
        <span className="font-semibold text-neutral-950">{t('site.why_breakeven', { value: num(b.breakEven) })}</span>{' '}
        {t(`site.why_note_${order.id}`)}
      </motion.p>
    </div>
  )
}

export function Why() {
  const { t } = useT()
  return (
    <section className="px-5 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeader badge={t('site.why_badge')} icon={<Scale />} titleA={t('site.why_title_a')} titleB={t('site.why_title_b')} desc={t('site.why_desc')} />

        <div className="relative mx-auto mt-14 max-w-4xl overflow-hidden rounded-[2rem] bg-neutral-100 px-5 pb-10 pt-10 sm:px-10 md:mt-16">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(0,0,0,0.07)_1px,transparent_1.2px)] [background-size:18px_18px]" />
          <div className="relative grid grid-cols-1 gap-12 sm:grid-cols-2 sm:gap-8">
            {ORDERS.map((o, i) => <Receipt key={o.id} order={o} index={i} />)}
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-5 text-center">
          <p className="text-pretty text-[16px] leading-relaxed text-neutral-600 sm:text-[17px]">{t('site.why_bottom')}</p>
          <Link href="#calculator" className="group inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:border-black">
            {t('site.why_cta')}<ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}

