'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, CirclePlay } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GuidePlayer, type Scene } from './player'
import { GOMAG } from './gomag'
import { MERCHANTPRO } from './merchantpro'
import { OPENCART } from './opencart'
import { WOOCOMMERCE } from './woocommerce'

// =============================================
// „Cum obții datele de conectare?" din formularele de conectare: un ghid animat
// pentru fiecare platformă cu chei (WooCommerce, Gomag, MerchantPro, OpenCart),
// cu pașii scriși dedesubt. Stă închis până îl ceri; durata apare pe buton.
// =============================================

export type GuidePlatform = 'woocommerce' | 'gomag' | 'merchantpro' | 'opencart'

const SCENES: Record<GuidePlatform, Scene> = { woocommerce: WOOCOMMERCE, gomag: GOMAG, merchantpro: MERCHANTPRO, opencart: OPENCART }

/** Durata unei bucle, ca la un clip: „0:21". */
function length(scene: Scene) {
  const s = Math.round(scene.beats.reduce((sum, b) => sum + b.ms, 0) / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function Tutorial({ title, steps, platform }: { title: string; steps: { title: string; desc: string }[]; platform: GuidePlatform }) {
  const [open, setOpen] = useState(false)
  const scene = SCENES[platform]
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl bg-neutral-50 px-3.5 py-2.5 text-left text-[13px] font-medium text-neutral-700 ring-1 ring-inset ring-neutral-200/70 transition-colors hover:bg-neutral-100/70">
        <CirclePlay className="size-4 shrink-0 text-neutral-900" />
        <span className="flex-1">{title}</span>
        <span className="font-mono text-[11px] text-neutral-400">{length(scene)}</span>
        <ChevronRight className={cn('size-4 shrink-0 text-neutral-400 transition-transform', open && 'rotate-90')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <div className="px-px pb-1 pt-3">
              <GuidePlayer scene={scene} steps={steps} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
