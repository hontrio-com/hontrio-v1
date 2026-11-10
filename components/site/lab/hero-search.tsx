'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import { Check, MousePointer2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BrandsRow, EASE, GRADIENT_WORD, H1_CLASS, HeroBadge, HeroCtas, HeroDesc, HeroFacts, Words } from '../hero'
import { PRODUCTS, breakEven, targetRoas, useShop, type Product, type ProductId } from './catalog'

// =============================================
// Varianta 3 · „Căutare pe Google": în titlu e o bară de căutare în care se
// scrie ce caută oamenii („lampă de birou"). Dedesubt apar rezultatele
// sponsorizate: produsul tău e primul, un cursor dă clic, vine comanda, iar
// Hontrio arată ținta pe care a pus-o pentru căutarea aceea.
// =============================================

const QUERIES: ProductId[] = ['lamp', 'headphones', 'watch', 'armchair']
type Phase = 'type' | 'results' | 'click' | 'order'
const NEXT: Record<Phase, Phase> = { type: 'results', results: 'click', click: 'order', order: 'type' }
/** Cât stă fiecare pas (ms); scrisul durează după lungimea căutării. */
const WAIT: Record<Exclude<Phase, 'type'>, number> = { results: 1300, click: 700, order: 2100 }
const TYPE_SPEED = 65
/** Prețurile celorlalte magazine, față de al tău. */
const OTHERS = [1.14, 0.93, 1.27]

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

function Caret({ className }: { className?: string }) {
  return <span aria-hidden className={cn('inline-block w-[2px] shrink-0 rounded-full bg-neutral-900 animate-[blink_1.05s_step-end_infinite] motion-reduce:animate-none', className)} />
}

/** Bara de căutare din titlu. */
function QueryPill({ qi, query, typing }: { qi: number; query: string; typing: boolean }) {
  const reduce = useReducedMotion()
  return (
    <motion.span initial={reduce ? false : { opacity: 0, y: '0.3em', scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: reduce ? 0 : 0.55, ease: EASE }}
      className="relative mx-[0.04em] inline-flex h-[2.2em] w-[12em] max-w-full translate-y-[-0.14em] items-center gap-[0.5em] rounded-full border border-line bg-white px-[0.8em] text-left align-middle text-[0.42em] font-medium tracking-[-0.015em] text-neutral-900 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.05)]">
      <Search className="size-[0.95em] shrink-0 text-neutral-400" strokeWidth={2.4} />
      <span className="flex min-w-0 items-center">
        <span className="truncate"><Typed key={qi} text={query} typing={typing} /></span>
        <Caret className="ml-[0.08em] h-[1.05em]" />
      </span>
    </motion.span>
  )
}

/** Rezultatul tău: primul, încadrat, cu „Sponsorizat". */
function YourResult({ product, phase }: { product: Product; phase: Phase }) {
  const { t, price } = useShop()
  const shown = phase !== 'type'
  const clicked = phase === 'click' || phase === 'order'
  return (
    <motion.div animate={{ scale: phase === 'click' ? 0.97 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className="relative rounded-2xl border-2 border-black bg-white p-2.5 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.5)]">
      <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-xl bg-neutral-100">
        <span className="absolute left-2 top-2 z-10 rounded-full bg-black px-2 py-0.5 text-[10px] font-semibold text-white">{t('site.hero_your_store')}</span>
        <AnimatePresence mode="wait" initial={false}>
          {shown
            ? <motion.span key={product.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: EASE }}><product.icon className="size-10 sm:size-12" strokeWidth={1.3} /></motion.span>
            : <motion.span key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="size-full animate-shimmer bg-[linear-gradient(90deg,#f5f5f5,#e9e9e9,#f5f5f5)] bg-[length:200%_100%]" />}
        </AnimatePresence>
      </div>
      <div className="mt-2.5 min-h-[58px]">
        {shown ? (
          <motion.div key={product.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }}>
            <p className="truncate text-[13px] font-medium text-neutral-800">{t(`site.prod_${product.id}`)}</p>
            <p className="mt-0.5 text-[15px] font-bold tracking-[-0.02em] text-neutral-950 tabular-nums">{price(product)}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{t('site.hero_ad')}</p>
          </motion.div>
        ) : <Bars />}
      </div>

      {/* Cursorul vine din dreapta-jos și dă clic */}
      <motion.span aria-hidden className="pointer-events-none absolute left-1/2 top-[42%] z-20 block"
        initial={false}
        animate={clicked ? { x: 0, y: 0, opacity: 1, scale: phase === 'order' ? [0.8, 1] : 1 } : { x: 150, y: 120, opacity: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 170, damping: 22 }}>
        <MousePointer2 className="size-6 fill-black text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.35)]" strokeWidth={1.4} />
      </motion.span>

      <AnimatePresence>
        {phase === 'order' && (
          <motion.span initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.3, ease: EASE }}
            className="absolute -right-2 -top-3 z-20 flex items-center gap-1 whitespace-nowrap rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg">
            <Check className="size-3" strokeWidth={3} />{t('site.hero_new_order')}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Bars({ muted = false }: { muted?: boolean }) {
  return (
    <div className="space-y-1.5 pt-0.5">
      <div className={cn('h-2.5 w-4/5 rounded-full', muted ? 'bg-neutral-100' : 'bg-neutral-200/80')} />
      <div className={cn('h-3 w-2/5 rounded-full', muted ? 'bg-neutral-100' : 'bg-neutral-200/80')} />
      <div className={cn('h-2 w-1/3 rounded-full', muted ? 'bg-neutral-100' : 'bg-neutral-200/80')} />
    </div>
  )
}

/** Celelalte rezultate: estompate, fără nume. */
function OtherResult({ product, ratio, phase, index, className }: { product: Product; ratio: number; phase: Phase; index: number; className?: string }) {
  const { t, money, euro } = useShop()
  const shown = phase !== 'type'
  return (
    <div className={cn('rounded-2xl border border-line bg-white p-2.5', className)}>
      <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-xl bg-neutral-50">
        {shown
          ? <motion.span key={product.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, delay: 0.08 * (index + 1) }}><product.icon className="size-9 text-neutral-300 sm:size-10" strokeWidth={1.2} /></motion.span>
          : <span className="size-full animate-shimmer bg-[linear-gradient(90deg,#fafafa,#f0f0f0,#fafafa)] bg-[length:200%_100%]" />}
      </div>
      <div className="mt-2.5 min-h-[58px]">
        {shown ? (
          <motion.div key={product.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, delay: 0.08 * (index + 1) }}>
            <div className="h-2.5 w-4/5 rounded-full bg-neutral-100" />
            <p className="mt-1.5 text-[14px] font-semibold text-neutral-400 tabular-nums">{money((euro ? product.eur : product.ron) * ratio)}</p>
            <p className="mt-1 text-[10px] font-medium text-neutral-400">{t('site.hero_search_other')}</p>
          </motion.div>
        ) : <Bars muted />}
      </div>
    </div>
  )
}

function SearchScene({ qi, query, phase }: { qi: number; query: string; phase: Phase }) {
  const { t, roas } = useShop()
  const reduce = useReducedMotion()
  const product = PRODUCTS.find(p => p.id === QUERIES[qi]) ?? PRODUCTS[0]
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.7, ease: EASE }}
      aria-hidden className="relative mx-auto mt-14 max-w-4xl overflow-hidden rounded-[1.75rem] border border-line bg-white text-left shadow-[0_50px_100px_-55px_rgba(0,0,0,0.5)] md:mt-16">
      <div className="flex items-center gap-3 border-b border-line bg-neutral-50/80 px-3 py-3 sm:px-5">
        <div className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-line bg-white px-4 text-[15px] text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <Search className="size-4 shrink-0 text-neutral-400" strokeWidth={2.2} />
          <span className="flex min-w-0 items-center">
            <span className="truncate"><Typed key={qi} text={query} typing={phase === 'type'} /></span>
            <Caret className="ml-px h-[18px]" />
          </span>
        </div>
        <span className="hidden shrink-0 rounded-full border border-line bg-white px-3 py-1 text-[11px] font-medium text-neutral-500 sm:inline">{t('site.preview_demo')}</span>
      </div>

      <div className="px-3 pb-5 pt-4 sm:px-6 sm:pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{t('site.hero_search_results')}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <YourResult product={product} phase={phase} />
          {OTHERS.map((ratio, k) => (
            <OtherResult key={k} product={product} ratio={ratio} phase={phase} index={k} className={k > 0 ? 'hidden sm:block' : undefined} />
          ))}
        </div>
      </div>

      <div className="flex min-h-[52px] items-center gap-2.5 border-t border-line bg-neutral-50/80 px-4 py-3 text-[13px] text-neutral-600 sm:px-6">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-black text-white"><Check className="size-3.5" strokeWidth={3} /></span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={`${qi}-${phase === 'type'}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }} className="min-w-0">
            {phase === 'type'
              ? <span className="text-neutral-400">{t('site.hero_search_wait')}</span>
              : t('site.hero_search_rule', { query, target: roas(targetRoas(product.margin)), be: roas(breakEven(product.margin)) })}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export function HeroSearch() {
  const { t } = useShop()
  const reduce = useReducedMotion()
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { amount: 0.2 })
  // Pagina pornește cu rezultatele întregi (fără mișcare, sau până intră în ecran)
  const [{ qi, phase }, setStep] = useState<{ qi: number; phase: Phase }>({ qi: 0, phase: 'results' })
  const query = t(`site.query_${QUERIES[qi]}`)
  const run = inView && !reduce

  useEffect(() => {
    if (!run) return
    const wait = phase === 'type' ? query.length * TYPE_SPEED + 450 : WAIT[phase]
    const id = setTimeout(() => setStep(s => s.phase === 'order'
      ? { qi: (s.qi + 1) % QUERIES.length, phase: 'type' }
      : { qi: s.qi, phase: NEXT[s.phase] }), wait)
    return () => clearTimeout(id)
  }, [run, phase, query.length])

  return (
    <section ref={ref} className="relative overflow-hidden px-5 pb-20 pt-32 sm:pt-36 md:pb-28">
      <div aria-hidden className="absolute inset-x-0 top-0 h-[700px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(0,0,0,0.06),transparent_70%)]" />

      <div className="relative mx-auto max-w-6xl text-center">
        <HeroBadge />

        <h1 className={cn('mx-auto mt-7 max-w-5xl', H1_CLASS)}>
          <span className="sr-only">{t('site.hero_search_sr')}</span>
          <span aria-hidden>
            <Words text={t('site.hero_search_a')} />{' '}
            <Words text={t('site.hero_search_b')} delay={0.2} wordClassName={GRADIENT_WORD} />{' '}
            <QueryPill qi={qi} query={query} typing={phase === 'type'} />
          </span>
        </h1>

        <HeroDesc className="mx-auto" />
        <HeroCtas className="justify-center" />
        <HeroFacts className="mx-auto justify-center" />
        <SearchScene qi={qi} query={query} phase={phase} />
        <BrandsRow />
      </div>
    </section>
  )
}
