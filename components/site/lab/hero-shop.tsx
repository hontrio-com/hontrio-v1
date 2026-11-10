'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion'
import { Check, MousePointer2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DotPattern } from '../fx'
import { BrandsRow, EASE, GRADIENT_WORD, H1_CLASS, HeroBadge, HeroCtas, HeroDesc, HeroFacts, TiltPreview, Words } from '../hero'
import { PRODUCTS, breakEven, targetRoas, useShop, type Product } from './catalog'

// =============================================
// Varianta 2 · „Produs în Google Shopping": în titlu stă o reclamă de produs
// care se schimbă (lampă, căști, ceas, fotoliu). Un cursor dă clic pe ea și
// apare „Comandă nouă". Sub titlu, platforma, cu două carduri care plutesc:
// ținta calculată pentru produsul din titlu și comanda venită din reclamă.
// =============================================

const SHOWN = PRODUCTS.slice(0, 4)
/** Cât stă fiecare produs în titlu (ms). */
const CYCLE = 3800

const swap = {
  initial: { y: '70%', opacity: 0, filter: 'blur(6px)' },
  animate: { y: '0%', opacity: 1, filter: 'blur(0px)' },
  exit: { y: '-70%', opacity: 0, filter: 'blur(6px)' },
  transition: { duration: 0.5, ease: EASE },
}

/** Cursorul care dă clic pe reclamă și eticheta „Comandă nouă". Se reia la fiecare produs. */
function Clicker({ price }: { price: string }) {
  const { t } = useShop()
  const reduce = useReducedMotion()
  return (
    <>
      <motion.span aria-hidden className="pointer-events-none absolute left-[58%] top-[52%] z-10 block"
        initial={{ opacity: 0 }}
        animate={reduce ? undefined : { x: ['1.3em', '0em', '0em', '0em', '0.35em'], y: ['1em', '0em', '0em', '0em', '0.5em'], scale: [1, 1, 0.78, 1, 1], opacity: [0, 1, 1, 1, 0] }}
        transition={{ duration: 2, delay: 0.9, times: [0, 0.36, 0.44, 0.52, 1], ease: 'easeInOut' }}>
        <MousePointer2 className="size-[0.34em] fill-black text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.35)]" strokeWidth={1.4} />
      </motion.span>
      <motion.span aria-hidden className="pointer-events-none absolute -top-[0.55em] right-[-0.4em] z-10 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-black px-2.5 py-1 text-[10px] font-semibold leading-none tracking-normal text-white shadow-[0_10px_24px_-8px_rgba(0,0,0,0.6)] sm:text-[12px] md:text-[13px]"
        initial={{ opacity: 0 }}
        animate={reduce ? undefined : { opacity: [0, 1, 1, 0], y: ['0.25em', '0em', '0em', '-0.2em'], scale: [0.9, 1, 1, 0.98] }}
        transition={{ duration: 1.8, delay: 1.78, times: [0, 0.12, 0.82, 1] }}>
        <Check className="size-3" strokeWidth={3} />{t('site.hero_new_order')} · {price}
      </motion.span>
    </>
  )
}

/** Reclama din titlu: poza produsului, „Sponsorizat", numele și prețul. */
function ShopChip({ product }: { product: Product }) {
  const { t, price } = useShop()
  const reduce = useReducedMotion()
  return (
    <motion.span initial={reduce ? false : { opacity: 0, scale: 0.6, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: -2.5 }}
      whileHover={{ rotate: 0, scale: 1.04 }} transition={{ type: 'spring', stiffness: 220, damping: 18, delay: reduce ? 0 : 0.45 }}
      className="relative mx-[0.06em] inline-flex h-[0.9em] w-[2.95em] translate-y-[0.1em] items-center gap-[0.11em] rounded-[0.2em] border border-line bg-white p-[0.07em] text-left align-baseline shadow-[0_22px_44px_-18px_rgba(0,0,0,0.42)] md:w-[4.15em]">
      <span className="relative grid aspect-square h-full shrink-0 place-items-center overflow-hidden rounded-[0.15em] bg-neutral-100">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={product.id} {...swap} className="grid place-items-center">
            <product.icon className="size-[0.4em] text-neutral-900" strokeWidth={1.5} />
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="flex h-full min-w-0 flex-1 flex-col justify-center overflow-hidden pr-[0.05em] leading-none tracking-normal">
        <span className="text-[8.5px] font-semibold uppercase tracking-[0.12em] text-neutral-400 sm:text-[10px] md:text-[11px]">{t('site.hero_ad')}</span>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={product.id} {...swap} className="block">
            <span className="mt-2 hidden truncate text-[14px] font-medium text-neutral-600 md:block lg:text-[15px]">{t(`site.prod_${product.id}`)}</span>
            <span className="mt-1.5 block text-[13px] font-bold tracking-[-0.02em] text-neutral-950 tabular-nums sm:text-[18px] md:mt-2 md:text-[21px]">{price(product)}</span>
          </motion.span>
        </AnimatePresence>
      </span>
      <Clicker key={product.id} price={price(product)} />
    </motion.span>
  )
}

/** Cardurile care plutesc lângă platformă (doar pe ecrane late). */
function FloatCards({ product }: { product: Product }) {
  const { t, price, roas } = useShop()
  const reduce = useReducedMotion()
  const be = breakEven(product.margin)
  const target = targetRoas(product.margin)
  const float = (d: number) => reduce ? undefined : { y: [0, -8, 0], transition: { duration: 6, delay: d, repeat: Infinity, ease: 'easeInOut' as const } }
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden xl:block">
      <motion.div initial={reduce ? false : { opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 1.1, ease: EASE }}
        className="absolute -left-28 top-28 w-[236px] -rotate-3">
        <motion.div animate={float(0)} className="rounded-[1.3rem] border border-line bg-white p-3 text-left shadow-[0_30px_60px_-30px_rgba(0,0,0,0.45)]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={product.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
              <div className="flex items-center gap-2.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-100"><product.icon className="size-5" strokeWidth={1.5} /></span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-neutral-900">{t(`site.prod_${product.id}`)}</span>
                  <span className="block text-[12px] text-neutral-500 tabular-nums">{price(product)}</span>
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11.5px] text-neutral-500">
                <span>{t('site.hero_shop_be', { value: roas(be) })}</span>
                <span className="font-semibold text-neutral-950">{t('site.hero_target', { value: roas(target) })}</span>
              </div>
              <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100">
                <motion.div className="absolute inset-y-0 left-0 rounded-full bg-black" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (target / 6) * 100)}%` }} transition={{ duration: 0.8, ease: EASE }} />
                <span className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${Math.min(100, (be / 6) * 100)}%` }} />
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </motion.div>

      <motion.div initial={reduce ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 1.3, ease: EASE }}
        className="absolute -right-32 top-80 w-[230px] rotate-2">
        <motion.div animate={float(1.5)} className="rounded-[1.3rem] bg-[#0a0a0a] p-3.5 text-left text-white shadow-[0_30px_60px_-28px_rgba(0,0,0,0.6)]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={product.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[12.5px] font-semibold"><span className="grid size-5 place-items-center rounded-full bg-white text-black"><Check className="size-3" strokeWidth={3} /></span>{t('site.hero_new_order')}</span>
                <span className="text-[11px] text-white/45">{t('site.hero_live_now')}</span>
              </div>
              <p className="mt-2 truncate text-[13px] text-white/75">{t(`site.prod_${product.id}`)}</p>
              <p className="mt-0.5 text-[20px] font-bold tracking-[-0.03em] tabular-nums">+{price(product)}</p>
              <p className="mt-1 text-[11px] text-white/45">{t('site.hero_shop_from')}</p>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  )
}

export function HeroShop() {
  const { t } = useShop()
  const reduce = useReducedMotion()
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref)
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!inView || reduce) return
    const id = setInterval(() => setI(x => (x + 1) % SHOWN.length), CYCLE)
    return () => clearInterval(id)
  }, [inView, reduce])
  const product = SHOWN[i]

  return (
    <section ref={ref} className="relative overflow-hidden px-5 pb-20 pt-32 sm:pt-36 md:pb-28">
      <div className="absolute inset-x-0 top-0 h-[760px] [mask-image:radial-gradient(ellipse_65%_55%_at_50%_28%,black_15%,transparent_72%)]">
        <DotPattern size={22} radius={1.1} className="text-neutral-300" />
      </div>

      <div className="relative mx-auto max-w-6xl text-center">
        <HeroBadge />

        <h1 className={cn('mx-auto mt-7 max-w-6xl', H1_CLASS, 'lg:text-wrap')}>
          <span className="sr-only">{t('site.hero_shop_sr')}</span>
          <span aria-hidden>
            <Words text={t('site.hero_shop_a')} />{' '}
            <ShopChip product={product} />{' '}
            <Words text={t('site.hero_shop_b')} delay={0.25} />
            <br className="hidden lg:block" />{' '}
            <Words text={t('site.hero_shop_c')} delay={0.4} wordClassName={GRADIENT_WORD} />
          </span>
        </h1>

        <HeroDesc className="mx-auto" />
        <HeroCtas className="justify-center" />
        <HeroFacts className="mx-auto justify-center" />
        <div className="relative">
          <TiltPreview />
          <FloatCards product={product} />
        </div>
        <BrandsRow />
      </div>
    </section>
  )
}
