import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Reveal } from './fx'

// =============================================
// Piesele comune ale secțiunilor: eticheta mică (pastila de sus) și titlul în
// două tonuri, ca în CLIPPING: prima parte gri, a doua neagră.
// =============================================

export function Badge({ icon, children, dark = false, className }: { icon?: ReactNode; children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium [&_svg]:size-3.5',
      dark ? 'border-white/15 bg-white/[0.06] text-white/75 backdrop-blur-md' : 'border-line bg-white text-neutral-600', className)}>
      {icon}{children}
    </span>
  )
}

export function SectionHeader({ badge, icon, titleA, titleB, desc, align = 'center', className }: {
  badge: ReactNode; icon?: ReactNode; titleA: ReactNode; titleB: ReactNode; desc?: ReactNode; align?: 'center' | 'left'; className?: string
}) {
  return (
    <Reveal className={cn(align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl', className)}>
      <Badge icon={icon}>{badge}</Badge>
      <h2 className="mt-5 text-[2.1rem] font-bold leading-[1.06] tracking-[-0.04em] text-neutral-950 sm:text-5xl">
        <span className="text-neutral-400">{titleA}</span>{' '}
        <span className="whitespace-normal">{titleB}</span>
      </h2>
      {desc && <p className={cn('mt-5 text-[16px] leading-relaxed text-neutral-500 sm:text-[17px]', align === 'center' && 'mx-auto max-w-xl')}>{desc}</p>}
    </Reveal>
  )
}
