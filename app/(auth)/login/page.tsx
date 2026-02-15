'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Loader2,
  Mail,
  Lock,
  Sparkles,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Zap,
  ImageIcon,
  BarChart3,
  Target,
} from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const registered = searchParams.get('registered') === 'true'
  const onboarding = searchParams.get('onboarding') === 'true'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (res?.error) {
      setError('Email sau parolă incorectă')
      setLoading(false)
      return
    }

    router.push(onboarding ? '/onboarding' : '/dashboard')
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <motion.div
            animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-20 left-20 w-72 h-72 bg-white/5 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ x: [0, 15, 0], y: [0, 15, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1/2 left-1/3 w-64 h-64 bg-blue-300/10 rounded-full blur-3xl"
          />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-16 py-12 w-full">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-3 mb-16"
          >
            <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">HONTRIO</span>
          </motion.div>

          {/* Main heading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Optimizează.<br />
              Creează.<br />
              <span className="text-blue-200">Publică.</span>
            </h1>
            <p className="text-blue-200 text-lg leading-relaxed max-w-md">
              Generează titluri, descrieri, imagini și optimizare SEO în câteva minute, apoi publică direct în magazinul tău.
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mb-10"
          >
            <p className="text-blue-300 text-sm mb-4 font-medium">
              Reduce cu până la 70% timpul de creare și optimizare a produselor
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Zap, label: 'Conținut AI', desc: 'Titluri & descrieri SEO' },
                { icon: ImageIcon, label: 'Imagini AI', desc: '6 stiluri profesionale' },
                { icon: Target, label: 'SEO Score', desc: 'Analiză automată' },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="bg-white/[0.07] backdrop-blur rounded-xl p-3.5"
                >
                  <item.icon className="h-5 w-5 text-blue-200 mb-2" />
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="text-[11px] text-blue-300">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Testimonial */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="bg-white/[0.07] backdrop-blur rounded-2xl p-5"
          >
            <p className="text-blue-100 text-sm italic leading-relaxed mb-3">
              "Am redus timpul de optimizare a produselor de la 2 ore la 10 minute. Conținutul generat de AI e mai bun decât ce scriam manual."
            </p>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-blue-400/20 flex items-center justify-center">
                <span className="text-sm font-medium text-white">M</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Maria S.</p>
                <p className="text-[11px] text-blue-300">Owner, Fashion Store</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right side — form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">HONTRIO</span>
          </div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Bine ai revenit</h2>
            <p className="text-gray-500 text-sm mb-8">
              Conectează-te pentru a gestiona produsele și a crește vânzările magazinului tău.
            </p>
          </motion.div>

          {/* Success message from registration */}
          {registered && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl mb-6"
            >
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              <span className="text-sm text-green-700">Cont creat cu succes! Conectează-te pentru a continua.</span>
            </motion.div>
          )}

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl mb-6"
            >
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <span className="text-sm text-red-700">{error}</span>
            </motion.div>
          )}

          {/* Form */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemplu.ro"
                    required
                    className="pl-10 h-11 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-gray-600">Parolă</Label>
                  <Link href="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                    Ai uitat parola?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="pl-10 h-11 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl h-11 text-sm font-medium"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se conectează...</>
                ) : (
                  <>Conectează-te<ArrowRight className="h-4 w-4 ml-2" /></>
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Nu ai cont?{' '}
              <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
                Creează cont gratuit
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}