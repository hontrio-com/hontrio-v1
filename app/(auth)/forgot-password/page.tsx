'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n/context'
import Link from 'next/link'
import { Mail, ArrowLeft, CheckCircle, KeyRound } from 'lucide-react'
import { Button } from '@/components/app/button'
import { AuthCard, AuthField, AuthToast, SubmitButton, type AuthNotice } from '@/components/auth/ui'
import { checkEmail } from '@/lib/auth/validation'
import { Turnstile, turnstileOn } from '../_components/turnstile'

export default function ForgotPasswordPage() {
  const { t } = useT()
  const [email, setEmail] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [toast, setToast] = useState<AuthNotice>(null)

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 5000) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const em = checkEmail(email)
    if (!em.ok) { showToast(t(em.error), 'error'); return }
    if (turnstileOn && !captcha) { showToast(t('auth.captcha_wait'), 'error'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em.email, turnstile: captcha }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || t('common.error_generic'), 'error')
        setCaptcha(''); setCaptchaKey(k => k + 1)
        return
      }
      setSent(true)
    } catch { showToast(t('auth.connection_error'), 'error') } finally { setLoading(false) }
  }

  const backToLogin = (
    <Link href="/login" className="inline-flex items-center gap-1.5 font-semibold text-black hover:underline underline-offset-4">
      <ArrowLeft className="size-3.5" />{t('auth.back_to_login')}
    </Link>
  )

  if (sent) {
    return (
      <AuthCard icon={<CheckCircle />} title={t('auth.reset_link_sent_title')} description={t('auth.reset_email_sent', { email })}>
        <Button asChild variant="secondary" className="h-11 w-full text-[14px]">
          <Link href="/login"><ArrowLeft />{t('auth.back_to_login')}</Link>
        </Button>
      </AuthCard>
    )
  }

  return (
    <>
      <AuthToast notice={toast} onClose={() => setToast(null)} />
      <AuthCard icon={<KeyRound />} title={t('auth.reset_title')} description={t('auth.forgot_desc')} footer={backToLogin}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField label={t('auth.email')} icon={<Mail />} type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder={t('auth.email_placeholder')} required autoComplete="email" />
          <Turnstile key={captchaKey} onToken={setCaptcha} />
          <SubmitButton loading={loading}>{t('auth.send_reset')}</SubmitButton>
        </form>
      </AuthCard>
    </>
  )
}
