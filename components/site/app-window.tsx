'use client'

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

// =============================================
// Fereastra aplicației, ca în browser: bara cu adresa paginii și, dedesubt,
// fundalul aplicației (#f7f7f8). O folosesc „De ce Hontrio" și „Cum funcționează".
// =============================================

export function AppWindow({ path, children, className }: { path: string; children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <div className={cn('overflow-hidden rounded-[1.75rem] border border-line bg-[#f7f7f8] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_40px_80px_-50px_rgba(0,0,0,0.35)]', className)}>
      <div className="flex items-center gap-3 border-b border-line bg-white/70 px-4 py-3">
        <span className="flex gap-1.5">{[0, 1, 2].map(i => <span key={i} className="size-2.5 rounded-full bg-neutral-200" />)}</span>
        <span className="min-w-0 truncate rounded-full bg-neutral-100 px-3 py-1 font-mono text-[12px] text-neutral-500">
          {/* i18n-ignore: adresa aplicației */}
          app.hontrio.com/<motion.span key={path} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="text-neutral-800">{path}</motion.span>
        </span>
      </div>
      {children}
    </div>
  )
}
