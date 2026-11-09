'use client'

import { useState, Suspense } from 'react'
import { useT } from '@/lib/i18n/context'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Mail, Lock, ArrowRight, CheckCircle } from 'lucide-react'
import { AuthCard, AuthField, AuthToast, GoogleButton, OrDivider, PasswordField, SubmitButton, type AuthNotice } from '@/components/auth/ui'

function LoginContent() {
  const router = useRouter()
  const { t } = useT()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [gLoading, setGLoading] = useState(false)
  const [toast, setToast] = useState<AuthNotice>(null)
  const registered = searchParams.get('registered') === 'true'
  const onboarding = searchParams.get('onboarding') === 'true'

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 5000) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { showToast(t('auth.email_required'), 'error'); return }
    if (!password.trim()) { showToast(t('auth.password_required'), 'error'); return }
    setLoading(true)
    const res = await signIn('credentials', { email: email.trim().toLowerCase(), password, redirect: false })
    if (res?.error) { showToast(t('auth.invalid_credentials'), 'error'); setLoading(false); return }
    showToast(t('auth.auth_success'), 'success')
    setTimeout(() => router.push(onboarding ? '/onboarding' : '/dashboard'), 800)
  }

  const handleGoogle = async () => { setGLoading(true); try { await signIn('google', { callbackUrl: '/dashboard' }) } catch { showToast(t('auth.google_error'), 'error'); setGLoading(false) } }

  return (
    <>
      <AuthToast notice={toast} onClose={() => setToast(null)} />
      <AuthCard title={t('auth.welcome_back')} description={t('auth.sign_in_desc')}
        footer={<>{t('auth.no_account')}{' '}<Link href="/register" className="font-semibold text-black hover:underline underline-offset-4">{t('auth.create_free')}</Link></>}>
        {registered && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-line bg-neutral-50 px-4 py-3">
            <CheckCircle className="size-4 shrink-0 text-black" /><span className="text-[13px] text-neutral-600">{t('auth.account_created')}</span>
          </div>
        )}

        <GoogleButton onClick={handleGoogle} loading={gLoading}>{t('auth.continue_google')}</GoogleButton>
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
