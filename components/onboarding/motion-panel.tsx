'use client'

import { useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useT } from '@/lib/i18n/context'

// =============================================
// Dreapta onboarding-ului: un clip motion design (produse care plutesc într-un
// studio alb-negru, generat pentru Hontrio), în buclă, cu o frază pentru
// fiecare pas. Clipul se încarcă doar pe ecranele late, unde se vede; cine
// cere mai puțină mișcare primește imaginea statică.
// =============================================

const WIDE = '(min-width: 1024px)'
const STILL = '(prefers-reduced-motion: reduce)'

function listen(query: string) {
  return (onChange: () => void) => {
    const list = window.matchMedia(query)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }
}
const subscribeWide = listen(WIDE)
const subscribeStill = listen(STILL)
const isWide = () => window.matchMedia(WIDE).matches
const isStill = () => window.matchMedia(STILL).matches
const never = () => false

export function MotionPanel({ step }: { step: number }) {
  const { t } = useT()
  const wide = useSyncExternalStore(subscribeWide, isWide, never)
  const still = useSyncExternalStore(subscribeStill, isStill, never)

  return (
    <div className="relative h-full overflow-hidden rounded-[1.75rem] bg-[#0b0b0b]">
      {wide && (still ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/onboarding/motion-poster.jpg" alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <video className="absolute inset-0 size-full object-cover" autoPlay muted loop playsInline preload="auto" poster="/onboarding/motion-poster.jpg" aria-hidden>
          <source src="/onboarding/motion.webm" type="video/webm" />
          <source src="/onboarding/motion.mp4" type="video/mp4" />
        </video>
      ))}

      {/* Fraza pasului, jos, peste o umbră ca să se citească pe orice cadru */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-10 pb-10 pt-32 text-white">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
            <p className="max-w-md text-balance text-[24px] font-semibold leading-[1.2] tracking-[-0.025em]">{t(`onboarding.visual_${step}_title`)}</p>
            <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-white/65">{t(`onboarding.visual_${step}_desc`)}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
