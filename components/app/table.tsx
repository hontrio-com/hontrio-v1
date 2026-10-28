import { cn } from '@/lib/utils'

// =============================================
// Tabelele platformei: antet discret, rânduri aerisite, cifrele aliniate la
// dreapta, rândul se luminează la trecerea mouse-ului (și e clicabil, când
// deschide ceva).
// =============================================

export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-separate border-spacing-0 text-left text-[13px]', className)} {...props} />
    </div>
  )
}

export function Th({ className, align, ...props }: React.ComponentProps<'th'> & { align?: 'right' }) {
  return (
    <th className={cn('h-9 whitespace-nowrap border-b border-neutral-200 bg-neutral-50/70 px-3 text-[12px] font-medium text-neutral-500 first:pl-5 last:pr-5',
      align === 'right' && 'text-right', className)} {...props} />
  )
}

export function Tr({ className, clickable, ...props }: React.ComponentProps<'tr'> & { clickable?: boolean }) {
  return <tr className={cn('group transition-colors [&>td]:border-b [&>td]:border-neutral-100 last:[&>td]:border-0 hover:bg-neutral-50/80', clickable && 'cursor-pointer', className)} {...props} />
}

export function Td({ className, align, ...props }: React.ComponentProps<'td'> & { align?: 'right' }) {
  return <td className={cn('px-3 py-3 align-middle first:pl-5 last:pr-5', align === 'right' && 'text-right tabular-nums', className)} {...props} />
}
