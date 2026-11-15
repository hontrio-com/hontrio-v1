'use client'

import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { useT } from '@/lib/i18n/context'
import { SectionHeader } from './section'
import { AdsSim, AdsSteps } from './optimize-ads/ads-sim'

// =============================================
// Varianta 2 a secțiunii „Pilotul automat lucrează direct în contul tău Google Ads”:
// pilotul, direct în contul Google Ads al magazinului. Fereastra rămâne fixată
// cât derulezi (ca în capul paginii), iar derularea o duce pas cu pas: căutările
// care au costat fără vânzări devin cuvinte negative exacte, produsele care
// cheltuie mai mult decât vând ies din campanie, bugetul urcă de la 40 la 48 RON
// pe zi după ce aprobi tu. Totul pe un cont demonstrativ, fără rezultate promise.
// Cât secțiunea nu e pe ecran, nu se mișcă nimic: totul ține de derulare.
// =============================================

const EASE = [0.22, 1, 0.36, 1] as const

export function OptimizeAds() {
  const { t } = useT()
  const reduce = useReducedMotion()
  const track = useRef<HTMLDivElement>(null)
  // Cât timp fereastra stă fixată (sub antet, la 76px): progresul poveștii, 0 → 1
  const { scrollYProgress: story } = useScroll({ target: track, offset: ['start 76px', 'end end'] })
  // Cât urcă spre locul ei: se îndreaptă
  const { scrollYProgress: enter } = useScroll({ target: track, offset: ['start end', 'start 76px'] })
  const rotateX = useTransform(enter, [0, 1], [12, 0])
  const scale = useTransform(enter, [0, 1], [0.95, 1])

  return (
    // Fără overflow-hidden pe secțiune: ar opri fixarea ferestrei (sticky)
    <section id="optimize" className="relative scroll-mt-24 px-5 pb-20 pt-24 md:pb-28 md:pt-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeader titleA={t('site.opt2_title_a')} titleB={t('site.opt2_title_b')} desc={t('site.opt2_desc')} />

        <div ref={track} className="relative mt-12 h-[280vh] md:mt-14 md:h-[330vh]">
          <div className="sticky top-[76px] flex h-[calc(100svh-76px)] flex-col justify-center gap-4 pb-4">
            <AdsSteps progress={story} />
            <motion.div style={reduce ? undefined : { rotateX, scale, transformPerspective: 1600, transformOrigin: '50% 0%' }}
              initial={reduce ? false : { opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.8, ease: EASE }}>
              <AdsSim progress={story} />
            </motion.div>
            <p className="mx-auto max-w-2xl text-pretty text-center text-[12.5px] leading-relaxed text-neutral-400">{t('site.opt2_note')}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
