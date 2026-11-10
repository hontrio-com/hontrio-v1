'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import { Clock, PackageX, SearchX, ShoppingBag, TrendingUp } from 'lucide-react'
import { NumberTicker } from '@/components/app/motion'
import { cn } from '@/lib/utils'
import { BrandsRow, GRADIENT_WORD, H1_CLASS, HeroBadge, HeroCtas, HeroDesc, HeroFacts, Rise, Words } from '../hero'
import { useShop } from './catalog'

// =============================================
// Varianta 4 · „Profit live": titlul e la stânga, cu profitul din reclame
// într-o pastilă neagră care crește. În dreapta, pilotul automat lucrează:
// vin comenzi (profitul din titlu crește cu ele), adaugă cuvinte negative,
// mută bugetul, scoate produsele epuizate.
// =============================================

type Event =
  | { kind: 'order'; product: 'lamp' | 'chandelier' | 'bedside'; ron: number; eur: number }
  | { kind: 'negative' | 'budget' | 'paused' }

const EVENTS: Event[] = [
  { kind: 'order', product: 'lamp', ron: 64, eur: 13 },
  { kind: 'negative' },
  { kind: 'order', product: 'chandelier', ron: 118, eur: 24 },
  { kind: 'budget' },
  { kind: 'order', product: 'bedside', ron: 41, eur: 8 },
  { kind: 'paused' },
]
const ICONS = { order: ShoppingBag, negative: SearchX, budget: TrendingUp, paused: PackageX }
/** „acum", „acum 3 min"… pentru rândurile de sus în jos. */
const AGES = [0, 3, 8, 14]
const VISIBLE = AGES.length
/** Pasul de pornire: lista apare plină. */
const START = VISIBLE - 1
const EVERY = 2700

const profitOf = (e: Event, euro: boolean) => e.kind === 'order' ? (euro ? e.eur : e.ron) : 0
/** Profitul adunat din comenzile pașilor 0…n. */
function earned(n: number, euro: boolean) {
  let sum = 0
  for (let k = 0; k <= n; k++) sum += profitOf(EVENTS[k % EVENTS.length], euro)
  return sum
}
/** Profitul pe ultimele 30 de zile, ca în previzualizarea platformei. */
const BASE = { ron: 3120, eur: 640 }

function GridLines() {
  const id = useId()
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_75%_60%_at_50%_15%,black_20%,transparent_75%)]">
      <svg className="absolute inset-0 size-full text-neutral-200">
        <defs>
          <pattern id={id} width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M64 0H0V64" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  )
}

/** Pastila din titlu: profitul, care crește cu fiecare comandă. */
function ProfitPill({ value }: { value: number }) {
  const { money } = useShop()
  const reduce = useReducedMotion()
  const format = (n: number) => `+${money(n)}`
  return (
    <motion.span initial={reduce ? false : { opacity: 0, scale: 0.7, rotate: -5 }} animate={{ opacity: 1, scale: 1, rotate: -2 }}
      whileHover={{ rotate: 0, scale: 1.04 }} transition={{ type: 'spring', stiffness: 220, damping: 18, delay: reduce ? 0 : 0.45 }}
      className="relative mx-[0.06em] inline-flex h-[0.88em] translate-y-[-0.05em] items-center gap-[0.14em] rounded-full bg-[#0a0a0a] pl-[0.11em] pr-[0.3em] align-middle text-white shadow-[0_18px_40px_-14px_rgba(0,0,0,0.55)] ring-1 ring-black/10">
      <span className="grid size-[0.66em] shrink-0 place-items-center rounded-full bg-white text-black">
        <TrendingUp className="size-[0.36em]" strokeWidth={2.6} />
      </span>
      {/* Lățimea vine de la suma finală (ascunsă), ca titlul să nu se miște cât numără */}
      <span className="grid text-[0.5em] font-bold tracking-[-0.035em] tabular-nums">
        <span aria-hidden className="invisible col-start-1 row-start-1">{format(value)}</span>
        <NumberTicker value={value} format={format} className="col-start-1 row-start-1" />
      </span>
    </motion.span>
  )
}

function FeedItem({ event, age }: { event: Event; age: number }) {
  const { t, money, euro } = useShop()
  const Icon = ICONS[event.kind]
  const isOrder = event.kind === 'order'
  const title = isOrder ? t('site.hero_new_order') : t(`site.hero_live_${event.kind}`)
  const detail = event.kind === 'order'
    ? t('site.hero_live_order_detail', { product: t(`site.prod_${event.product}`), profit: money(profitOf(event, euro)) })
    : t(`site.hero_live_${event.kind}_detail`)
  return (
    <motion.li layout initial={{ opacity: 0, y: -18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className={cn('flex items-start gap-3 rounded-2xl border bg-white p-3.5', age === 0 ? 'border-neutral-300 shadow-[0_14px_30px_-20px_rgba(0,0,0,0.4)]' : 'border-line')}>
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', isOrder ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-700')}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[14px] font-semibold text-neutral-950">{title}</span>
          <span className="shrink-0 text-[11.5px] text-neutral-400">{age === 0 ? t('site.hero_live_now') : t('site.hero_live_ago', { min: AGES[age] })}</span>
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-neutral-500">{detail}</span>
      </span>
    </motion.li>
  )
}

function LiveFeed({ tick }: { tick: number }) {
  const { t } = useShop()
  const rows = AGES.map((_, k) => tick - k).filter(n => n >= 0)
  return (
    <Rise delay={0.55} className="relative mx-auto w-full max-w-[480px] text-left">
      <div aria-hidden className="absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(closest-side,rgba(0,0,0,0.08),transparent)]" />
      <div aria-hidden className="relative rounded-[1.9rem] border border-line bg-white/90 p-2 shadow-[0_50px_100px_-50px_rgba(0,0,0,0.5)] backdrop-blur">
        <div className="flex items-center justify-between px-3.5 pb-2.5 pt-2">
          <span className="flex items-center gap-2 text-[14px] font-semibold text-neutral-950">
            <span className="size-2 rounded-full bg-black text-black animate-live" />{t('site.preview_pilot')}
          </span>
          <span className="rounded-full border border-line px-2.5 py-0.5 text-[11px] font-medium text-neutral-500">{t('site.preview_demo')}</span>
        </div>
        <ul className="flex h-[332px] flex-col gap-2 overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((n, age) => <FeedItem key={n} event={EVENTS[n % EVENTS.length]} age={age} />)}
          </AnimatePresence>
        </ul>
        <div className="mt-1 flex items-center gap-2 border-t border-line px-3.5 pb-1.5 pt-3 text-[12.5px] text-neutral-500">
          <Clock className="size-3.5" />{t('site.feat_hourly')}
        </div>
      </div>
    </Rise>
  )
}

export function HeroLive() {
  const { t, euro } = useShop()
  const reduce = useReducedMotion()
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { amount: 0.2 })
  const [tick, setTick] = useState(START)
  useEffect(() => {
    if (!inView || reduce) return
    const id = setInterval(() => setTick(n => n + 1), EVERY)
    return () => clearInterval(id)
  }, [inView, reduce])
  const base = (euro ? BASE.eur : BASE.ron) - earned(START, euro)
  const profit = base + earned(tick, euro)

  return (
    <section ref={ref} className="relative overflow-hidden px-5 pb-20 pt-32 sm:pt-36 md:pb-28">
      <GridLines />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12">
        <div className="text-center lg:text-left">
          <HeroBadge />
          <h1 className={cn('mx-auto mt-7 max-w-3xl lg:mx-0', H1_CLASS, 'md:text-[4.3rem] lg:text-[4rem] xl:text-[4.5rem]')}>
            <span className="sr-only">{t('site.hero_live_sr')}</span>
            <span aria-hidden>
              <Words text={t('site.hero_live_a')} />{' '}
              <ProfitPill value={profit} />{' '}
              <Words text={t('site.hero_live_b')} delay={0.3} wordClassName={GRADIENT_WORD} />
            </span>
          </h1>
          <HeroDesc className="mx-auto lg:mx-0" />
          <HeroCtas className="justify-center lg:justify-start" />
          <HeroFacts className="mx-auto justify-center lg:mx-0 lg:justify-start" />
        </div>

        <LiveFeed tick={tick} />
      </div>

      <BrandsRow className="relative mx-auto max-w-6xl md:mt-24" />
    </section>
  )
}
