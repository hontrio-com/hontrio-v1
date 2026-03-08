'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2, Mail, Lock, User, ArrowRight,
  CheckCircle, AlertCircle, X, Eye, EyeOff, Zap,
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

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [gLoading, setGLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [focused, setFocused] = useState<string | null>(null)

  const showToast = (msg: string, type: 'success' | 'error') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 5000) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimName = name.trim()
    const trimEmail = email.trim().toLowerCase()
    if (!trimName) { showToast('Introdu numele complet', 'error'); return }
    if (trimName.length < 2 || trimName.length > 100) { showToast('Numele trebuie sa aiba intre 2 si 100 caractere', 'error'); return }
    if (!trimEmail) { showToast('Introdu adresa de email', 'error'); return }
    if (password.length < 6) { showToast('Parola trebuie sa aiba minim 6 caractere', 'error'); return }
    if (password.length > 128) { showToast('Parola e prea lunga', 'error'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: trimName, email: trimEmail, password }) })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Eroare la crearea contului', 'error'); setLoading(false); return }
      showToast('Cont creat cu succes', 'success')
      const signInRes = await signIn('credentials', { email: trimEmail, password, redirect: false })
      if (signInRes?.error) { router.push('/login?registered=true&onboarding=true'); return }
      setTimeout(() => router.push('/onboarding'), 800)
    } catch { showToast('Eroare de conexiune', 'error') } finally { setLoading(false) }
  }

  const handleGoogle = async () => { setGLoading(true); try { await signIn('google', { callbackUrl: '/onboarding' }) } catch { showToast('Eroare Google', 'error'); setGLoading(false) } }

  const ic = (n: string) => `relative rounded-xl border transition-all duration-200 ${focused === n ? 'border-neutral-900 ring-1 ring-neutral-900/5' : 'border-neutral-200 hover:border-neutral-300'}`
  const ii = (n: string) => `absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-200 ${focused === n ? 'text-neutral-900' : 'text-neutral-300'}`

  const pwLen = password.length
  const pwStrength = pwLen === 0 ? 0 : pwLen < 6 ? 1 : pwLen < 10 ? 2 : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3
  const pwColors = ['', 'bg-red-400', 'bg-amber-400', 'bg-neutral-400', 'bg-neutral-900']

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-white relative px-5 py-6">
      <LiquidBg />
      <AnimatePresence>{toast && <Toast {...toast} onClose={() => setToast(null)} />}</AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[400px] text-center">

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-8">
          <img src="/logo-black.png" alt="Hontrio" style={{ height: 34, width: 'auto' }} className="inline-block" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-5">
          <h1 className="text-[26px] font-semibold text-neutral-900 tracking-tight">Creeaza cont</h1>
          <p className="text-neutral-400 text-[14px] mt-1.5 font-light">Incepe sa optimizezi produsele cu AI</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-neutral-200 bg-neutral-50">
            <Zap className="h-3.5 w-3.5 text-neutral-700" />
            <span className="text-[12px] font-medium text-neutral-600">20 credite gratuite incluse</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} whileTap={{ scale: 0.985 }}>
          <button onClick={handleGoogle} disabled={gLoading}
            className="w-full flex items-center justify-center gap-3 h-[46px] rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 active:scale-[0.985] transition-all text-[14px] font-medium text-neutral-700 disabled:opacity-50 cursor-pointer">
            {gLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />} Continua cu Google
          </button>
        </motion.div>

        <div className="flex items-center gap-4 my-5">
          <div className="h-px flex-1 bg-neutral-100" /><span className="text-[11px] text-neutral-300 uppercase tracking-[0.15em] font-medium select-none">sau</span><div className="h-px flex-1 bg-neutral-100" />
        </div>

        <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27 }} onSubmit={handleSubmit} className="space-y-3 text-left">
          <div>
            <label className="block text-[12px] font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">Nume complet</label>
            <div className={ic('name')}>
              <User className={ii('name')} />
              <input type="text" value={name} onChange={e => setName(e.target.value)} onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
                placeholder="Numele tau" required autoComplete="name" maxLength={100} className="w-full pl-11 pr-4 h-[46px] bg-transparent rounded-xl text-[14px] text-neutral-900 placeholder:text-neutral-300 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">Email</label>
            <div className={ic('email')}>
              <Mail className={ii('email')} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                placeholder="email@exemplu.ro" required autoComplete="email" className="w-full pl-11 pr-4 h-[46px] bg-transparent rounded-xl text-[14px] text-neutral-900 placeholder:text-neutral-300 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">Parola</label>
            <div className={ic('password')}>
              <Lock className={ii('password')} />
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                placeholder="Minim 6 caractere" required minLength={6} maxLength={128} autoComplete="new-password" className="w-full pl-11 pr-12 h-[46px] bg-transparent rounded-xl text-[14px] text-neutral-900 placeholder:text-neutral-300 outline-none" />
              <button type="button" onClick={() => setShowPw(!showPw)} tabIndex={-1} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-600 transition-colors">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {pwLen > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex gap-1 mt-2 px-1">
                {[1,2,3,4].map(i => (<div key={i} className={`h-[3px] flex-1 rounded-full transition-all duration-300 ${i <= pwStrength ? pwColors[pwStrength] : 'bg-neutral-100'}`} />))}
              </motion.div>
            )}
          </div>
          <motion.div whileTap={{ scale: 0.985 }} className="pt-0.5">
            <button type="submit" disabled={loading}
              className="w-full h-[46px] rounded-xl bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Creeaza cont gratuit</span><ArrowRight className="h-4 w-4" /></>}
            </button>
          </motion.div>
        </motion.form>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-6 space-y-3">
          <p className="text-[14px] text-neutral-400">
            Ai deja cont?{' '}<Link href="/login" className="text-neutral-900 font-medium hover:underline underline-offset-4">Conecteaza-te</Link>
          </p>
          <p className="text-[11px] text-neutral-300 leading-relaxed">
            Prin crearea contului, esti de acord cu{' '}<Link href="#" className="underline hover:text-neutral-500">Termenii</Link>{' '}si{' '}<Link href="#" className="underline hover:text-neutral-500">Politica de Confidentialitate</Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}