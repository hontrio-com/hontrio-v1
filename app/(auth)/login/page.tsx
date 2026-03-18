'use client'

import { useState, Suspense } from 'react'
import { useT } from '@/lib/i18n/context'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2, Mail, Lock, ArrowRight, CheckCircle,
  AlertCircle, X, Eye, EyeOff,
} from 'lucide-react'

const GoogleIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-full border shadow-xl backdrop-blur-sm ${type === 'success' ? 'bg-white/90 border-neutral-200 text-neutral-900' : 'bg-white/90 border-red-200 text-red-700'}`}>
      {type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-1 p-0.5 rounded-full hover:bg-neutral-100 transition-colors"><X className="h-3.5 w-3.5 text-neutral-400" /></button>
    </motion.div>
  )
}



function LoginContent() {
  const router = useRouter()
  const { t } = useT()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [gLoading, setGLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const registered = searchParams.get('registered') === 'true'
  const onboarding = searchParams.get('onboarding') === 'true'
  const [focused, setFocused] = useState<string | null>(null)

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

  const handleGoogle = async () => { setGLoading(true); try { await signIn('google', { callbackUrl: '/dashboard' }) } catch { showToast(t('common.error') + ' Google', 'error'); setGLoading(false) } }

  const ic = (n: string) => `relative rounded-xl border transition-all duration-200 ${focused === n ? 'border-neutral-900 ring-1 ring-neutral-900/5' : 'border-neutral-200 hover:border-neutral-300'}`
  const ii = (n: string) => `absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-200 ${focused === n ? 'text-neutral-900' : 'text-neutral-300'}`

  return (
    <div className="min-h-[100dvh] flex items-center justify-center relative px-5">
      <AnimatePresence>{toast && <Toast {...toast} onClose={() => setToast(null)} />}</AnimatePresence>

      <div className="relative z-10 w-full max-w-[400px] text-center animate-[fadeInUp_0.5s_ease-out]">
        <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>

        <div className="mb-10">
          <img src="/logo-black.png" alt="Hontrio" style={{ height: 34, width: 'auto' }} className="inline-block" />
        </div>

        <div className="mb-8">
          <h1 className="text-[26px] font-semibold text-neutral-900 tracking-tight">{t("auth.welcome_back")}</h1>
          <p className="text-neutral-400 text-[14px] mt-2 font-light">{t("auth.sign_in_desc")}</p>
        </div>

        {registered && (
          <div
            className="flex items-center justify-center gap-3 px-4 py-3 border border-neutral-200 rounded-xl mb-6 bg-neutral-50 text-left">
            <CheckCircle className="h-4 w-4 text-neutral-700 shrink-0" /><span className="text-[13px] text-neutral-600">{t("auth.account_created")}</span>
          </div>
        )}

        <div>
          <button onClick={handleGoogle} disabled={gLoading}
            className="w-full flex items-center justify-center gap-3 h-[48px] rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 active:scale-[0.985] transition-all text-[14px] font-medium text-neutral-700 disabled:opacity-50 cursor-pointer">
            {gLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />} {t('auth.continue_google')}
          </button>
        </div>

        <div className="flex items-center gap-4 my-6">
          <div className="h-px flex-1 bg-neutral-100" /><span className="text-[11px] text-neutral-300 uppercase tracking-[0.15em] font-medium select-none">{t("auth.or")}</span><div className="h-px flex-1 bg-neutral-100" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
          <div>
            <label className="block text-[12px] font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">{t("auth.email")}</label>
            <div className={ic('email')}>
              <Mail className={ii('email')} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                placeholder={t("auth.email_placeholder")} required autoComplete="email" className="w-full pl-11 pr-4 h-[46px] bg-transparent rounded-xl text-[14px] text-neutral-900 placeholder:text-neutral-300 outline-none" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] font-medium text-neutral-400 uppercase tracking-wide">{t("auth.password")}</label>
              <Link href="/forgot-password" className="text-[12px] text-neutral-400 hover:text-neutral-900 transition-colors">{t("auth.forgot_password")}</Link>
            </div>
            <div className={ic('password')}>
              <Lock className={ii('password')} />
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                placeholder={t("auth.password_placeholder")} required autoComplete="current-password" className="w-full pl-11 pr-12 h-[46px] bg-transparent rounded-xl text-[14px] text-neutral-900 placeholder:text-neutral-300 outline-none" />
              <button type="button" onClick={() => setShowPw(!showPw)} tabIndex={-1} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-600 transition-colors">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <motion.div whileTap={{ scale: 0.985 }} className="pt-0.5">
            <button type="submit" disabled={loading}
              className="w-full h-[46px] rounded-xl bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>{t("auth.sign_in")}</span><ArrowRight className="h-4 w-4" /></>}
            </button>
          </motion.div>
        </form>

        <p
          className="text-[14px] text-neutral-400 mt-7">
          {t("auth.no_account")}{" "}<Link href="/register" className="text-neutral-900 font-medium hover:underline underline-offset-4">{t("auth.create_free")}</Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] flex items-center justify-center bg-white"><Loader2 className="h-5 w-5 animate-spin text-neutral-300" /></div>}>
      <LoginContent />
    </Suspense>
  )
}