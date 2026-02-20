'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Loader2, Mail, Lock, Sparkles, ArrowRight, CheckCircle,
  AlertCircle, Zap, TrendingUp, Package, X,
} from 'lucide-react'

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  const c = { success: { bg: 'bg-green-50 border-green-200', icon: <CheckCircle className="h-4 w-4 text-green-600" />, text: 'text-green-800' }, error: { bg: 'bg-red-50 border-red-200', icon: <AlertCircle className="h-4 w-4 text-red-600" />, text: 'text-red-800' }, info: { bg: 'bg-blue-50 border-blue-200', icon: <Sparkles className="h-4 w-4 text-blue-600" />, text: 'text-blue-800' } }[type]
  return (
    <motion.div initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${c.bg}`}>
      {c.icon}<span className={`text-sm font-medium ${c.text}`}>{message}</span>
      <button onClick={onClose} className="ml-2 text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5" /></button>
    </motion.div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const registered = searchParams.get('registered') === 'true'
  const onboarding = searchParams.get('onboarding') === 'true'

  const showToast = (msg: string, type: 'success' | 'error' | 'info') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 5000) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { showToast('Introdu adresa de email', 'error'); return }
    if (!password.trim()) { showToast('Introdu parola', 'error'); return }
    setLoading(true)
    const res = await signIn('credentials', { email, password, redirect: false })
    if (res?.error) { showToast('Email sau parolă incorectă. Verifică datele și încearcă din nou.', 'error'); setLoading(false); return }
    showToast('Autentificare reușită! Se redirecționează...', 'success')
    setTimeout(() => router.push(onboarding ? '/onboarding' : '/dashboard'), 800)
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    try { await signIn('google', { callbackUrl: '/dashboard' }) }
    catch { showToast('Eroare la autentificarea cu Google', 'error'); setGoogleLoading(false) }
  }

  return (
    <div className="min-h-screen flex">
      <AnimatePresence>{toast && <Toast {...toast} onClose={() => setToast(null)} />}</AnimatePresence>

      {/* ===== LEFT — PREMIUM PANEL ===== */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-[#0a0f1e]">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgba(59,130,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <motion.div animate={{ x: [0, 40, 0], y: [0, -30, 0] }} transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }} className="absolute top-20 right-20 w-80 h-80 bg-blue-600/20 rounded-full blur-[100px]" />
        <motion.div animate={{ x: [0, -30, 0], y: [0, 40, 0] }} transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }} className="absolute bottom-32 left-10 w-96 h-96 bg-indigo-500/15 rounded-full blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        <div className="relative z-10 flex flex-col justify-between px-14 py-12 w-full">
          <div>
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-16">
              <h1 className="text-[42px] font-bold text-white leading-[1.15] tracking-tight mb-5">
                Optimizează.<br />Creează.<br /><span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Publică.</span>
              </h1>
              <p className="text-blue-200/70 text-lg leading-relaxed max-w-lg">Generează titluri, descrieri, imagini și optimizare SEO în câteva minute, apoi publică direct în magazinul tău.</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="grid grid-cols-3 gap-3 mb-10">
              {[{ icon: Zap, value: '70%', label: 'Timp economisit', color: 'from-blue-500/20 to-blue-600/10' }, { icon: TrendingUp, value: '+34%', label: 'Vânzări crescute', color: 'from-emerald-500/20 to-emerald-600/10' }, { icon: Package, value: '10x', label: 'Mai rapid', color: 'from-amber-500/20 to-amber-600/10' }].map((stat, i) => (
                <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.1 }}
                  className={`bg-gradient-to-br ${stat.color} border border-white/[0.06] rounded-2xl p-4`}>
                  <stat.icon className="h-5 w-5 text-blue-300/80 mb-3" /><p className="text-2xl font-bold text-white">{stat.value}</p><p className="text-[11px] text-blue-300/60 mt-0.5">{stat.label}</p>
                </motion.div>
              ))}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400/80" /><div className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" /><div className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
                <span className="ml-2 text-[10px] text-white/30 font-mono">dashboard.hontrio.com</span>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {['12 Produse', '8 Optimizate', '92 SEO', '156 Imagini'].map(t => (
                  <div key={t} className="bg-white/[0.04] rounded-lg p-2.5 text-center"><p className="text-xs font-bold text-white/80">{t.split(' ')[0]}</p><p className="text-[9px] text-white/30">{t.split(' ')[1]}</p></div>
                ))}
              </div>
              <div className="flex items-end gap-1 h-10 px-1">
                {[35, 52, 45, 68, 42, 78, 55, 90, 65, 85, 72, 95].map((h, i) => (
                  <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ delay: 0.7 + i * 0.05, duration: 0.4 }}
                    className="flex-1 bg-gradient-to-t from-blue-500/40 to-blue-400/20 rounded-sm" />
                ))}
              </div>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="flex items-center gap-3 mt-8">
            <div className="flex -space-x-2">
              {['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'].map((bg, i) => (
                <div key={i} className={`h-8 w-8 rounded-full ${bg} border-2 border-[#0a0f1e] flex items-center justify-center text-[10px] text-white font-bold`}>{['M','A','R','D'][i]}</div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-0.5 mb-0.5">{[1,2,3,4,5].map(i => <span key={i} className="text-yellow-400 text-[10px]">★</span>)}</div>
              <p className="text-[11px] text-white/40">Folosit de peste 200+ magazine online</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ===== RIGHT — FORM ===== */}
      <div className="w-full lg:w-[45%] flex flex-col items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-[400px]">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2.5 mb-10">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center"><Sparkles className="h-4 w-4 text-white" /></div>
            <span className="text-xl font-bold gradient-text">HONTRIO</span>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Bine ai revenit</h2>
            <p className="text-gray-500 text-sm mb-8">Conectează-te pentru a gestiona produsele și a crește vânzările.</p>
          </motion.div>

          {registered && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl mb-6">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" /><span className="text-sm text-green-700">Cont creat cu succes! Conectează-te pentru a continua.</span>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
            <button onClick={handleGoogleSignIn} disabled={googleLoading} className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-all text-sm font-medium text-gray-700 mb-5 disabled:opacity-50">
              {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />} Continuă cu Google
            </button>
            <div className="flex items-center gap-3 mb-5"><div className="h-px flex-1 bg-gray-100" /><span className="text-xs text-gray-400">sau cu email</span><div className="h-px flex-1 bg-gray-100" /></div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-gray-600">Email</Label>
                <div className="relative"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplu.ro" required className="pl-10 h-11 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white" /></div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between"><Label className="text-sm text-gray-600">Parolă</Label>
                  <Link href="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700 font-medium">Ai uitat parola?</Link></div>
                <div className="relative"><Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required className="pl-10 h-11 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white" /></div>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl h-11 text-sm font-medium">
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se conectează...</> : <>Conectează-te<ArrowRight className="h-4 w-4 ml-2" /></>}
              </Button>
            </form>
            <p className="text-center text-sm text-gray-500 mt-6">Nu ai cont?{' '}<Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">Creează cont gratuit</Link></p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}