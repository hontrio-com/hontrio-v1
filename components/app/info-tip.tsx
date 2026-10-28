'use client'

import type { ReactNode } from 'react'
import { CircleHelp } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useT } from '@/lib/i18n/context'

// =============================================
// Explicațiile stau în spatele unui „?" mic, nu în paragrafe pe pagină:
// pagina rămâne curată, iar cine vrea să știe de ce, află la un hover.
// =============================================

export function InfoTip({ children, side = 'top' }: { children: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  const { t } = useT()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={t('common.more_info')}
          className="inline-flex size-4 items-center justify-center rounded-full text-neutral-300 transition-colors hover:text-neutral-500 focus-visible:text-neutral-600 focus-visible:outline-none">
          <CircleHelp className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={6} className="max-w-[280px] bg-neutral-900 px-3 py-2 text-[12px] leading-relaxed text-white [&_svg]:fill-neutral-900 [&>span]:hidden">
        {children}
      </TooltipContent>
    </Tooltip>
  )
}
