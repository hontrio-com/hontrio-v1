import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// =============================================
// Suprafețele: cardul (alb, contur de un pixel, umbră fină) și secțiunea
// (un titlu cu descriere și acțiuni, peste conținut). Aceleași pe toate
// paginile, ca ochiul să găsească imediat ce caută.
// =============================================

export function Card({ className, interactive, ...props }: React.ComponentProps<'div'> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-neutral-200/80 bg-white shadow-card',
        interactive && 'transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-px hover:border-neutral-300 hover:shadow-raised',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ title, description, action, icon, className }: {
  title: ReactNode; description?: ReactNode; action?: ReactNode; icon?: ReactNode; className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 [&_svg]:size-4">{icon}</div>}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-900">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-500">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}

export function CardBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-5 py-5', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50/50 px-5 py-3 rounded-b-xl', className)} {...props} />
}

/** O secțiune a paginii: titlul ei, de ce contează, și ce poți face. */
export function Section({ title, description, action, children, className }: {
  title: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-900">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-neutral-500">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  )
}

/** Un rând etichetă — valoare, în fișa unei campanii sau a unui plan. */
export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[180px_1fr] sm:gap-6">
      <dt className="text-[13px] text-neutral-500">{label}</dt>
      <dd className="min-w-0">
        <div className="text-[13px] font-medium text-neutral-900">{children}</div>
        {hint && <p className="mt-0.5 text-[12px] leading-relaxed text-neutral-500">{hint}</p>}
      </dd>
    </div>
  )
}
