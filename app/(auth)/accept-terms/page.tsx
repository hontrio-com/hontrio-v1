'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { ArrowRight } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { TERMS_VERSION } from '@/lib/auth/validation'
import { AuthCard, AuthToast, SubmitButton, type AuthNotice } from '@/components/auth/ui'
import { Consent, LegalText } from '../_components/legal'

// =============================================
// Acordul pentru Termeni, cu aceleași două căsuțe ca la înscriere: Termenii
// (cu DPA) și Confidențialitatea, apoi clauzele acceptate expres (art. 1203
// C. civ.). Două situații:
// - contul nu l-a dat încă (făcut cu Google, sau de dinainte de acord): până
//   la acord, proxy-ul trimite aici orice pagină a platformei;
// - o versiune nouă, din anunțul din aplicație: pagina spune ce s-a schimbat,
//   iar omul o poate accepta acum sau mai târziu (nu oprește nimic).
// =============================================

/** Schimbările versiunii de acum (TERMS_VERSION), în ordinea din Termeni. */
const CHANGES = ['auth.terms_update_gomag', 'auth.terms_update_support'] as const

export default function AcceptTermsPage() {
  const { t, intlLocale } = useT()
  const router = useRouter()
  const { data: session, update } = useSession()
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptClauses, setAcceptClauses] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<AuthNotice>(null)

  // Contul a acceptat o versiune mai veche: acum e vorba de cea nouă
  const accepted = (session?.user as { termsVersion?: string | null } | undefined)?.termsVersion
  const updating = typeof accepted === 'string' && accepted < TERMS_VERSION
  const date = new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${TERMS_VERSION}T00:00:00Z`))

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 5000) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!acceptTerms || !acceptClauses) { showToast(t('auth.terms_gate_required'), 'error'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/accept-terms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept_terms: true, accept_clauses: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(data.error || t('common.error_generic'), 'error'); setLoading(false); return }
      // Sesiunea află de acord (altfel proxy-ul ar trimite înapoi aici, iar anunțul ar rămâne), apoi mai departe
      const next = await update()
      const onboarded = (next?.user as { onboardingCompleted?: boolean } | undefined)?.onboardingCompleted === true
      router.replace(onboarded ? '/dashboard' : '/onboarding')
    } catch {
      showToast(t('auth.connection_error'), 'error')
      setLoading(false)
    }
  }

  const email = session?.user?.email

  return (
    <>
      <AuthToast notice={toast} onClose={() => setToast(null)} />
      <AuthCard title={updating ? t('auth.terms_update_title') : t('auth.terms_gate_title')}
        description={updating ? t('auth.terms_update_desc', { date }) : t('auth.terms_gate_desc')}
        footer={updating
          ? <Link href="/dashboard" className="font-semibold text-black underline-offset-4 hover:underline">{t('auth.terms_update_later')}</Link>
          : <>
            {email && <>{t('auth.terms_gate_signed_in', { email })}{' '}</>}
            <button type="button" onClick={() => signOut({ callbackUrl: '/login' })} className="font-semibold text-black underline-offset-4 hover:underline">{t('common.logout')}</button>
          </>}>
        <form onSubmit={handleSubmit} className="space-y-5">
          {updating && (
            <ul className="list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-neutral-600">
              {CHANGES.map(key => <li key={key}>{t(key)}</li>)}
            </ul>
          )}
          <div className="space-y-2.5">
            <Consent checked={acceptTerms} onChange={setAcceptTerms}><LegalText text={t('auth.accept_terms_label')} /></Consent>
            <Consent checked={acceptClauses} onChange={setAcceptClauses}>{t('auth.accept_clauses_label')}</Consent>
          </div>
          <SubmitButton loading={loading}>{updating ? t('auth.terms_update_button') : t('auth.terms_gate_button')}<ArrowRight /></SubmitButton>
        </form>
      </AuthCard>
    </>
  )
}
