'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { ArrowRight } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { AuthCard, AuthToast, SubmitButton, type AuthNotice } from '@/components/auth/ui'
import { Consent, LegalText } from '../_components/legal'

// =============================================
// Acordul unui cont care nu l-a dat încă: contul făcut cu Google (Google nu
// întreabă de Termeni) și conturile de dinainte de acord. Aceleași două căsuțe
// ca la înscriere: Termenii (cu DPA) și Confidențialitatea, apoi clauzele
// acceptate expres (art. 1203 C. civ.). Până la acord, proxy-ul trimite aici
// orice pagină a platformei.
// =============================================

export default function AcceptTermsPage() {
  const { t } = useT()
  const router = useRouter()
  const { data: session, update } = useSession()
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptClauses, setAcceptClauses] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<AuthNotice>(null)

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
      // Sesiunea află de acord (altfel proxy-ul ar trimite înapoi aici), apoi mai departe
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
      <AuthCard title={t('auth.terms_gate_title')} description={t('auth.terms_gate_desc')}
        footer={<>
          {email && <>{t('auth.terms_gate_signed_in', { email })}{' '}</>}
          <button type="button" onClick={() => signOut({ callbackUrl: '/login' })} className="font-semibold text-black underline-offset-4 hover:underline">{t('common.logout')}</button>
        </>}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2.5">
            <Consent checked={acceptTerms} onChange={setAcceptTerms}><LegalText text={t('auth.accept_terms_label')} /></Consent>
            <Consent checked={acceptClauses} onChange={setAcceptClauses}>{t('auth.accept_clauses_label')}</Consent>
          </div>
          <SubmitButton loading={loading}>{t('auth.terms_gate_button')}<ArrowRight /></SubmitButton>
        </form>
      </AuthCard>
    </>
  )
}
