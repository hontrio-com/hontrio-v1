'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { FileText } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { TERMS_VERSION } from '@/lib/auth/validation'

// =============================================
// Anunțul unei versiuni noi a Termenilor, pentru conturile care au acceptat
// una mai veche. Nu oprește nimic: schimbările care cer acord expres (art.
// 18.2) se aplică doar după ce omul o acceptă, pe /accept-terms. Ascuns cât
// administratorul este în contul clientului (n-o poate accepta în locul lui).
// =============================================

export function TermsUpdateBanner() {
  const { data: session } = useSession()
  const { t, intlLocale } = useT()
  const version = (session?.user as { termsVersion?: string | null } | undefined)?.termsVersion
  if (!version || version >= TERMS_VERSION || session?.impersonator) return null
  const date = new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${TERMS_VERSION}T00:00:00Z`))

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-sm">
      <p className="flex min-w-0 items-start gap-2.5 text-[13px] leading-relaxed text-neutral-700">
        <FileText className="mt-0.5 size-4 shrink-0 text-neutral-400" />
        <span>{t('auth.terms_update_banner', { date })}</span>
      </p>
      <Link href="/accept-terms" className="inline-flex h-8 shrink-0 items-center rounded-full bg-neutral-950 px-3.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90">
        {t('auth.terms_update_banner_cta')}
      </Link>
    </div>
  )
}
