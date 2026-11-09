'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Zap } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { FlickeringGrid } from './fx'
import { Badge } from './section'

// =============================================
// Îndemnul de la final: un panou negru cu pătrățele care pâlpâie (Magic UI ·
// Flickering Grid) și o lumină moale la mijloc, pentru lizibilitate.
// =============================================

export function FinalCta() {
  const { t } = useT()
  const reduce = useReducedMotion()
  return (
    <section className="px-5 pb-24 md:pb-28">
      <motion.div initial={reduce ? false : { opacity: 0, y: 40, scale: 0.98 }} whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-[#0a0a0a] shadow-[0_50px_120px_-40px_rgba(0,0,0,0.6)]">
        <FlickeringGrid className="[mask-image:radial-gradient(ellipse_80%_70%_at_50%_50%,transparent_20%,black_75%)]" maxOpacity={0.22} chance={0.3} />
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-white/[0.08] blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[2.5rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_0_0_1px_rgba(255,255,255,0.06)]" />

        <div className="relative flex flex-col items-center px-6 py-20 text-center text-white md:py-28">
          <Badge dark icon={<Zap />}>{t('site.cta_badge')}</Badge>
          <h2 className="mt-6 max-w-3xl text-[2.3rem] font-bold leading-[1.05] tracking-[-0.04em] md:text-6xl">
            {t('site.cta_title_a')}<br />
            <span className="bg-gradient-to-b from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent">{t('site.cta_title_b')}</span>
          </h2>
          <p className="mt-5 max-w-md text-[16px] leading-relaxed text-white/65">{t('site.cta_desc')}</p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <Link href="/register" className="group relative flex h-12 items-center gap-2 overflow-hidden rounded-full bg-white px-7 text-[15px] font-semibold text-black shadow-[inset_0_-2px_0_rgba(0,0,0,0.12),0_12px_30px_-10px_rgba(255,255,255,0.4)] transition hover:scale-[1.02] motion-reduce:hover:scale-100">
              <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-black/10 to-transparent transition-transform duration-700 group-hover:translate-x-full motion-reduce:hidden" />
              <span className="relative">{t('site.cta_primary')}</span>
              <ArrowRight className="relative size-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link href="/login" className="flex h-12 items-center rounded-full border border-white/25 bg-white/5 px-7 text-[15px] font-semibold text-white backdrop-blur-md transition hover:bg-white/15">
              {t('site.cta_secondary')}
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
