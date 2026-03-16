'use client'

import { useState } from 'react'
import { useT, useLocale } from '@/lib/i18n/context'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2, Mail, ArrowLeft, CheckCircle,
  AlertCircle, X, KeyRound,
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

export default function ForgotPasswordPage() {
  const { t } = useT()
  const { locale, setLocale } = useLocale()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [focused, setFocused] = useState(false)

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 5000) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { showToast('Introdu adresa de email', 'error'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim().toLowerCase() }) })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || t('common.error_generic'), 'error'); setLoading(false); return }
      setSent(true)
    } catch { showToast('Eroare de conexiune', 'error') } finally { setLoading(false) }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-white relative px-5">
      <LiquidBg />
      <AnimatePresence>{toast && <Toast {...toast} onClose={() => setToast(null)} />}</AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[400px] text-center">

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-10">
          <img src="/logo-black.png" alt="Hontrio" style={{ height: 34, width: 'auto' }} className="inline-block" />
        </motion.div>

        {sent ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="h-16 w-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-7 w-7 text-neutral-700" />
            </div>
            <h1 className="text-[26px] font-semibold text-neutral-900 tracking-tight mb-3">{t('auth.reset_success')}</h1>
            <p className="text-neutral-400 text-[14px] leading-relaxed mb-8 font-light">
              Am trimis instructiunile de resetare la <span className="text-neutral-700 font-medium">{email}</span>. Verifica-ti inbox-ul si folderul spam.
            </p>
            <Link href="/login">
              <motion.button whileTap={{ scale: 0.985 }}
                className="w-full h-[46px] rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-[14px] font-medium flex items-center justify-center gap-2 transition-all cursor-pointer">
                <ArrowLeft className="h-4 w-4" /> Inapoi la conectare
              </motion.button>
            </Link>
          </motion.div>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-8">
              <div className="h-16 w-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-6">
                <KeyRound className="h-7 w-7 text-neutral-700" />
              </div>
              <h1 className="text-[26px] font-semibold text-neutral-900 tracking-tight">Reseteaza parola</h1>
              <p className="text-neutral-400 text-[14px] mt-2 font-light">Introdu emailul asociat contului tau</p>
            </motion.div>

            <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-[12px] font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">{t('auth.email')}</label>
                <div className={`relative rounded-xl border transition-all duration-200 ${focused ? 'border-neutral-900 ring-1 ring-neutral-900/5' : 'border-neutral-200 hover:border-neutral-300'}`}>
                  <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-200 ${focused ? 'text-neutral-900' : 'text-neutral-300'}`} />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                    placeholder="email@exemplu.ro" required autoComplete="email" className="w-full pl-11 pr-4 h-[46px] bg-transparent rounded-xl text-[14px] text-neutral-900 placeholder:text-neutral-300 outline-none" />
                </div>
              </div>
              <motion.div whileTap={{ scale: 0.985 }}>
                <button type="submit" disabled={loading}
                  className="w-full h-[46px] rounded-xl bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>{t('auth.send_reset')}</span>}
                </button>
              </motion.div>
            </motion.form>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-7">
              <Link href="/login" className="text-[14px] text-neutral-400 hover:text-neutral-900 font-medium inline-flex items-center gap-1.5 transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" /> Inapoi la conectare
              </Link>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  )
}