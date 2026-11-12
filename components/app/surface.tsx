import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// =============================================
// Suprafețele, în designul Bezeno: cardul (alb, colțuri mari, contur fin,
// umbră abia simțită, care se adâncește la hover pe cele interactive) și
// secțiunea (un titlu cu descriere și acțiuni, peste conținut).
// =============================================

export function Card({ className, interactive, ...props }: React.ComponentProps<'div'> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[1.25rem] border border-line bg-white shadow-card',
        interactive && 'transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-raised',
        className,
      )}
      {...props}
    />
  )
}

/** Suprafața mare a unei pagini (Bezeno · Surface): colțuri foarte mari, umbră lungă și fină. */
export function Surface({ className, dotted, children, ...props }: React.ComponentProps<'div'> & { dotted?: boolean }) {
  return (
    <div className={cn('relative overflow-hidden rounded-[1.75rem] border border-line bg-white shadow-[var(--shadow-surface)]', className)} {...props}>
      {dotted && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)] [background-size:16px_16px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      )}
      <div className="relative">{children}</div>
    </div>
  )
}

export function CardHeader({ title, description, action, icon, className }: {
  title: ReactNode; description?: ReactNode; action?: ReactNode; icon?: ReactNode; className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700 ring-1 ring-black/5 [&_svg]:size-4">{icon}</div>}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-neutral-950">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-500">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}

export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-center justify-between gap-3 rounded-b-[1.25rem] border-t border-line bg-neutral-50/60 px-5 py-3', className)} {...props} />
}

/** O secțiune a paginii (Bezeno · „Your projects"): titlul ei, de ce contează, și ce poți face. */
export function Section({ title, description, action, children, className }: {
  title: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-950">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-neutral-500">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
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
