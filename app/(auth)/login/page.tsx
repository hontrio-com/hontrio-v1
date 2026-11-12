'use client'

import { useState, Suspense } from 'react'
import { useT } from '@/lib/i18n/context'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Mail, Lock, ArrowRight, CheckCircle, MailWarning, RefreshCw } from 'lucide-react'
import { Button } from '@/components/app/button'
import { AuthCard, AuthField, AuthToast, GoogleButton, OrDivider, PasswordField, SubmitButton, type AuthNotice } from '@/components/auth/ui'
import { LegalText } from '../_components/legal'

// Erorile pe care le poate aduce adresa (întoarcerea din Google) sau `authorize`
const LOGIN_ERRORS: Record<string, string> = {
  rate_limited: 'auth.too_many_attempts',
  unavailable: 'auth.unavailable',
  google_unverified: 'auth.google_unverified',
}

function LoginContent() {
  const router = useRouter()
  const { t } = useT()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [gLoading, setGLoading] = useState(false)
  const [unverified, setUnverified] = useState(false)
  const [resending, setResending] = useState(false)
  const [toast, setToast] = useState<AuthNotice>(null)
  const verified = searchParams.get('verified') === '1'
  const onboarding = searchParams.get('onboarding') === 'true'
  const urlError = searchParams.get('error')

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 5000) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { showToast(t('auth.email_required'), 'error'); return }
    if (!password.trim()) { showToast(t('auth.password_required'), 'error'); return }
    setLoading(true); setUnverified(false)
    const res = await signIn('credentials', { email: email.trim().toLowerCase(), password, redirect: false })
    if (res?.error) {
      setLoading(false)
      // Parola e bună, dar adresa nu e confirmată: omul poate cere alt link
      if (res.error === 'email_not_verified') { setUnverified(true); return }
      showToast(t(LOGIN_ERRORS[res.error] ?? 'auth.invalid_credentials'), 'error')
      return
    }
    showToast(t('auth.auth_success'), 'success')
    setTimeout(() => router.push(onboarding ? '/onboarding' : '/dashboard'), 800)
  }

  const resend = async () => {
    setResending(true)
    try {
      const res = await fetch('/api/auth/verify-email/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim().toLowerCase(), password }) })
      const data = await res.json().catch(() => ({}))
      showToast(res.ok ? t('auth.verify_resent') : data.error || t('common.error_generic'), res.ok ? 'success' : 'error')
    } catch { showToast(t('auth.connection_error'), 'error') } finally { setResending(false) }
  }

  const handleGoogle = async () => { setGLoading(true); try { await signIn('google', { callbackUrl: '/dashboard' }) } catch { showToast(t('auth.google_error'), 'error'); setGLoading(false) } }

  return (
    <>
      <AuthToast notice={toast} onClose={() => setToast(null)} />
      <AuthCard title={t('auth.welcome_back')} description={t('auth.sign_in_desc')}
        footer={<>{t('auth.no_account')}{' '}<Link href="/register" className="font-semibold text-black hover:underline underline-offset-4">{t('auth.create_free')}</Link></>}>
        {verified && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-line bg-neutral-50 px-4 py-3">
            <CheckCircle className="size-4 shrink-0 text-black" /><span className="text-[13px] text-neutral-600">{t('auth.verified_notice')}</span>
          </div>
        )}
        {urlError && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {t(LOGIN_ERRORS[urlError] ?? 'auth.google_error')}
          </div>
        )}
        {unverified && (
          <div className="mb-5 rounded-2xl border border-line bg-neutral-50 px-4 py-3.5">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900"><MailWarning className="size-4 shrink-0" />{t('auth.not_verified_title')}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-600">{t('auth.not_verified_desc')}</p>
            <Button variant="secondary" size="sm" loading={resending} onClick={resend} className="mt-3">
              {!resending && <RefreshCw />}{t('auth.resend_link')}
            </Button>
          </div>
        )}

        <GoogleButton onClick={handleGoogle} loading={gLoading}>{t('auth.continue_google')}</GoogleButton>
        <p className="mt-2.5 text-center text-[11.5px] leading-relaxed text-neutral-500"><LegalText text={t('auth.google_terms_note')} /></p>
        <OrDivider>{t('auth.or')}</OrDivider>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField label={t('auth.email')} icon={<Mail />} type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder={t('auth.email_placeholder')} required autoComplete="email" />
          <PasswordField label={t('auth.password')} icon={<Lock />} value={password} onChange={e => setPassword(e.target.value)}
            placeholder={t('auth.password_placeholder')} required autoComplete="current-password"
            aside={<Link href="/forgot-password" className="text-[12px] font-medium text-neutral-500 transition-colors hover:text-black">{t('auth.forgot_password')}</Link>} />
          <SubmitButton loading={loading}>{t('auth.sign_in')}<ArrowRight /></SubmitButton>
        </form>
      </AuthCard>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center"><Loader2 className="size-5 animate-spin text-neutral-300" /></div>}>
      <LoginContent />
    </Suspense>
  )
}
