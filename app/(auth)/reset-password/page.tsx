'use client'

import { useEffect, useState, Suspense } from 'react'
import { useT } from '@/lib/i18n/context'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Lock, CheckCircle, AlertCircle, ArrowRight, KeyRound } from 'lucide-react'
import { Button } from '@/components/app/button'
import { AuthCard, AuthToast, PasswordField, SubmitButton, type AuthNotice } from '@/components/auth/ui'
import { checkPassword, PASSWORD_MAX, PASSWORD_MIN } from '@/lib/auth/validation'

// =============================================
// Parola nouă. Linkul din e-mail trece prin /api/auth/reset-password, care
// păstrează jetonul într-un cookie: aici adresa nu mai are niciun jeton.
// Un link vechi (cu ?token= aici) e trimis întâi pe acolo.
// =============================================

function ResetContent() {
  const searchParams = useSearchParams()
  const legacyToken = searchParams.get('token')
  const { t } = useT()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [invalid, setInvalid] = useState(['invalid', 'rate_limited'].includes(searchParams.get('status') ?? ''))
  const [toast, setToast] = useState<AuthNotice>(null)

  // Linkurile trimise înainte de schimbare: jetonul pleacă din adresă în cookie
  useEffect(() => {
    if (legacyToken) window.location.replace(`/api/auth/reset-password?token=${encodeURIComponent(legacyToken)}`)
  }, [legacyToken])

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 5000) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const pw = checkPassword(password)
    if (!pw.ok) { showToast(t(pw.error), 'error'); return }
    if (password !== confirm) { showToast(t('auth.passwords_no_match'), 'error'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw.password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.code === 'invalid') { setInvalid(true); return }
        showToast(data.error || t('common.error_generic'), 'error')
        return
      }
      setDone(true)
    } catch { showToast(t('auth.connection_error'), 'error') } finally { setLoading(false) }
  }

  if (legacyToken) {
    return <div className="flex min-h-[100dvh] items-center justify-center"><Loader2 className="size-5 animate-spin text-neutral-300" /></div>
  }

  if (invalid) {
    return (
      <AuthCard icon={<AlertCircle />} tone="danger" title={t('auth.invalid_link_title')} description={t('auth.invalid_link_desc')}>
        <Button asChild variant="primary" className="h-11 w-full text-[14px]">
          <Link href="/forgot-password">{t('auth.request_new_link')}</Link>
        </Button>
      </AuthCard>
    )
  }

  if (done) {
    return (
      <AuthCard icon={<CheckCircle />} title={t('auth.reset_success')} description={t('auth.reset_success_desc')}>
        <Button asChild variant="primary" className="h-11 w-full text-[14px]">
          <Link href="/login">{t('auth.go_to_login')}<ArrowRight /></Link>
        </Button>
      </AuthCard>
    )
  }

  return (
    <>
      <AuthToast notice={toast} onClose={() => setToast(null)} />
      <AuthCard icon={<KeyRound />} title={t('auth.new_password')} description={t('auth.set_new_password_desc')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField label={t('auth.new_password')} icon={<Lock />} value={password} onChange={e => setPassword(e.target.value)} strength
            placeholder={t('auth.password_min')} required minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} autoComplete="new-password" />
          <div>
            <PasswordField label={t('auth.confirm_password')} icon={<Lock />} value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder={t('auth.repeat_password_placeholder')} required autoComplete="new-password" />
            {confirm && password && (
              <p className={`mt-1.5 px-0.5 text-[11px] font-medium ${password === confirm ? 'text-neutral-500' : 'text-red-500'}`}>
                {password === confirm ? t('auth.passwords_match') : t('auth.passwords_no_match')}
              </p>
            )}
          </div>
          <SubmitButton loading={loading}>{t('auth.reset_button')}</SubmitButton>
        </form>
      </AuthCard>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center"><Loader2 className="size-5 animate-spin text-neutral-300" /></div>}>
      <ResetContent />
    </Suspense>
  )
}
