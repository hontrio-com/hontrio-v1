'use client'

import { useState, Suspense } from 'react'
import { useT } from '@/lib/i18n/context'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2, Lock, CheckCircle, AlertCircle, X, Eye, EyeOff, ArrowRight, KeyRound,
} from 'lucide-react'

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

function LiquidBg() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <motion.div className="absolute rounded-full" style={{ width: '55vw', height: '55vw', maxWidth: 700, maxHeight: 700, left: '-8%', top: '-12%', background: 'radial-gradient(circle, rgba(0,0,0,0.045) 0%, rgba(0,0,0,0.02) 40%, transparent 70%)', filter: 'blur(80px)' }}
        animate={{ x: [0, 60, -30, 40, 0], y: [0, -40, 50, -20, 0] }} transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute rounded-full" style={{ width: '50vw', height: '50vw', maxWidth: 650, maxHeight: 650, right: '-10%', bottom: '-8%', background: 'radial-gradient(circle, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.015) 45%, transparent 70%)', filter: 'blur(70px)' }}
        animate={{ x: [0, -50, 35, -25, 0], y: [0, 45, -35, 20, 0] }} transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute rounded-full" style={{ width: '40vw', height: '40vw', maxWidth: 500, maxHeight: 500, left: '30%', top: '40%', background: 'radial-gradient(circle, rgba(0,0,0,0.035) 0%, rgba(0,0,0,0.01) 50%, transparent 70%)', filter: 'blur(90px)' }}
        animate={{ x: [0, 40, -50, 20, 0], y: [0, -35, 30, -15, 0], scale: [1, 1.08, 0.95, 1.03, 1] }} transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }} />
    </div>
  )
}

function ResetContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const email = searchParams.get('email') || ''
  const { t } = useT()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [focused, setFocused] = useState<string | null>(null)

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 5000) }

  const pwLen = password.length
  const pwStrength = pwLen === 0 ? 0 : pwLen < 6 ? 1 : pwLen < 10 ? 2 : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3
  const pwColors = ['', 'bg-red-400', 'bg-amber-400', 'bg-neutral-400', 'bg-neutral-900']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) { showToast(t('auth.password_min_error'), 'error'); return }
    if (password !== confirm) { showToast(t('auth.passwords_no_match'), 'error'); return }
    if (!token || !email) { showToast(t('auth.invalid_reset_link'), 'error'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || t('common.error_generic'), 'error'); setLoading(false); return }
      setDone(true)
    } catch { showToast(t('auth.connection_error'), 'error') } finally { setLoading(false) }
  }

  const ic = (n: string) => `relative rounded-xl border transition-all duration-200 ${focused === n ? 'border-neutral-900 ring-1 ring-neutral-900/5' : 'border-neutral-200 hover:border-neutral-300'}`

  if (!token || !email) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white relative px-5">
        <LiquidBg />
        <div className="relative z-10 text-center max-w-[400px]">
          <div className="mb-10"><img src="/logo-black.png" alt="Hontrio" style={{ height: 34, width: 'auto' }} className="inline-block" /></div>
          <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <h1 className="text-[22px] font-semibold text-neutral-900 mb-3">{t('auth.invalid_link_title')}</h1>
          <p className="text-neutral-400 text-[14px] mb-8">{t('auth.invalid_link_desc')}</p>
          <Link href="/forgot-password">
            <button className="w-full h-[46px] rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-all cursor-pointer">
              {t('auth.request_new_link')}
            </button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-white relative px-5">
      <LiquidBg />
      <AnimatePresence>{toast && <Toast {...toast} onClose={() => setToast(null)} />}</AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[400px] text-center">

        <div className="mb-10"><img src="/logo-black.png" alt="Hontrio" style={{ height: 34, width: 'auto' }} className="inline-block" /></div>

        {done ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="h-16 w-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-7 w-7 text-neutral-700" />
            </div>
            <h1 className="text-[26px] font-semibold text-neutral-900 tracking-tight mb-3">{t('auth.reset_success')}</h1>
            <p className="text-neutral-400 text-[14px] leading-relaxed mb-8 font-light">{t('auth.reset_success')}</p>
            <Link href="/login">
              <motion.button whileTap={{ scale: 0.985 }}
                className="w-full h-[46px] rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-all cursor-pointer">
                {t('auth.go_to_login')} <ArrowRight className="h-4 w-4" />
              </motion.button>
            </Link>
          </motion.div>
        ) : (
          <>
            <div className="h-16 w-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-6">
              <KeyRound className="h-7 w-7 text-neutral-700" />
            </div>
            <h1 className="text-[26px] font-semibold text-neutral-900 tracking-tight mb-2">{t('auth.new_password')}</h1>
            <p className="text-neutral-400 text-[14px] mb-8 font-light">{t('auth.set_new_password_desc')}</p>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
              <div>
                <label className="block text-[12px] font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">{t('auth.new_password')}</label>
                <div className={ic('password')}>
                  <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-200 ${focused === 'password' ? 'text-neutral-900' : 'text-neutral-300'}`} />
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                    placeholder={t('auth.password_min')} required minLength={6} maxLength={128} autoComplete="new-password"
                    className="w-full pl-11 pr-12 h-[46px] bg-transparent rounded-xl text-[14px] text-neutral-900 placeholder:text-neutral-300 outline-none" />
                  <button type="button" onClick={() => setShowPw(!showPw)} tabIndex={-1} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-600 transition-colors">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {pwLen > 0 && (
                  <div className="flex gap-1 mt-2 px-1">
                    {[1,2,3,4].map(i => (<div key={i} className={`h-[3px] flex-1 rounded-full transition-all duration-300 ${i <= pwStrength ? pwColors[pwStrength] : 'bg-neutral-100'}`} />))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[12px] font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">{t('auth.confirm_password')}</label>
                <div className={ic('confirm')}>
                  <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-200 ${focused === 'confirm' ? 'text-neutral-900' : 'text-neutral-300'}`} />
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} onFocus={() => setFocused('confirm')} onBlur={() => setFocused(null)}
                    placeholder={t('auth.repeat_password_placeholder')} required autoComplete="new-password"
                    className="w-full pl-11 pr-4 h-[46px] bg-transparent rounded-xl text-[14px] text-neutral-900 placeholder:text-neutral-300 outline-none" />
                </div>
                {confirm && password && (
                  <p className={`text-[11px] mt-1.5 px-1 font-medium ${password === confirm ? 'text-neutral-500' : 'text-red-400'}`}>
                    {password === confirm ? t('auth.passwords_match') : t('auth.passwords_no_match')}
                  </p>
                )}
              </div>

              <motion.div whileTap={{ scale: 0.985 }} className="pt-0.5">
                <button type="submit" disabled={loading}
                  className="w-full h-[46px] rounded-xl bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>{t('auth.reset_button')}</span>}
                </button>
              </motion.div>
            </form>
          </>
        )}
      </motion.div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] flex items-center justify-center bg-white"><Loader2 className="h-5 w-5 animate-spin text-neutral-300" /></div>}>
      <ResetContent />
    </Suspense>
  )
}