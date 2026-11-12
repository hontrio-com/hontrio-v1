'use client'

import Link from 'next/link'
import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, MessageCircleQuestion, Plus } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Reveal } from './fx'
import { Badge } from './section'

// =============================================
// Întrebările frecvente, ca în CLIPPING: în stânga titlul (lipit la derulare)
// și un card negru cu îndemnul, în dreapta acordeonul.
// =============================================

const QUESTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const

export function Faq() {
  const { t } = useT()
  const uid = useId()
  const [open, setOpen] = useState<number | null>(1)

  return (
    <section id="faq" className="scroll-mt-24 border-t border-line px-5 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Reveal>
            <Badge icon={<MessageCircleQuestion />}>{t('site.faq_badge')}</Badge>
            <h2 className="mt-5 text-[2.1rem] font-bold leading-[1.06] tracking-[-0.04em] text-neutral-950 sm:text-5xl">
              {t('site.faq_title_a')}<br /><span className="text-neutral-400">{t('site.faq_title_b')}</span>
            </h2>
            <p className="mt-4 max-w-sm text-[16px] leading-relaxed text-neutral-500">{t('site.faq_desc')}</p>
          </Reveal>
          <Reveal delay={0.1} className="relative mt-8 hidden overflow-hidden rounded-3xl bg-[#0a0a0a] p-6 text-white lg:block">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl" />
            <p className="relative text-lg font-semibold">{t('site.faq_side_title')}</p>
            <p className="relative mt-1 text-sm text-white/60">{t('site.faq_side_desc')}</p>
            <Link href="/register" className="group relative mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
              {t('site.faq_side_cta')}<ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </Link>
          </Reveal>
        </div>

        <div className="space-y-3">
          {QUESTIONS.map((n, i) => {
            const isOpen = open === n
            return (
              <Reveal key={n} delay={i * 0.04} y={14}>
                <div className={cn('overflow-hidden rounded-3xl border transition-colors duration-300',
                  isOpen ? 'border-black bg-white shadow-[0_24px_60px_-35px_rgba(0,0,0,0.45)]' : 'border-line bg-white/70 hover:border-neutral-300 hover:bg-white')}>
                  <h3>
                    <button type="button" onClick={() => setOpen(isOpen ? null : n)} aria-expanded={isOpen} aria-controls={`${uid}-${n}`}
                      className="flex w-full items-center gap-4 p-5 text-left md:p-6">
                      <span className={cn('font-mono text-xs transition-colors', isOpen ? 'text-black' : 'text-neutral-400')}>{String(n).padStart(2, '0')}</span>
                      <span className="flex-1 text-[16px] font-semibold tracking-tight text-neutral-950 md:text-[17px]">{t(`site.faq_q${n}`)}</span>
                      <motion.span animate={{ rotate: isOpen ? 135 : 0, backgroundColor: isOpen ? '#0a0a0a' : '#f5f5f5', color: isOpen ? '#ffffff' : '#0a0a0a' }}
                        transition={{ type: 'spring', stiffness: 300, damping: 22 }} className="grid size-9 shrink-0 place-items-center rounded-full">
                        <Plus className="size-4" />
                      </motion.span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div id={`${uid}-${n}`} key="answer" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
                        <p className="px-5 pb-6 pl-[3.25rem] text-[15px] leading-relaxed text-neutral-500 md:px-6 md:pl-[3.6rem]">
                          {t(`site.faq_a${n}`)}
                          {/* Răspunsul despre cost trimite la grila întreagă */}
                          {n === 8 && <>{' '}<Link href="/pricing" className="font-semibold text-neutral-950 underline decoration-neutral-300 underline-offset-[3px] hover:decoration-neutral-950">{t('site.faq_a8_link')}</Link></>}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
