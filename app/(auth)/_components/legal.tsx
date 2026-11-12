'use client'

import { Fragment, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

// =============================================
// Textele cu linkuri spre documentele legale (Termeni, DPA, Confidențialitate):
// propoziția vine întreagă din dicționar, cu {{terms}}, {{dpa}} și {{privacy}}
// în locul linkurilor, ca ordinea cuvintelor să fie firească în fiecare limbă.
// =============================================

const LINKS = {
  terms: { href: '/legal/terms', key: 'auth.terms_link' },
  dpa: { href: '/legal/dpa', key: 'auth.dpa_link' },
  privacy: { href: '/legal/privacy', key: 'auth.privacy_link' },
} as const

/** O propoziție din dicționar, cu linkurile puse la locul lor. */
export function LegalText({ text }: { text: string }) {
  const { t } = useT()
  const parts = text.split(/(\{\{\s*(?:terms|dpa|privacy)\s*\}\})/)
  return (
    <>
      {parts.map((part, i) => {
        const name = /^\{\{\s*(terms|dpa|privacy)\s*\}\}$/.exec(part)?.[1] as keyof typeof LINKS | undefined
        if (!name) return <Fragment key={i}>{part}</Fragment>
        const link = LINKS[name]
        return (
          <a key={i} href={link.href} target="_blank" rel="noopener" className="font-medium text-neutral-800 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-800">
            {t(link.key)}
          </a>
        )
      })}
    </>
  )
}

/** O căsuță obligatorie, cu textul (și linkurile) lângă ea; ca Checkbox din components/app, pe mai multe rânduri. */
export function Consent({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-relaxed text-neutral-600">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} aria-required="true" className="peer sr-only" />
      <span className={cn('mt-[3px] flex size-4 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-[3px] peer-focus-visible:ring-neutral-900/20',
        checked ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white')}>
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span>{children}</span>
    </label>
  )
}
