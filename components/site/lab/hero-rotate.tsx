'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { BrandsRow, GRADIENT_WORD, H1_CLASS, HeroBadge, HeroCtas, HeroDesc, HeroFacts, Words } from '../hero'
import { PRODUCTS, targetRoas, useShop, type Product } from './catalog'

// =============================================
// Varianta 5 · „Categorii care se schimbă": titlul se termină cu o pastilă
// neagră în care se schimbă, literă cu literă, ce vinde magazinul (lămpi,
// căști, ceasuri…), după React Bits · Rotating Text. Dedesubt curg două rânduri
// de reclame de produs (Magic UI · Marquee); cele din categoria din titlu se
// aprind, fiecare cu ținta ei de ROAS.
// =============================================

const EVERY = 2400

/** Pastila cu categoria; lățimea se potrivește lin cuvântului nou. */
function CategoryPill({ product }: { product: Product }) {
  const { t } = useShop()
  const reduce = useReducedMotion()
  const word = Array.from(t(`site.cat_${product.id}`))
  return (
    <motion.span layout initial={reduce ? false : { opacity: 0, scale: 0.8, rotate: -4 }} animate={{ opacity: 1, scale: 1, rotate: -1.5 }}
      transition={{ type: 'spring', stiffness: 240, damping: 26, delay: reduce ? 0 : 0.55, layout: { type: 'spring', stiffness: 260, damping: 32 } }}
      className="relative mt-[0.12em] inline-flex h-[1.08em] items-center gap-[0.2em] overflow-hidden rounded-[0.26em] bg-[#0a0a0a] px-[0.26em] align-middle text-white shadow-[0_24px_50px_-18px_rgba(0,0,0,0.55)]">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={product.id} layout="position" className="flex items-center gap-[0.2em]">
          <motion.span initial={{ scale: 0.4, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="grid size-[0.66em] shrink-0 place-items-center rounded-[0.17em] bg-white text-black">
            <product.icon className="size-[0.4em]" strokeWidth={1.8} />
          </motion.span>
          <span className="flex overflow-hidden pb-[0.06em]">
            {word.map((ch, j) => (
              <motion.span key={j} className="inline-block whitespace-pre"
                initial={{ y: '105%' }} animate={{ y: '0%' }} exit={{ y: '-105%' }}
                transition={{ type: 'spring', stiffness: 380, damping: 30, delay: j * 0.025 }}>
                {ch}
              </motion.span>
            ))}
          </span>
        </motion.span>
      </AnimatePresence>
    </motion.span>
  )
}

function WallCard({ product, active }: { product: Product; active: boolean }) {
  const { t, price, roas } = useShop()
  return (
    <li className={cn('w-[214px] shrink-0 rounded-2xl border bg-white p-2.5 text-left transition-[border-color,box-shadow,opacity] duration-500',
      active ? 'border-black opacity-100 shadow-[0_20px_40px_-24px_rgba(0,0,0,0.5)]' : 'border-line opacity-60')}>
      <div className={cn('grid aspect-[4/3] place-items-center rounded-xl transition-colors duration-500', active ? 'bg-neutral-100' : 'bg-neutral-50')}>
        <product.icon className={cn('size-10 transition-colors duration-500', active ? 'text-neutral-950' : 'text-neutral-400')} strokeWidth={1.3} />
      </div>
      <p className="mt-2.5 truncate text-[13px] font-medium text-neutral-700">{t(`site.prod_${product.id}`)}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[15px] font-bold tracking-[-0.02em] text-neutral-950 tabular-nums">{price(product)}</span>
        <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold transition-colors duration-500', active ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-500')}>
          {t('site.hero_target', { value: roas(targetRoas(product.margin)) })}
        </span>
      </div>
      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{t('site.hero_ad')}</p>
    </li>
  )
}

/** Două rânduri de reclame care curg în sensuri opuse; se opresc sub cursor. */
function ProductWall({ active }: { active: Product['id'] }) {
  const rows = [PRODUCTS, [...PRODUCTS.slice(3), ...PRODUCTS.slice(0, 3)]]
  return (
    <div aria-hidden className="relative mt-16 space-y-4 [mask-image:linear-gradient(to_right,transparent,black_14%,black_86%,transparent)] md:mt-20">
      {rows.map((row, r) => (
        <div key={r} className="group flex gap-4 overflow-hidden py-1 [--duration:46s] [--gap:1rem]">
          {[0, 1].map(copy => (
            <ul key={copy} className={cn('flex shrink-0 gap-4 animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none', r === 1 && '[animation-direction:reverse]')}>
              {row.map(p => <WallCard key={p.id} product={p} active={p.id === active} />)}
            </ul>
          ))}
        </div>
      ))}
    </div>
  )
}

export function HeroRotate() {
  const { t } = useShop()
  const reduce = useReducedMotion()
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref)
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!inView || reduce) return
    const id = setInterval(() => setI(x => (x + 1) % PRODUCTS.length), EVERY)
    return () => clearInterval(id)
  }, [inView, reduce])
  const product = PRODUCTS[i]

  return (
    <section ref={ref} className="relative overflow-hidden px-5 pb-20 pt-32 sm:pt-36 md:pb-28">
      <div aria-hidden className="absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(ellipse_55%_45%_at_50%_0%,rgba(0,0,0,0.07),transparent_70%)]" />

      <div className="relative mx-auto max-w-6xl text-center">
        <HeroBadge />

        <h1 className={cn('mx-auto mt-7 max-w-5xl', H1_CLASS, 'lg:text-wrap lg:text-[4.4rem]')}>
          <span className="sr-only">{t('site.hero_rotate_sr')}</span>
          <span aria-hidden>
            <Words text={t('site.hero_rotate_a')} />
            <br className="hidden lg:block" />{' '}
            <Words text={t('site.hero_rotate_b')} delay={0.25} wordClassName={GRADIENT_WORD} />
            <br />
            <CategoryPill product={product} />
          </span>
        </h1>

        <HeroDesc className="mx-auto" />
        <HeroCtas className="justify-center" />
        <HeroFacts className="mx-auto justify-center" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <ProductWall active={product.id} />
      </div>
      <BrandsRow className="relative mx-auto max-w-6xl" />
    </section>
  )
}
