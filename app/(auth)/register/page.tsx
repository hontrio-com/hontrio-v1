'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n/context'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { Mail, Lock, User, ArrowRight, MailCheck, RefreshCw } from 'lucide-react'
import { Button } from '@/components/app/button'
import { AuthCard, AuthField, AuthToast, GoogleButton, OrDivider, PasswordField, SubmitButton, type AuthNotice } from '@/components/auth/ui'
import { checkEmail, checkName, checkPassword, NAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from '@/lib/auth/validation'
import { Consent, LegalText } from '../_components/legal'
import { Turnstile, turnstileOn } from '../_components/turnstile'

// =============================================
// Cont nou: nume, e-mail, parolă și acordul pentru Termeni (cu DPA),
// Confidențialitate și clauzele acceptate expres (art. 1203 C. civ.).
// Contul se activează din linkul trimis pe e-mail; până atunci nu se poate intra.
// =============================================

export default function RegisterPage() {
  const { t } = useT()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptClauses, setAcceptClauses] = useState(false)
  const [captcha, setCaptcha] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [gLoading, setGLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [toast, setToast] = useState<AuthNotice>(null)

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 5000) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = checkName(name)
    if (!n.ok) { showToast(t(n.error), 'error'); return }
    const em = checkEmail(email)
    if (!em.ok) { showToast(t(em.error), 'error'); return }
    const pw = checkPassword(password)
    if (!pw.ok) { showToast(t(pw.error), 'error'); return }
    if (!acceptTerms || !acceptClauses) { showToast(t('auth.terms_required'), 'error'); return }
    if (turnstileOn && !captcha) { showToast(t('auth.captcha_wait'), 'error'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n.name, email: em.email, password: pw.password, accept_terms: true, accept_clauses: true, turnstile: captcha }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || t('common.error_generic'), 'error')
        // Jetonul Turnstile s-a consumat: altul, pentru următoarea încercare
        setCaptcha(''); setCaptchaKey(k => k + 1)
        return
      }
      setSentTo(em.email)
    } catch { showToast(t('auth.connection_error'), 'error') } finally { setLoading(false) }
  }

  const resend = async () => {
    if (!sentTo) return
    setResending(true)
    try {
      const res = await fetch('/api/auth/verify-email/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: sentTo, password }) })
      const data = await res.json().catch(() => ({}))
      showToast(res.ok ? t('auth.verify_resent') : data.error || t('common.error_generic'), res.ok ? 'success' : 'error')
    } catch { showToast(t('auth.connection_error'), 'error') } finally { setResending(false) }
  }

  const handleGoogle = async () => { setGLoading(true); try { await signIn('google', { callbackUrl: '/onboarding' }) } catch { showToast(t('auth.google_error'), 'error'); setGLoading(false) } }

  if (sentTo) {
    return (
      <>
        <AuthToast notice={toast} onClose={() => setToast(null)} />
        <AuthCard icon={<MailCheck />} title={t('auth.check_inbox_title')} description={t('auth.check_inbox_sent', { email: sentTo })}
          footer={<Link href="/login" className="font-semibold text-black hover:underline underline-offset-4">{t('auth.back_to_login')}</Link>}>
          <p className="mb-4 text-[13px] leading-relaxed text-neutral-500">{t('auth.check_inbox_hint')}</p>
          <Button variant="secondary" loading={resending} onClick={resend} className="h-11 w-full text-[14px]">
            {!resending && <RefreshCw />}{t('auth.resend_link')}
          </Button>
        </AuthCard>
      </>
    )
  }

  return (
    <>
      <AuthToast notice={toast} onClose={() => setToast(null)} />
      <AuthCard title={t('auth.create_account')} description={t('auth.create_desc')}
        footer={<>{t('auth.have_account')}{' '}<Link href="/login" className="font-semibold text-black hover:underline underline-offset-4">{t('auth.sign_in_link')}</Link></>}>
        <GoogleButton onClick={handleGoogle} loading={gLoading}>{t('auth.continue_google')}</GoogleButton>
        <p className="mt-2.5 text-center text-[11.5px] leading-relaxed text-neutral-500"><LegalText text={t('auth.google_terms_note')} /></p>
        <OrDivider>{t('auth.or')}</OrDivider>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField label={t('auth.full_name')} icon={<User />} type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder={t('auth.name_placeholder')} required autoComplete="name" maxLength={NAME_MAX} />
          <AuthField label={t('auth.email')} icon={<Mail />} type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder={t('auth.email_placeholder')} required autoComplete="email" />
          <PasswordField label={t('auth.password')} icon={<Lock />} value={password} onChange={e => setPassword(e.target.value)} strength
            placeholder={t('auth.password_min')} required minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} autoComplete="new-password" />
          <div className="space-y-2.5 pt-1">
            <Consent checked={acceptTerms} onChange={setAcceptTerms}><LegalText text={t('auth.accept_terms_label')} /></Consent>
            <Consent checked={acceptClauses} onChange={setAcceptClauses}>{t('auth.accept_clauses_label')}</Consent>
          </div>
          <Turnstile key={captchaKey} onToken={setCaptcha} />
          <SubmitButton loading={loading}>{t('auth.create_button')}<ArrowRight /></SubmitButton>
        </form>
      </AuthCard>
    </>
  )
}
