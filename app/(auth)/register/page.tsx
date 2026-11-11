'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n/context'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, User, ArrowRight } from 'lucide-react'
import { AuthCard, AuthField, AuthToast, GoogleButton, OrDivider, PasswordField, SubmitButton, type AuthNotice } from '@/components/auth/ui'

export default function RegisterPage() {
  const router = useRouter()
  const { t } = useT()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [gLoading, setGLoading] = useState(false)
  const [toast, setToast] = useState<AuthNotice>(null)

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 5000) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimName = name.trim()
    const trimEmail = email.trim().toLowerCase()
    if (!trimName) { showToast(t('auth.name_required'), 'error'); return }
    if (trimName.length < 2 || trimName.length > 100) { showToast(t('auth.name_length'), 'error'); return }
    if (!trimEmail) { showToast(t('auth.email_required'), 'error'); return }
    if (password.length < 6) { showToast(t('auth.password_min_error'), 'error'); return }
    if (password.length > 128) { showToast(t('auth.password_too_long'), 'error'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimName, email: trimEmail, password }) })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || t('common.error'), 'error'); setLoading(false); return }
      showToast(t('auth.account_created'), 'success')
      const signInRes = await signIn('credentials', { email: trimEmail, password, redirect: false })
      if (signInRes?.error) { router.push('/login?registered=true&onboarding=true'); return }
      setTimeout(() => router.push('/onboarding'), 800)
    } catch { showToast(t('auth.connection_error'), 'error') } finally { setLoading(false) }
  }

  const handleGoogle = async () => { setGLoading(true); try { await signIn('google', { callbackUrl: '/onboarding' }) } catch { showToast(t('auth.google_error'), 'error'); setGLoading(false) } }

  return (
    <>
      <AuthToast notice={toast} onClose={() => setToast(null)} />
      <AuthCard title={t('auth.create_account')} description={t('auth.create_desc')}
        footer={<>{t('auth.have_account')}{' '}<Link href="/login" className="font-semibold text-black hover:underline underline-offset-4">{t('auth.sign_in_link')}</Link></>}
        note={<>{t('auth.terms_agree')}{' '}<Link href="#" className="underline hover:text-neutral-600">{t('auth.terms')}</Link>{' '}{t('auth.and')}{' '}<Link href="#" className="underline hover:text-neutral-600">{t('auth.privacy')}</Link></>}>
        <GoogleButton onClick={handleGoogle} loading={gLoading}>{t('auth.continue_google')}</GoogleButton>
        <OrDivider>{t('auth.or')}</OrDivider>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField label={t('auth.full_name')} icon={<User />} type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder={t('auth.name_placeholder')} required autoComplete="name" maxLength={100} />
          <AuthField label={t('auth.email')} icon={<Mail />} type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder={t('auth.email_placeholder')} required autoComplete="email" />
          <PasswordField label={t('auth.password')} icon={<Lock />} value={password} onChange={e => setPassword(e.target.value)} strength
            placeholder={t('auth.password_min')} required minLength={6} maxLength={128} autoComplete="new-password" />
          <SubmitButton loading={loading}>{t('auth.create_button')}<ArrowRight /></SubmitButton>
        </form>
      </AuthCard>
    </>
  )
}
