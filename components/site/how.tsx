'use client'

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { Megaphone, Route, ShoppingBag, Store } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { AnimatedBeam, DotPattern, Reveal } from './fx'
import { SectionHeader } from './section'

// =============================================
// Cum funcționează: harta legăturilor (magazin → Hontrio → Google Ads și
// Merchant Center, cu raze care curg) și cei patru pași. Pașii avansează
// singuri cât secțiunea e pe ecran; pasul ales aprinde nodurile lui pe hartă.
// =============================================

type NodeId = 'store' | 'core' | 'ads' | 'mc'
const STEPS: { id: string; nodes: NodeId[] }[] = [
  { id: 'store', nodes: ['store'] },
  { id: 'google', nodes: ['ads', 'mc'] },
  { id: 'plan', nodes: ['core'] },
  { id: 'pilot', nodes: ['core', 'ads'] },
]
const EVERY = 4200

function Node({ nodeRef, lit, icon, title, sub, dark = false, className }: {
  nodeRef: RefObject<HTMLDivElement | null>; lit: boolean; icon: ReactNode; title: string; sub: string; dark?: boolean; className?: string
}) {
  return (
    <motion.div ref={nodeRef} animate={{ scale: lit ? 1.04 : 1 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={cn('relative z-10 flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-[border-color,box-shadow] duration-300 sm:p-4',
        dark ? 'border-black bg-[#0a0a0a] text-white' : 'border-line bg-white',
        lit ? (dark ? 'shadow-[0_0_0_6px_rgba(10,10,10,0.08),0_24px_50px_-20px_rgba(0,0,0,0.6)]' : 'border-black shadow-[0_0_0_4px_rgba(10,10,10,0.06),0_18px_40px_-24px_rgba(0,0,0,0.45)]') : 'shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        className)}>
      <span className={cn('grid size-10 place-items-center rounded-xl [&_svg]:size-5', dark ? 'bg-white/10' : lit ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-700')}>{icon}</span>
      <span className="text-[12.5px] font-semibold leading-tight sm:text-[13.5px]">{title}</span>
      <span className={cn('hidden text-[11.5px] leading-snug sm:block', dark ? 'text-white/55' : 'text-neutral-500')}>{sub}</span>
    </motion.div>
  )
}

export function HowItWorks() {
  const { t } = useT()
  const reduce = useReducedMotion()
  const box = useRef<HTMLDivElement>(null)
  const store = useRef<HTMLDivElement>(null)
  const core = useRef<HTMLDivElement>(null)
  const ads = useRef<HTMLDivElement>(null)
  const mc = useRef<HTMLDivElement>(null)
  const section = useRef<HTMLElement>(null)
  const inView = useInView(section, { margin: '-120px' })
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (!inView || paused || reduce) return
    const timer = setTimeout(() => setActive(a => (a + 1) % STEPS.length), EVERY)
    return () => clearTimeout(timer)
  }, [active, inView, paused, reduce])

  const lit = new Set(STEPS[active].nodes)

  return (
    <section id="how" ref={section} className="scroll-mt-24 border-y border-line bg-neutral-50 px-5 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeader badge={t('site.how_badge')} icon={<Route />} titleA={t('site.how_title_a')} titleB={t('site.how_title_b')} desc={t('site.how_desc')} />

        <Reveal delay={0.1} className="relative mx-auto mt-14 max-w-4xl overflow-hidden rounded-[1.75rem] border border-line bg-white px-3 py-10 shadow-[var(--shadow-surface)] sm:px-10 sm:py-14">
          <DotPattern className="text-neutral-200 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
          <div ref={box} className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-10">
            <Node nodeRef={store} lit={lit.has('store')} icon={<Store />} title={t('site.how_node_store')} sub={t('site.how_node_store_sub')} className="w-full max-w-[210px] justify-self-start" />
            <div className="relative">
              {!reduce && <motion.span aria-hidden className="absolute inset-0 rounded-3xl bg-black/10" animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0, 0.6] }} transition={{ duration: 2.6, repeat: Infinity }} />}
              <Node nodeRef={core} lit={lit.has('core')} dark title="Hontrio" sub={t('site.how_node_core_sub')} className="rounded-3xl px-4 sm:px-6"
                icon={
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/logo-icon.png" alt="" className="size-5 invert" />
                } />
            </div>
            <div className="flex w-full max-w-[210px] flex-col gap-4 justify-self-end sm:gap-6">
              <Node nodeRef={ads} lit={lit.has('ads')} icon={<Megaphone />} title="Google Ads" sub={t('site.how_node_ads_sub')} />
              <Node nodeRef={mc} lit={lit.has('mc')} icon={<ShoppingBag />} title="Merchant Center" sub={t('site.how_node_mc_sub')} />
            </div>
          </div>
          <AnimatedBeam containerRef={box} fromRef={store} toRef={core} duration={3.2} />
          <AnimatedBeam containerRef={box} fromRef={core} toRef={ads} curvature={30} duration={3.2} delay={0.6} />
          <AnimatedBeam containerRef={box} fromRef={core} toRef={mc} curvature={-30} duration={3.2} delay={1.1} />
          <AnimatedBeam containerRef={box} fromRef={ads} toRef={core} curvature={-30} reverse duration={3.6} delay={2} tail="#d4d4d4" />
        </Reveal>

        <ol className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          {STEPS.map((s, i) => {
            const on = i === active
            return (
              <Reveal as="li" key={s.id} delay={0.1 + i * 0.06}>
                <button type="button" onClick={() => setActive(i)} aria-current={on ? 'step' : undefined}
                  className={cn('relative flex h-full w-full flex-col overflow-hidden rounded-[1.4rem] border p-5 text-left transition-[border-color,background-color,box-shadow] duration-300',
                    on ? 'border-black bg-white shadow-[0_24px_50px_-32px_rgba(0,0,0,0.45)]' : 'border-line bg-white/60 hover:border-neutral-300 hover:bg-white')}>
                  <span className={cn('font-mono text-[11px] transition-colors', on ? 'text-black' : 'text-neutral-400')}>{t('site.how_step', { n: String(i + 1) })}</span>
                  <span className="mt-2 text-[16px] font-semibold tracking-tight text-neutral-950">{t(`site.how_${s.id}_title`)}</span>
                  <span className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-500">{t(`site.how_${s.id}_desc`)}</span>
                  {/* Cât mai durează până la pasul următor */}
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-neutral-100">
                    {on && inView && !paused && !reduce && (
                      <motion.span key={`${active}`} className="block h-full bg-black" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: EVERY / 1000, ease: 'linear' }} />
                    )}
                  </span>
                </button>
              </Reveal>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
