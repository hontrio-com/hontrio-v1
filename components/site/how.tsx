'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion'
import { Route } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { SectionHeader } from './section'

// =============================================
// Cum funcționează: cei patru pași, fiecare cu ecranul real din aplicație
// (capturi din contul demonstrativ: magazinul conectat, Google Ads conectat,
// pragul de profit din asistentul de lansare, cum lucrează pilotul).
// Pe calculator, pașii sunt în stânga și ecranul stă fixat în dreapta, pe
// fundalul aplicației; derularea schimbă pasul. Pe telefon, ecranul stă sub pas.
// =============================================

type StepId = 'store' | 'google' | 'plan' | 'pilot'
type Step = { id: StepId; path: string; logos?: string[] }

// i18n-ignore-start (adrese și nume de fișiere)
const STEPS: Step[] = [
  { id: 'store', path: 'settings?tab=integrations', logos: ['edinio-icon', 'woocommerce', 'shopify'] },
  { id: 'google', path: 'settings?tab=integrations', logos: ['google-ads', 'google-merchant-center'] },
  { id: 'plan', path: 'dashboard' },
  { id: 'pilot', path: 'campaigns?tab=pilot' },
]
// i18n-ignore-end

/**
 * Capturile, pe limbi (interfața aplicației e în limba vizitatorului): dimensiunea
 * lor în CSS; fișierele sunt 2× (calculator) și 3× (telefon, „-m"). Engleza e în `en/`.
 */
const SIZES: Record<'ro' | 'en', Record<StepId | `${StepId}-m`, [number, number]>> = {
  ro: { store: [823, 429], 'store-m': [372, 483], google: [823, 347], 'google-m': [371, 379], plan: [1124, 501], 'plan-m': [316, 233], pilot: [367, 534], 'pilot-m': [371, 502] },
  en: { store: [823, 429], 'store-m': [372, 435], google: [823, 347], 'google-m': [371, 330], plan: [1124, 501], 'plan-m': [316, 233], pilot: [367, 564], 'pilot-m': [371, 520] },
}

function useShot() {
  const { locale } = useT()
  const lang = locale === 'ro' ? 'ro' : 'en'
  return (id: StepId, mobile = false) => {
    const key = mobile ? (`${id}-m` as const) : id
    return { src: `/site/how/${lang === 'en' ? 'en/' : ''}${key}.webp`, size: SIZES[lang][key] }
  }
}

function StepText({ step, index, active }: { step: Step; index: number; active: boolean }) {
  const { t } = useT()
  return (
    <div className={cn('transition-opacity duration-500', active ? 'opacity-100' : 'lg:opacity-35')}>
      <p className="font-mono text-[13px] text-neutral-400">{t('site.how_step', { n: index + 1 })}</p>
      <h3 className="mt-2 text-[1.6rem] font-semibold leading-tight tracking-[-0.03em] text-neutral-950">{t(`site.how_${step.id}_title`)}</h3>
      <p className="mt-3 text-pretty text-[16px] leading-relaxed text-neutral-500">{t(`site.how_${step.id}_desc`)}</p>
      {step.logos && (
        <div className="mt-5 flex items-center gap-2">
          {step.logos.map(l => (
            <span key={l} className="grid size-9 place-items-center rounded-xl border border-line bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/site/logos/${l}.svg`} alt="" className="max-h-5 max-w-5" />
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Fereastra aplicației: adresa paginii și, pe fundalul aplicației, ecranul pasului. */
function Stage({ active }: { active: number }) {
  const { t } = useT()
  const reduce = useReducedMotion()
  const shot = useShot()
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-line bg-[#f7f7f8] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_40px_80px_-50px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-3 border-b border-line bg-white/70 px-4 py-3">
        <span className="flex gap-1.5">{[0, 1, 2].map(i => <span key={i} className="size-2.5 rounded-full bg-neutral-200" />)}</span>
        <span className="min-w-0 truncate rounded-full bg-neutral-100 px-3 py-1 font-mono text-[12px] text-neutral-500">
          {/* i18n-ignore: adresa aplicației */}
          app.hontrio.com/<motion.span key={STEPS[active].path} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="text-neutral-800">{STEPS[active].path}</motion.span>
        </span>
      </div>
      <div className="relative h-[560px]">
        {STEPS.map((s, i) => (
          <motion.div key={s.id} initial={false} aria-hidden={i !== active}
            animate={{ opacity: i === active ? 1 : 0, y: reduce ? 0 : i === active ? 0 : i < active ? -16 : 16, scale: reduce ? 1 : i === active ? 1 : 0.985 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex items-center justify-center p-8">
            {/* Mărimea din CSS (fișierul e 2×); se micșorează doar dacă nu încape */}
            <Image src={shot(s.id).src} alt={t(`site.how_${s.id}_img`)} width={shot(s.id).size[0]} height={shot(s.id).size[1]} unoptimized
              style={{ width: shot(s.id).size[0], height: shot(s.id).size[1] }}
              className={cn('max-h-full max-w-full object-contain', s.id === 'plan' && 'rounded-[1.4rem]')} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export function HowItWorks() {
  const { t } = useT()
  const shot = useShot()
  const list = useRef<HTMLOListElement>(null)
  const [active, setActive] = useState(0)
  // Pasul activ: cel care trece prin mijlocul ecranului
  const { scrollYProgress } = useScroll({ target: list, offset: ['start center', 'end center'] })
  useMotionValueEvent(scrollYProgress, 'change', p => setActive(Math.min(STEPS.length - 1, Math.max(0, Math.floor(p * STEPS.length)))))

  return (
    <section id="how" className="scroll-mt-24 border-y border-line bg-white px-5 py-24 md:py-32">
      <div className="mx-auto max-w-[1240px]">
        <SectionHeader badge={t('site.how_badge')} icon={<Route />} titleA={t('site.how_title_a')} titleB={t('site.how_title_b')} desc={t('site.how_desc')} />

        {/* Calculator: pașii în stânga, ecranul fixat în dreapta */}
        <div className="mt-16 hidden gap-14 lg:grid lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <ol ref={list} className="relative border-l border-line">
            {STEPS.map((s, i) => (
              <li key={s.id} className="relative flex min-h-[64vh] items-center pl-10">
                <span aria-hidden className={cn('absolute -left-px top-1/2 h-24 w-[2px] -translate-y-1/2 rounded-full transition-colors duration-500', i === active ? 'bg-black' : 'bg-transparent')} />
                <StepText step={s} index={i} active={i === active} />
              </li>
            ))}
          </ol>
          <div className="relative">
            <div className="sticky top-[calc(50svh-320px)]">
              <Stage active={active} />
              <p className="mt-3 text-center text-[12.5px] text-neutral-400">{t('site.how_caption')}</p>
            </div>
          </div>
        </div>

        {/* Telefon: fiecare pas cu ecranul lui */}
        <ol className="mt-12 space-y-16 lg:hidden">
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <StepText step={s} index={i} active />
              <div className="mt-6 grid place-items-center rounded-[1.5rem] border border-line bg-[#f7f7f8] p-4">
                <Image src={shot(s.id, true).src} alt={t(`site.how_${s.id}_img`)} width={shot(s.id, true).size[0]} height={shot(s.id, true).size[1]} unoptimized
                  className={cn('h-auto w-full max-w-[372px]', s.id === 'plan' && 'rounded-[1.1rem]')} />
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-10 text-center text-[12.5px] text-neutral-400 lg:hidden">{t('site.how_caption')}</p>
      </div>
    </section>
  )
}
