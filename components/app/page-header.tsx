import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// =============================================
// Capul fiecărei pagini: ce e pagina (titlul), la ce folosește (o frază) și
// acțiunea principală, în dreapta. Sub el, opțional, filele paginii.
// =============================================

export function PageHeader({ title, description, actions, meta, children, className }: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** Un rând mic deasupra titlului (ex. starea pilotului). */
  meta?: ReactNode
  /** Filele paginii. */
  children?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('space-y-5', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {meta && <div className="mb-2 flex flex-wrap items-center gap-2">{meta}</div>}
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em] text-neutral-950">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-neutral-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  )
}
