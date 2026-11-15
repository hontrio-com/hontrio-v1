'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, CirclePlay } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GuidePlayer, type Scene } from './player'
import { OPENCART } from './opencart'
import { WOOCOMMERCE } from './woocommerce'

// =============================================
// „Cum obții datele de conectare?" din formularele de conectare. WooCommerce și
// OpenCart au un ghid animat (panoul platformei, refăcut după capturi reale),
// cu pașii scriși dedesubt; celelalte platforme au doar pașii. Stă închis până
// îl ceri; la ghidurile animate, durata apare pe buton.
// =============================================

const SCENES: Record<string, Scene> = { woocommerce: WOOCOMMERCE, opencart: OPENCART }

/** Durata unei bucle, ca la un clip: „0:21". */
function length(scene: Scene) {
  const s = Math.round(scene.beats.reduce((sum, b) => sum + b.ms, 0) / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function Tutorial({ title, steps, platform }: { title: string; steps: { title: string; desc: string }[]; platform: string }) {
  const [open, setOpen] = useState(false)
  const scene = SCENES[platform] as Scene | undefined
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl bg-neutral-50 px-3.5 py-2.5 text-left text-[13px] font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200/70 transition-colors hover:bg-neutral-100/70">
        {scene && <CirclePlay className="size-4 shrink-0 text-neutral-900" />}
        <span className="flex-1">{title}</span>
        {scene && <span className="font-mono text-[11px] text-neutral-400">{length(scene)}</span>}
        <ChevronRight className={cn('size-4 shrink-0 text-neutral-400 transition-transform', open && 'rotate-90')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            {scene ? (
              <div className="px-px pb-1 pt-3">
                <GuidePlayer scene={scene} steps={steps} />
              </div>
            ) : (
              <ol className="space-y-3 px-1 pb-1 pt-3.5">
                {steps.map((s, i) => (
                  <li key={s.title} className="flex gap-3">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-neutral-100 font-mono text-[10px] font-semibold text-neutral-600">{i + 1}</span>
                    <span className="text-[13px] leading-relaxed text-neutral-600">
                      <span className="block font-semibold text-neutral-900">{s.title}</span>
                      {s.desc}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
