'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { AppWindow } from './app-window'
import { Reveal } from './fx'
import { SectionHeader } from './section'

// =============================================
// Funcționalitățile, ca un tur al aplicației: în stânga, cinci lucruri pe care
// le vezi și le hotărăști în Hontrio, fiecare într-o propoziție; în dreapta,
// ecranul real al celui ales (capturi din contul demonstrativ, magazinul
// „Casa Luminii", cu două luni de cifre care respectă regulile pilotului).
// Ecranul se schimbă la clic și singur, cât secțiunea e pe ecran, până alege
// omul unul. Pe telefon, fiecare funcție stă deasupra ecranului ei; tabelele
// de acolo arată doar coloanele care încap (produsul și motivul, campania și
// bugetul ei), iar pilotul doar setările lui. Dedesubt, regulile pilotului, ca
// text simplu; jurnalul pilotului e în „De ce Hontrio", nu se repetă aici.
// =============================================

type FeatureId = 'products' | 'groups' | 'pilot' | 'results' | 'recs'

// i18n-ignore-start (adresele paginilor din aplicație)
const FEATURES: { id: FeatureId; path: string }[] = [
  { id: 'products', path: 'campaigns?tab=plan' },
  { id: 'groups', path: 'campaigns?tab=campaigns' },
  { id: 'pilot', path: 'campaigns?tab=pilot' },
  { id: 'results', path: 'campaigns' },
  { id: 'recs', path: 'recommendations' },
]
// i18n-ignore-end

const RULES = ['loss', 'products', 'budget', 'learning'] as const

/** Cât stă un ecran când se schimbă singure. */
const DWELL_MS = 7000

/**
 * Capturile, pe limbi (interfața aplicației e în limba vizitatorului): dimensiunea
 * lor în CSS; fișierele sunt 2× (calculator) și 3× (telefon, „-m"). Engleza e în `en/`.
 */
const SIZES: Record<'ro' | 'en', Record<FeatureId | `${FeatureId}-m`, [number, number]>> = {
  ro: {
    products: [964, 451], 'products-m': [370, 544], groups: [964, 558], 'groups-m': [370, 688], pilot: [964, 580], 'pilot-m': [370, 520],
    results: [964, 651], 'results-m': [370, 323], recs: [964, 439], 'recs-m': [370, 368],
  },
  en: {
    products: [964, 451], 'products-m': [370, 524], groups: [964, 558], 'groups-m': [370, 667], pilot: [964, 601], 'pilot-m': [370, 540],
    results: [964, 642], 'results-m': [370, 323], recs: [964, 439], 'recs-m': [370, 347],
  },
}

function useShot() {
  const { locale } = useT()
  const lang = locale === 'ro' ? 'ro' : 'en'
  return (id: FeatureId, mobile = false) => {
    const key = mobile ? (`${id}-m` as const) : id
    return { src: `/site/features/${lang === 'en' ? 'en/' : ''}${key}.webp`, size: SIZES[lang][key] }
  }
}

export function Features() {
  const { t } = useT()
  return (
    <section id="features" className="scroll-mt-24 border-b border-line bg-neutral-50 px-5 py-24 md:py-32">
      <div className="mx-auto max-w-[1240px]">
        <SectionHeader titleA={t('site.feat_title_a')} titleB={t('site.feat_title_b')} desc={t('site.feat_desc')} />
        <Tour />
        <PhoneList />
        <Rules />
      </div>
    </section>
  )
}

/** Calculator: funcțiile în stânga, ecranul celei alese în dreapta, în fereastra aplicației. */
function Tour() {
  const { t } = useT()
  const reduce = useReducedMotion()
  const shot = useShot()
  const box = useRef<HTMLDivElement>(null)
  const inView = useInView(box, { amount: 0.4 })
  const [active, setActive] = useState(0)
  /** Ecranele se schimbă singure până alege omul unul. */
  const [auto, setAuto] = useState(true)
  const playing = auto && !reduce && inView

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => setActive(a => (a + 1) % FEATURES.length), DWELL_MS)
    return () => clearTimeout(timer)
  }, [playing, active])

  const pick = (i: number) => { setAuto(false); setActive(i) }

  return (
    <div ref={box} className="mt-16 hidden items-center gap-12 lg:grid lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)]">
      <ol>
        {FEATURES.map((f, i) => {
          const on = i === active
          return (
            <li key={f.id}>
              <button type="button" aria-pressed={on} onClick={() => pick(i)}
                className={cn('relative block w-full py-4 pl-7 text-left transition-opacity duration-300', on ? 'opacity-100' : 'opacity-40 hover:opacity-75')}>
                {/* Linia funcției de pe ecran; cât se schimbă singure, se umple până la următoarea */}
                <span aria-hidden className="absolute inset-y-3 left-0 w-[2px] overflow-hidden rounded-full bg-line">
                  {on && (
                    <motion.span key={`${active}-${playing}`} className="absolute inset-0 origin-top rounded-full bg-black"
                      initial={{ scaleY: playing ? 0 : 1 }} animate={{ scaleY: 1 }}
                      transition={{ duration: playing ? DWELL_MS / 1000 : 0, ease: 'linear' }} />
                  )}
                </span>
                <span className="block text-[1.2rem] font-semibold leading-snug tracking-[-0.025em] text-neutral-950">{t(`site.feat_${f.id}_title`)}</span>
                <span className="mt-1.5 block text-pretty text-[15px] leading-relaxed text-neutral-500">{t(`site.feat_${f.id}_desc`)}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <div>
        <AppWindow path={FEATURES[active].path}>
          <div className="relative h-[600px]">
            {FEATURES.map((f, i) => (
              <motion.div key={f.id} initial={false} aria-hidden={i !== active}
                animate={{ opacity: i === active ? 1 : 0, y: reduce ? 0 : i === active ? 0 : 12 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className={cn('absolute inset-0 flex items-center justify-center p-7', i !== active && 'pointer-events-none')}>
                {/* Fișierul e 2×: toate capturile sunt mai mari decât fereastra, deci se micșorează proporțional până încap */}
                <Image src={shot(f.id).src} alt={t(`site.feat_${f.id}_img`)} width={shot(f.id).size[0]} height={shot(f.id).size[1]} unoptimized
                  className="h-auto max-h-full w-auto max-w-full" />
              </motion.div>
            ))}
          </div>
        </AppWindow>
        <p className="mt-3 text-center text-[12.5px] text-neutral-400">{t('site.feat_caption')}</p>
      </div>
    </div>
  )
}

/** Telefon: fiecare funcție cu ecranul ei, unul sub altul. */
function PhoneList() {
  const { t } = useT()
  const shot = useShot()
  return (
    <div className="lg:hidden">
      <ol className="mt-12 space-y-14">
        {FEATURES.map(f => (
          <li key={f.id}>
            <h3 className="text-[1.35rem] font-semibold leading-snug tracking-[-0.03em] text-neutral-950">{t(`site.feat_${f.id}_title`)}</h3>
            <p className="mt-2 text-pretty text-[15.5px] leading-relaxed text-neutral-500">{t(`site.feat_${f.id}_desc`)}</p>
            <div className="mt-5 grid place-items-center rounded-[1.5rem] border border-line bg-[#f7f7f8] p-4">
              <Image src={shot(f.id, true).src} alt={t(`site.feat_${f.id}_img`)} width={shot(f.id, true).size[0]} height={shot(f.id, true).size[1]} unoptimized
                className="h-auto w-full max-w-[372px]" />
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-10 text-center text-[12.5px] text-neutral-400">{t('site.feat_caption')}</p>
    </div>
  )
}

/** Regulile pilotului, ca text simplu. */
function Rules() {
  const { t } = useT()
  return (
    <Reveal className="mt-20 md:mt-24">
      <h3 className="text-[1.15rem] font-semibold tracking-[-0.02em] text-neutral-950">{t('site.feat_rules_title')}</h3>
      <ul className="mt-6 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        {RULES.map(k => (
          <li key={k} className="text-pretty border-t border-line pt-4 text-[15px] leading-relaxed text-neutral-600">{t(`site.feat_rule_${k}`)}</li>
        ))}
      </ul>
    </Reveal>
  )
}
