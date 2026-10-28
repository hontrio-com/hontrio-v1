import type { ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// =============================================
// Câmpurile platformei: contur fin, inel în culoarea accentului la focus,
// roșu când valoarea nu e bună (aria-invalid). Opțional o iconiță în stânga
// (căutarea) și ce se scrie după valoare (moneda), în dreapta.
// =============================================

export const inputStyles = 'h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px] text-neutral-900 shadow-[0_1px_2px_rgb(16_24_40/0.04)] outline-none transition-[border-color,box-shadow] placeholder:text-neutral-400 focus:border-brand-500 focus:ring-[3px] focus:ring-brand-600/15 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400 aria-[invalid=true]:border-red-300 aria-[invalid=true]:focus:ring-red-500/15'

export function Input({ className, icon, suffix, wrapperClassName, ...props }: React.ComponentProps<'input'> & {
  icon?: ReactNode
  suffix?: ReactNode
  wrapperClassName?: string
}) {
  if (!icon && !suffix) return <input className={cn(inputStyles, className)} {...props} />
  return (
    <div className={cn('relative', wrapperClassName)}>
      {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 [&_svg]:size-3.5">{icon}</span>}
      <input className={cn(inputStyles, icon && 'pl-8', suffix && 'pr-12', className)} {...props} />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-neutral-400">{suffix}</span>}
    </div>
  )
}

/** O alegere dintr-un grup (ca un radio), sub formă de card: titlul, o frază și, opțional, o cifră. */
export function ChoiceCard({ active, onClick, disabled, title, description, aside, footer, className }: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  title: ReactNode
  description?: ReactNode
  /** În dreapta titlului (ex. „Recomandat" sau un indicator de încărcare). */
  aside?: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active}
      className={cn('group relative flex w-full flex-col rounded-xl border bg-white p-3.5 text-left transition-[border-color,box-shadow,background-color] duration-150 disabled:cursor-not-allowed disabled:opacity-55',
        active ? 'border-brand-600 bg-brand-50/30 ring-1 ring-brand-600' : 'border-neutral-200 hover:border-neutral-300 hover:shadow-card', className)}>
      <span className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-semibold text-neutral-900">{title}</span>
        <span className="flex shrink-0 items-center gap-2">
          {aside}
          <span className={cn('flex size-4 items-center justify-center rounded-full border transition-colors',
            active ? 'border-brand-600 bg-brand-600' : 'border-neutral-300 bg-white group-hover:border-neutral-400')}>
            {active && <span className="size-1.5 rounded-full bg-white" />}
          </span>
        </span>
      </span>
      {description && <span className="mt-1 block text-[12px] leading-relaxed text-neutral-500">{description}</span>}
      {footer && <span className="mt-auto block pt-3">{footer}</span>}
    </button>
  )
}

/** O listă de alegeri nativă (accesibilă, merge și pe telefon), cu aspectul câmpurilor. */
export function Select({ className, wrapperClassName, children, ...props }: React.ComponentProps<'select'> & { wrapperClassName?: string }) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      <select className={cn(inputStyles, 'cursor-pointer appearance-none pr-8', className)} {...props}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
    </div>
  )
}

/** O căsuță de bifat cu eticheta ei. */
export function Checkbox({ checked, onChange, children, className }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode; className?: string }) {
  return (
    <label className={cn('inline-flex cursor-pointer select-none items-center gap-2 text-[13px] text-neutral-700', className)}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="peer sr-only" />
      <span className={cn('flex size-4 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-[3px] peer-focus-visible:ring-neutral-900/20',
        checked ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white')}>
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      {children}
    </label>
  )
}

/** Un comutator pornit / oprit (ca la iOS), pentru o setare care se aplică imediat sau la salvare. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-neutral-900/20 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-neutral-900' : 'bg-neutral-200')}>
      <span className={cn('inline-block size-5 rounded-full bg-white shadow-[0_1px_3px_rgb(16_24_40/0.2)] transition-transform duration-200', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  )
}

/** Un câmp de text pe mai multe rânduri, cu aspectul celorlalte câmpuri. */
export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea className={cn(inputStyles, 'h-auto min-h-24 resize-none py-2.5 leading-relaxed', className)} {...props} />
}
