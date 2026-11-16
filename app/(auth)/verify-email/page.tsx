'use client'

import { useState, Suspense } from 'react'
import { useT } from '@/lib/i18n/context'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Lock, AlertCircle, MailCheck, ArrowRight } from 'lucide-react'
import { Button } from '@/components/app/button'
import { AuthCard, AuthLoading, AuthToast, PasswordField, SubmitButton, type AuthNotice } from '@/components/auth/ui'

// =============================================
// Confirmarea adresei: omul a venit din linkul din e-mail (jetonul e într-un
// cookie, pus de /api/auth/verify-email) și își scrie parola aleasă la
// înscriere. Linkul singur nu ajunge: așa, un cont făcut de altcineva cu
// adresa lui nu devine al nimănui. După confirmare intră direct în cont.
// =============================================

function VerifyContent() {
  const { t } = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [invalid, setInvalid] = useState(['invalid', 'rate_limited'].includes(searchParams.get('status') ?? ''))
  const [toast, setToast] = useState<AuthNotice>(null)

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 5000) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) { showToast(t('auth.password_required'), 'error'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.code === 'invalid') { setInvalid(true); return }
        showToast(data.error || t('common.error_generic'), 'error')
        return
      }
      const signed = await signIn('credentials', { email: data.email, password, redirect: false })
      if (signed?.error) { router.push('/login?verified=1'); return }
      router.push('/onboarding')
    } catch { showToast(t('auth.connection_error'), 'error') } finally { setLoading(false) }
  }

  if (invalid) {
    return (
      <AuthCard icon={<AlertCircle />} tone="danger" title={t('auth.verify_invalid_title')} description={t('auth.verify_invalid_desc')}>
        <Button asChild variant="primary" className="h-11 w-full text-[14px]">
          <Link href="/login">{t('auth.go_to_login')}<ArrowRight /></Link>
        </Button>
      </AuthCard>
    )
  }

  return (
    <>
      <AuthToast notice={toast} onClose={() => setToast(null)} />
      <AuthCard icon={<MailCheck />} title={t('auth.verify_title')} description={t('auth.verify_desc')}
        footer={<Link href="/forgot-password" className="font-semibold text-black hover:underline underline-offset-4">{t('auth.forgot_password')}</Link>}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField label={t('auth.password')} icon={<Lock />} value={password} onChange={e => setPassword(e.target.value)}
            placeholder={t('auth.password_placeholder')} required autoComplete="current-password" />
          <SubmitButton loading={loading}>{t('auth.verify_button')}<ArrowRight /></SubmitButton>
        </form>
      </AuthCard>
    </>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <VerifyContent />
    </Suspense>
  )
}
