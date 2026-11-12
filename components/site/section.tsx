import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Reveal } from './fx'

// =============================================
// Titlurile secțiunilor, în stilul celui din capul paginii: prima parte neagră,
// a doua cu un degrade de sus în jos, de la negru la gri (pe fond închis, de la
// alb la gri). Fără etichete mici deasupra (cerut de proprietar, 12.11.2026).
// =============================================

/** Litera titlurilor, aceeași ca la titlul din capul paginii. */
export const TITLE = 'font-bold leading-[1.06] tracking-[-0.045em]'
/** Mărimea titlurilor de secțiune (titlul din capul paginii e mai mare). */
export const TITLE_SIZE = 'text-[2.3rem] sm:text-5xl lg:text-[3.6rem]'

// Degradeul se ia pe fiecare rând (box-decoration-break), ca la cuvintele titlului de sus
const FADE = 'bg-gradient-to-b bg-clip-text pb-[0.08em] text-transparent [-webkit-box-decoration-break:clone] [box-decoration-break:clone]'

/** Cele două părți ale unui titlu: prima plină, a doua în degrade. */
export function TwoTone({ a, b, dark = false, lineBreak = false }: {
  a: ReactNode; b: ReactNode; dark?: boolean
  /** true: a doua parte pe rândul ei; 'sm': doar de la ecranele mici în sus */
  lineBreak?: boolean | 'sm'
}) {
  return (
    <>
      <span className={dark ? 'text-white' : 'text-neutral-950'}>{a}</span>
      {lineBreak === 'sm' ? <><br className="hidden sm:block" />{' '}</> : lineBreak ? <br /> : ' '}
      <span className={cn(FADE, dark ? 'from-white via-neutral-200 to-neutral-500' : 'from-neutral-950 via-neutral-700 to-neutral-400')}>{b}</span>
    </>
  )
}

/** Titlul unei secțiuni (fără etichetă deasupra, ca titlul din capul paginii) și descrierea lui. */
export function SectionHeader({ titleA, titleB, desc, align = 'center', className }: {
  titleA: ReactNode; titleB: ReactNode; desc?: ReactNode; align?: 'center' | 'left'; className?: string
}) {
  return (
    <Reveal className={cn(align === 'center' ? 'mx-auto max-w-4xl text-center' : 'max-w-3xl', className)}>
      <h2 className={cn('text-balance', TITLE, TITLE_SIZE)}>
        <TwoTone a={titleA} b={titleB} />
      </h2>
      {desc && <p className={cn('mt-5 text-pretty text-[16px] leading-relaxed text-neutral-500 sm:text-[17px]', align === 'center' && 'mx-auto max-w-xl')}>{desc}</p>}
    </Reveal>
  )
}
