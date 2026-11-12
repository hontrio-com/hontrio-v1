'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Reveal } from './fx'
import { TITLE, TITLE_SIZE, TwoTone } from './section'
import { IsoFilters } from './iso/primitives'
import { IsoConnect } from './iso/connect'
import { IsoLaunch } from './iso/launch'
import { IsoPilot } from './iso/pilot'

// =============================================
// Cum funcționează, imediat după capul paginii: trei pași, fiecare cu o
// ilustrație izometrică animată (în stilul celor de pe opteo.com, alb pe negru),
// un titlu scurt și o propoziție. Conectezi magazinul și Google, lansezi
// campania, apoi pilotul are grijă de ea zilnic, după regulile din
// docs/campanii/SPECIFICATIE.md. Fără etichete deasupra titlurilor.
// =============================================

const STEPS = [
  { id: 'connect', Art: IsoConnect },
  { id: 'launch', Art: IsoLaunch },
  { id: 'pilot', Art: IsoPilot },
] as const

const EASE = [0.22, 1, 0.36, 1] as const

export function HowItWorks() {
  const { t } = useT()
  const reduce = useReducedMotion()
  return (
    <section id="how" className="scroll-mt-24 px-2 sm:px-4">
      <IsoFilters />
      <div className="mx-auto max-w-[1440px] rounded-[1.75rem] bg-black px-5 py-20 text-white sm:rounded-[2.5rem] sm:px-8 md:py-28 lg:px-12">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className={cn('text-balance', TITLE_SIZE, TITLE)}>
            <TwoTone dark a={t('site.how_title_a')} b={t('site.how_title_b')} lineBreak="sm" />
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-[16px] leading-relaxed text-white/60 sm:text-[17px]">{t('site.how_desc')}</p>
        </Reveal>

        <ol className="mx-auto mt-14 grid max-w-[460px] gap-16 md:mt-20 lg:max-w-[1240px] lg:grid-cols-3 lg:gap-10">
          {STEPS.map(({ id, Art }, i) => (
            <motion.li key={id} initial={reduce ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7, delay: i * 0.1, ease: EASE }}>
              <Art label={t(`site.how_${id}_img`)} />
              <div className="mt-6 px-1">
                <p className="font-mono text-[13px] text-white/40">{`0${i + 1}`}</p>
                <h3 className="mt-2 text-[1.3rem] font-semibold tracking-[-0.025em]">{t(`site.how_${id}_title`)}</h3>
                <p className="mt-2 text-pretty text-[15px] leading-relaxed text-white/55">{t(`site.how_${id}_desc`)}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}
