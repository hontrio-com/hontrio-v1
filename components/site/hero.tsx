'use client'

import Link from 'next/link'
import { useRef, useState, type CSSProperties } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { DotField } from './fx'
import { primaryPill, Shine } from './header'
import { GoogleSim, SimSteps } from './google-sim'
import { BrandMark, GOOGLE, STORES, type Brand } from './brands'

// =============================================
// Începutul paginii: titlul (cu un comutator „pilot automat" care se aprinde
// în text, ca plăcuțele din titlul CLIPPING), ce face Hontrio, butoanele și,
// dedesubt, căutarea pe Google: fereastra rămâne fixată cât derulezi, iar
// derularea o duce pas cu pas (cineva caută, apar produsele promovate, al tău
// e primul, clic, comandă). Înapoi, merge invers.
// =============================================

const EASE = [0.22, 1, 0.36, 1] as const

/** Apariția prin CSS (`.site-rise` din globals.css): întârzierea, distanța și estomparea. */
const rise = (delay: number, y?: string, blur?: string) =>
  ({ '--rise-delay': `${delay}s`, ...(y && { '--rise-y': y }), ...(blur && { '--rise-blur': blur }) }) as CSSProperties

/**
 * Text care apare cuvânt cu cuvânt, din estompare. Cititorul de ecran primește textul întreg.
 * `wordClassName` merge pe fiecare cuvânt: un gradient pe text (bg-clip-text) trebuie pus
 * pe cuvânt, fiindcă un părinte nu-l poate „decupa" prin copiii animați (au stratul lor).
 * Animația este în CSS, ca titlul să existe vizibil și în pagina trimisă de server.
 */
function Words({ text, delay = 0, className, wordClassName }: { text: string; delay?: number; className?: string; wordClassName?: string }) {
  const words = text.split(' ')
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((w, i) => (
          <span key={`${w}-${i}`} className={cn('site-rise inline-block whitespace-pre', wordClassName)} style={rise(delay + i * 0.06, '0.35em', '10px')}>
            {w}{i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </span>
    </span>
  )
}

/** Comutatorul din titlu: se aprinde singur, iar la hover se poate stinge și aprinde. */
function AutopilotSwitch() {
  const reduce = useReducedMotion()
  const [on, setOn] = useState(true)
  return (
    <motion.span aria-hidden onHoverStart={() => setOn(false)} onHoverEnd={() => setOn(true)}
      initial={reduce ? false : { opacity: 0, scale: 0.6, rotate: -6 }} animate={{ opacity: 1, scale: 1, rotate: -4 }}
      whileHover={{ rotate: 0, scale: 1.05 }} transition={{ type: 'spring', stiffness: 220, damping: 18, delay: reduce ? 0 : 0.55 }}
      className="relative mx-[0.12em] inline-flex h-[0.72em] w-[1.3em] translate-y-[0.06em] items-center rounded-full align-baseline shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] ring-1 ring-black/10">
      <motion.span className="absolute inset-0 rounded-full" initial={false} animate={{ backgroundColor: on ? '#0a0a0a' : '#d4d4d4' }} transition={{ duration: 0.3 }} />
      <motion.span className="relative mx-[0.08em] block size-[0.56em] rounded-full bg-white shadow-md"
        initial={reduce ? false : { x: 0 }} animate={{ x: on ? '0.58em' : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30, delay: reduce ? 0 : 0.9 }} />
    </motion.span>
  )
}

/**
 * Logo-urile, pe un rând platformele de magazin, pe al doilea Google. Pe telefon, două
 * coloane egale, fiecare logo la mijlocul celulei lui, ca rândurile să nu se rupă inegal.
 */
function BrandList({ brands, className }: { brands: Brand[]; className?: string }) {
  return (
    <ul className={cn('mx-auto grid max-w-sm grid-cols-2 items-center gap-x-3 gap-y-7 [--logo:22px] sm:flex sm:max-w-5xl sm:flex-wrap sm:justify-center sm:gap-x-9 sm:gap-y-5 sm:[--logo:28px]', className)}>
      {brands.map(b => (
        <li key={b.name} className="flex min-w-0 justify-center">
          <BrandMark brand={b} nameClassName="text-[14.5px] font-semibold tracking-tight text-neutral-800 sm:text-[17px]" />
        </li>
      ))}
    </ul>
  )
}

export function Hero() {
  const { t } = useT()
  const reduce = useReducedMotion()
  const track = useRef<HTMLDivElement>(null)
  // Cât timp fereastra stă fixată (sub antet, la 76px): progresul poveștii, 0 → 1
  const { scrollYProgress: story } = useScroll({ target: track, offset: ['start 76px', 'end end'] })
  // Cât urcă spre locul ei: se îndreaptă
  const { scrollYProgress: enter } = useScroll({ target: track, offset: ['start end', 'start 76px'] })
  const rotateX = useTransform(enter, [0, 1], [14, 0])
  const scale = useTransform(enter, [0, 1], [0.94, 1])

  return (
    // Fără overflow-hidden pe secțiune: ar opri fixarea ferestrei (sticky)
    <section className="relative px-5 pb-20 pt-40 sm:pt-44 md:pb-28">
      <div className="absolute inset-x-0 top-0 h-[760px] overflow-hidden opacity-80 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black_30%,transparent_75%)]">
        <DotField />
      </div>

      <div className="relative mx-auto max-w-6xl text-center">
        <h1 className="mx-auto max-w-5xl text-balance text-[2.55rem] font-bold leading-[1.06] tracking-[-0.045em] text-neutral-950 sm:text-6xl md:text-[4.6rem] lg:text-[5.1rem]">
          <Words text={t('site.hero_title_a')} />
          <br className="hidden sm:block" />{' '}
          <AutopilotSwitch />
          <Words text={t('site.hero_title_b')} delay={0.35} wordClassName="bg-gradient-to-b from-neutral-950 via-neutral-700 to-neutral-400 bg-clip-text pb-[0.08em] text-transparent" />
        </h1>

        <p className="site-rise mx-auto mt-6 max-w-2xl text-pretty text-[16.5px] leading-relaxed text-neutral-500 sm:text-lg" style={rise(0.5)}>
          {t('site.hero_desc')}
        </p>

        <div className="site-rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row" style={rise(0.62)}>
          <Link href="/register" className={cn(primaryPill, 'h-12 px-7 text-[15px]')}>
            <Shine /><span className="relative">{t('site.hero_cta')}</span><ArrowRight className="relative size-4 transition group-hover:translate-x-0.5" />
          </Link>
          <Link href="#how" className="inline-flex h-12 items-center rounded-full border border-line bg-white/80 px-7 text-[15px] font-semibold text-neutral-900 backdrop-blur transition hover:border-black">
            {t('site.hero_cta_alt')}
          </Link>
        </div>

        {/* Căutarea pe Google: zona e înaltă, fereastra rămâne fixată și derularea o duce pas cu pas */}
        <div ref={track} className="relative mt-14 h-[270vh] md:mt-16 md:h-[320vh]">
          <div className="sticky top-[76px] flex h-[calc(100svh-76px)] flex-col justify-center gap-5 pb-4">
            <SimSteps progress={story} />
            <motion.div style={reduce ? undefined : { rotateX, scale, transformPerspective: 1600, transformOrigin: '50% 0%' }}
              initial={reduce ? false : { opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.7, ease: EASE }}>
              <GoogleSim progress={story} />
            </motion.div>
          </div>
        </div>

        <div className="mt-16">
          <p className="text-sm text-neutral-500">{t('site.logos_label')}</p>
          <BrandList brands={STORES} className="mt-6" />
          <BrandList brands={GOOGLE} className="mt-7 sm:mt-5" />
        </div>
      </div>
    </section>
  )
}
