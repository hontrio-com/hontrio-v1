import type { ReactNode } from 'react'

// Așezarea paginii Setări, comună tuturor tab-urilor: în stânga ce e, în dreapta setarea.

/** O secțiune a setărilor: în stânga ce e, în dreapta setarea. */
export function Section({ title, description, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 border-b border-neutral-200/70 py-8 first:pt-2 last:border-0 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-900">{title}</h2>
        {description && <div className="mt-1 text-[13px] leading-relaxed text-neutral-500">{description}</div>}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  )
}

/** Eticheta unui câmp, cu câmpul sub ea. */
export function Label({ text, hint, children }: { text: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-neutral-700">{text}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1.5 block text-[12px] text-neutral-500">{hint}</span>}
    </label>
  )
}
