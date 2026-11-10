'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import { Check, MousePointer2, Search, ShoppingBag } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { NumberTicker } from '@/components/app/motion'
import { cn } from '@/lib/utils'

// =============================================
// Simularea de sub titlu: cineva caută un produs pe Google Shopping („lampă de
// birou"), se încarcă rezultatele sponsorizate și produsul magazinului tău e
// primul, înaintea concurenților. Cursorul dă clic, vine comanda, iar jos
// Hontrio arată ținta de ROAS pusă pentru căutarea aceea. Apoi următoarea
// căutare. Pozele de produs sunt generate (ElevenLabs · Seedream), cu date
// demonstrative; ținta e calculată ca în calculator: (1 + TVA) ÷ marjă ÷ 0,75.
// =============================================

const EASE = [0.22, 1, 0.36, 1] as const

type SetId = 'lamp' | 'sneaker' | 'watch'
type ShopSet = { id: SetId; margin: number; images: string[]; ron: number[]; eur: number[] }

/** Pentru fiecare căutare: primul produs e al tău, celelalte trei ale concurenților. */
const SETS: ShopSet[] = [
  { id: 'lamp', margin: 0.45, images: ['lamp-1', 'lamp-2', 'lamp-3', 'lamp-4'], ron: [189, 229, 174, 249], eur: [39, 47, 36, 52] },
  { id: 'sneaker', margin: 0.5, images: ['sneaker-2', 'sneaker-1', 'sneaker-3', 'sneaker-4'], ron: [349, 389, 319, 429], eur: [69, 79, 64, 89] },
  { id: 'watch', margin: 0.38, images: ['watch-3', 'watch-1', 'watch-2', 'watch-4'], ron: [529, 599, 489, 649], eur: [109, 125, 99, 135] },
]
const TABS = ['all', 'shopping', 'images', 'videos'] as const

type Phase = 'type' | 'results' | 'hover' | 'click' | 'order'
const NEXT: Record<Phase, Phase> = { type: 'results', results: 'hover', hover: 'click', click: 'order', order: 'type' }
/** Cât stă fiecare pas (ms); scrisul durează după lungimea căutării. */
const WAIT: Record<Exclude<Phase, 'type'>, number> = { results: 1600, hover: 900, click: 280, order: 2400 }
const TYPE_SPEED = 70
const ORDERS_START = 12

/** Pragul de profit (ROAS) cu TVA 21% și ținta „echilibrat" (păstrezi 25% din marjă), ca în calculator. */
const breakEven = (margin: number) => 1.21 / margin
const targetRoas = (margin: number) => breakEven(margin) / 0.75

/** Textul care se scrie literă cu literă. Fără scriere, apare întreg. */
function Typed({ text, typing }: { text: string; typing: boolean }) {
  const [n, setN] = useState(typing ? 0 : text.length)
  useEffect(() => {
    if (!typing) return
    const id = setInterval(() => setN(x => x + 1), TYPE_SPEED)
    return () => clearInterval(id)
  }, [typing])
  return <>{typing ? text.slice(0, n) : text}</>
}

function Bars() {
  return (
    <div className="space-y-1.5 pt-0.5">
      <div className="h-2.5 w-11/12 rounded-full bg-neutral-100" />
      <div className="h-2.5 w-3/5 rounded-full bg-neutral-100" />
      <div className="mt-2 h-3 w-2/5 rounded-full bg-neutral-100" />
    </div>
  )
}

function ResultCard({ set, index, phase, className }: { set: ShopSet; index: number; phase: Phase; className?: string }) {
  const { t, locale, intlLocale } = useT()
  const mine = index === 0
  const shown = phase !== 'type'
  const lifted = mine && (phase === 'hover' || phase === 'click' || phase === 'order')
  const euro = locale !== 'ro'
  const price = new Intl.NumberFormat(intlLocale, { style: 'currency', currency: euro ? 'EUR' : 'RON', maximumFractionDigits: 0 })
    .format(euro ? set.eur[index] : set.ron[index])
  const delay = 0.07 * index

  return (
    <motion.div animate={{ y: lifted ? -5 : 0, scale: mine && phase === 'click' ? 0.97 : 1 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className={cn('relative rounded-[1.1rem] bg-white p-2', mine
        ? 'z-10 ring-2 ring-black shadow-[0_24px_44px_-24px_rgba(0,0,0,0.55)]'
        : 'ring-1 ring-line', className)}>
      <div className="relative aspect-square overflow-hidden rounded-[0.8rem] bg-[#f4f4f4]">
        <AnimatePresence initial={false}>
          {shown ? (
            <motion.div key={set.images[index]} className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.45, delay, ease: EASE }}>
              <Image src={`/site/shop/${set.images[index]}.webp`} alt="" fill sizes="(min-width: 1024px) 230px, (min-width: 640px) 22vw, 45vw"
                className={cn('object-cover', !mine && 'opacity-80 saturate-0')} />
            </motion.div>
          ) : (
            <motion.div key="loading" className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,#f4f4f4,#e8e8e8,#f4f4f4)] bg-[length:200%_100%]"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          )}
        </AnimatePresence>
      </div>

      <div className="min-h-[86px] px-1 pb-0.5 pt-2.5">
        {shown ? (
          <motion.div key={set.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: delay + 0.05 }}>
            <p className="line-clamp-2 text-[12.5px] font-medium leading-snug text-neutral-800">{t(`site.sim_${set.id}_${index}`)}</p>
            <p className="mt-1 text-[15px] font-bold tracking-[-0.02em] text-neutral-950 tabular-nums">{price}</p>
            <p className={cn('mt-0.5 flex items-center gap-1.5 truncate text-[11.5px]', mine ? 'font-semibold text-neutral-950' : 'text-neutral-400')}>
              {mine && <span className="size-1.5 shrink-0 rounded-full bg-black" />}
              {mine ? t('site.sim_your_store') : t('site.sim_other_store')}
            </p>
          </motion.div>
        ) : <Bars />}
      </div>

      {mine && (
        <>
          {/* Cursorul vine dinspre bara de căutare, dă clic pe produsul tău și dispare odată cu căutarea */}
          <AnimatePresence>
            {lifted && (
              <motion.span key={set.id} aria-hidden className="pointer-events-none absolute left-[55%] top-[42%] z-20 block"
                initial={{ x: 220, y: -170, opacity: 0 }} animate={{ x: 0, y: 0, opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 150, damping: 21 }}>
                <motion.span className="block" animate={{ scale: phase === 'click' ? 0.78 : 1 }} transition={{ duration: 0.12 }}>
                  <MousePointer2 className="size-6 fill-black text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.35)]" strokeWidth={1.4} />
                </motion.span>
              </motion.span>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {phase === 'order' && (
              <motion.span initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3, ease: EASE }}
                className="absolute -top-3.5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-black px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-[0_12px_28px_-10px_rgba(0,0,0,0.6)]">
                <Check className="size-3.5" strokeWidth={3} />{t('site.sim_new_order')} · {price}
              </motion.span>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  )
}

export function ShoppingSim() {
  const { t, intlLocale } = useT()
  const reduce = useReducedMotion()
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { amount: 0.3 })
  // Pornește cu rezultatele întregi (fără mișcare, sau până intră în ecran)
  const [{ qi, phase, orders }, setStep] = useState<{ qi: number; phase: Phase; orders: number }>({ qi: 0, phase: 'results', orders: ORDERS_START })
  const set = SETS[qi]
  const query = t(`site.sim_${set.id}_query`)
  const run = inView && !reduce

  useEffect(() => {
    if (!run) return
    const wait = phase === 'type' ? query.length * TYPE_SPEED + 500 : WAIT[phase]
    const id = setTimeout(() => setStep(s => {
      if (s.phase === 'order') return { qi: (s.qi + 1) % SETS.length, phase: 'type', orders: s.orders }
      const next = NEXT[s.phase]
      return { ...s, phase: next, orders: next === 'order' ? s.orders + 1 : s.orders }
    }), wait)
    return () => clearTimeout(id)
  }, [run, phase, query.length])

  const one = new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const count = (n: number) => String(Math.round(n))

  return (
    <figure ref={ref} role="img" aria-label={t('site.sim_label')}
      className="relative overflow-hidden rounded-[1.6rem] border border-line bg-white text-left shadow-[0_1px_2px_rgba(0,0,0,0.04),0_50px_100px_-50px_rgba(0,0,0,0.45)]">
      {/* Bara ferestrei */}
      <div className="flex items-center gap-3 border-b border-line bg-neutral-50/80 px-4 py-2.5">
        <span className="flex gap-1.5">{[0, 1, 2].map(i => <span key={i} className="size-2.5 rounded-full bg-neutral-200" />)}</span>
        <span className="mx-auto flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-[11px] font-medium text-neutral-500">
          <ShoppingBag className="size-3" />Google Shopping{/* i18n-ignore: numele serviciului */}
        </span>
        <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-white">{t('site.sim_demo')}</span>
      </div>

      {/* Căutarea */}
      <div className="px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="flex h-12 items-center gap-3 rounded-full border border-line bg-white pl-5 pr-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_26px_-18px_rgba(0,0,0,0.3)]">
          <Search className="size-[18px] shrink-0 text-neutral-400" strokeWidth={2.2} />
          <span className="flex min-w-0 flex-1 items-center text-[15px] text-neutral-900">
            <span className="truncate"><Typed key={qi} text={query} typing={phase === 'type'} /></span>
            {phase === 'type' && <span className="ml-px h-[18px] w-[2px] shrink-0 rounded-full bg-neutral-900 animate-[blink_1.05s_step-end_infinite] motion-reduce:animate-none" />}
          </span>
          <span className="hidden h-9 shrink-0 items-center rounded-full bg-black px-4 text-[12.5px] font-semibold text-white sm:flex">{t('site.sim_search')}</span>
        </div>
        <div className="mt-3 flex gap-5 overflow-hidden whitespace-nowrap border-b border-line text-[13px] text-neutral-500">
          {TABS.map((tab, i) => (
            <span key={tab} className={cn('relative pb-2.5', tab === 'shopping' && 'font-semibold text-neutral-950', i === 3 && 'hidden sm:inline')}>
              {t(`site.sim_tab_${tab}`)}
              {tab === 'shopping' && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-black" />}
            </span>
          ))}
        </div>
      </div>

      {/* Rezultatele sponsorizate: al tău primul */}
      <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
        <p className="min-h-[18px] truncate text-[12px] text-neutral-500">
          {phase === 'type'
            ? <span className="text-neutral-400">{t('site.sim_searching')}</span>
            : <><span className="font-semibold text-neutral-900">{t('site.sim_ad')}</span> · {t('site.sim_results_for', { query })}</>}
        </p>
        <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {set.images.map((_, i) => (
            <ResultCard key={i} set={set} index={i} phase={phase} className={i > 1 ? 'hidden sm:block' : undefined} />
          ))}
        </div>
      </div>

      {/* Ce a făcut Hontrio pentru căutarea asta */}
      <div className="flex flex-col gap-2 border-t border-line bg-neutral-50/80 px-4 py-3 text-[12.5px] text-neutral-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span className="flex min-w-0 items-center gap-2">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-black text-white"><Check className="size-3" strokeWidth={3} /></span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={`${qi}-${phase === 'type'}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }} className="truncate">
              {phase === 'type'
                ? <span className="text-neutral-400">{t('site.sim_searching')}</span>
                : t('site.sim_rule', { query, target: one.format(targetRoas(set.margin)), be: one.format(breakEven(set.margin)) })}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <ShoppingBag className="size-3.5 text-neutral-400" />{t('site.sim_orders')}
          <span className="font-semibold text-neutral-950 tabular-nums"><NumberTicker value={orders} format={count} /></span>
        </span>
      </div>
    </figure>
  )
}
