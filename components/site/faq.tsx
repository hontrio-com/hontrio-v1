'use client'

import Link from 'next/link'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Reveal } from './fx'
import { TITLE, TITLE_SIZE, TwoTone } from './section'

// =============================================
// Întrebările (aleasă de proprietar dintre trei variante, 13.11.2026): pe ecran
// mare, un panou cu toate întrebările în stânga (cea aleasă se înnegrește) și
// răspunsul ei în dreapta, cu litere mari; se merge și din săgeți sau cu
// „Următoarea întrebare”. Pe telefon și tabletă, întrebările vin una sub alta
// și se deschid câte una. Textele sunt în site.faq_q{n} și site.faq_a{n}.
// =============================================

const EASE = [0.22, 1, 0.36, 1] as const

type FaqItem = { n: number; link?: { href: string; key: string } }

const FAQ_ITEMS: FaqItem[] = [
  { n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }, { n: 5 }, { n: 6 }, { n: 7 },
  { n: 8, link: { href: '/pricing', key: 'site.faq_a8_link' } },
  { n: 9, link: { href: '/legal/privacy', key: 'site.faq_a9_link' } },
]

const LINK = 'font-semibold text-neutral-950 underline decoration-neutral-300 underline-offset-[3px] transition-colors hover:decoration-neutral-950'

/** Răspunsul unei întrebări și, unde e cazul, legătura către pagina cu detaliile. */
function Answer({ item, className }: { item: FaqItem; className?: string }) {
  const { t } = useT()
  return (
    <p className={className}>
      {t(`site.faq_a${item.n}`)}
      {item.link && <>{' '}<Link href={item.link.href} className={LINK}>{t(item.link.key)}</Link></>}
    </p>
  )
}

/** Plusul care devine minus: bara verticală se culcă peste cea orizontală. */
function PlusMinus({ open }: { open: boolean }) {
  const reduce = useReducedMotion()
  return (
    <span aria-hidden className={cn('relative grid size-8 shrink-0 place-items-center rounded-full border transition-colors duration-300',
      open ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 text-neutral-950 group-hover:border-neutral-950')}>
      <span className="absolute h-[1.5px] w-3 rounded-full bg-current" />
      <motion.span className="absolute h-3 w-[1.5px] rounded-full bg-current" initial={false} animate={{ rotate: open ? 90 : 0 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 30 }} />
    </span>
  )
}

/** Telefon și tabletă: întrebările una sub alta, cu linii subțiri între ele; se deschide câte una (la început, prima). */
function FaqAccordion({ className }: { className?: string }) {
  const { t } = useT()
  const uid = useId()
  const reduce = useReducedMotion()
  const [open, setOpen] = useState<number | null>(FAQ_ITEMS[0].n)

  return (
    <ul className={cn('border-t border-neutral-200', className)}>
      {FAQ_ITEMS.map(item => {
        const isOpen = open === item.n
        return (
          <li key={item.n} className="border-b border-neutral-200">
            <h3>
              <button type="button" id={`${uid}-q${item.n}`} onClick={() => setOpen(isOpen ? null : item.n)} aria-expanded={isOpen} aria-controls={`${uid}-a${item.n}`}
                className="group flex w-full items-center justify-between gap-6 py-6 text-left">
                <span className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-neutral-950 md:text-[19px]">{t(`site.faq_q${item.n}`)}</span>
                <PlusMinus open={isOpen} />
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div key="answer" id={`${uid}-a${item.n}`} role="region" aria-labelledby={`${uid}-q${item.n}`}
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.4, ease: EASE }} className="overflow-hidden">
                  <Answer item={item} className="max-w-[62ch] pb-7 pr-12 text-[15.5px] leading-[1.7] text-neutral-600" />
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        )
      })}
    </ul>
  )
}

export function Faq() {
  const { t } = useT()
  const uid = useId()
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const item = FAQ_ITEMS[active]
  const last = FAQ_ITEMS.length - 1

  /** Săgețile sus/jos (și Home/End) mută întrebarea aleasă și focusul, ca într-o listă de file. */
  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const to = e.key === 'ArrowDown' ? (i === last ? 0 : i + 1)
      : e.key === 'ArrowUp' ? (i === 0 ? last : i - 1)
        : e.key === 'Home' ? 0 : e.key === 'End' ? last : null
    if (to === null) return
    e.preventDefault()
    setActive(to)
    tabs.current[to]?.focus()
  }

  return (
    <section id="faq" className="scroll-mt-24 border-t border-line px-5 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <h2 className={cn(TITLE_SIZE, TITLE)}>
            <TwoTone a={t('site.faq_title_a')} b={t('site.faq_title_b')} lineBreak />
          </h2>
          <div className="max-w-sm lg:pb-1.5">
            <p className="text-[16px] leading-relaxed text-neutral-500">{t('site.faq_desc')}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-neutral-500">
              {t('site.faq_contact')}{' '}
              <a href="mailto:contact@hontrio.com" className={LINK}>contact@hontrio.com</a>{/* i18n-ignore */}
            </p>
          </div>
        </Reveal>

        <FaqAccordion className="mt-12 lg:hidden" />

        {/* Ecran mare: întrebările în stânga, răspunsul în dreapta */}
        <Reveal delay={0.1} className="mt-14 hidden overflow-hidden rounded-[2rem] border border-line bg-white shadow-[0_30px_80px_-50px_rgba(0,0,0,0.35)] lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div role="tablist" aria-orientation="vertical" aria-label={t('site.faq_title_a')} className="flex flex-col gap-0.5 border-r border-line bg-neutral-50/80 p-3">
            {FAQ_ITEMS.map((it, i) => {
              const on = i === active
              return (
                <button key={it.n} ref={el => { tabs.current[i] = el }} type="button" role="tab" id={`${uid}-tab${i}`}
                  aria-selected={on} aria-controls={`${uid}-panel`} tabIndex={on ? 0 : -1}
                  onClick={() => setActive(i)} onKeyDown={e => onKey(e, i)}
                  className={cn('relative rounded-2xl px-5 py-[0.95rem] text-left text-[15.5px] font-medium leading-snug transition-colors duration-200',
                    on ? 'text-white' : 'text-neutral-600 hover:bg-black/[0.04] hover:text-neutral-950')}>
                  {on && (
                    <motion.span layoutId={`${uid}-on`} className="absolute inset-0 rounded-2xl bg-neutral-950 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.55)]"
                      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42 }} />
                  )}
                  <span className="relative">{t(`site.faq_q${it.n}`)}</span>
                </button>
              )
            })}
          </div>

          <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab${active}`} className="flex flex-col p-12 xl:p-14">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={item.n}
                initial={reduce ? false : { opacity: 0, y: 10, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -6, filter: 'blur(4px)' }}
                transition={{ duration: 0.26, ease: EASE }}>
                <h3 className="text-balance text-[28px] font-semibold leading-[1.15] tracking-[-0.025em] text-neutral-950">{t(`site.faq_q${item.n}`)}</h3>
                <Answer item={item} className="mt-5 text-pretty text-[17px] leading-[1.75] text-neutral-600" />
              </motion.div>
            </AnimatePresence>
            <button type="button" onClick={() => setActive(active === last ? 0 : active + 1)}
              className="group mt-auto inline-flex items-center gap-2 self-start pt-10 text-[14.5px] font-semibold text-neutral-950">
              {t('site.faq_next')}
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
