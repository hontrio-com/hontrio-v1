'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  Mail,
  Lock,
  User,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Gift,
  Zap,
  ImageIcon,
  Target,
} from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Step 1: Register
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Eroare la crearea contului')
        setLoading(false)
        return
      }

      // Step 2: Auto-login
      const signInRes = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (signInRes?.error) {
        // Fallback: redirect to login if auto-login fails
        router.push('/login?registered=true&onboarding=true')
        return
      }

      // Step 3: Redirect to onboarding
      router.push('/onboarding')
    } catch {
      setError('Eroare de conexiune. Încearcă din nou.')
    } finally {
      setLoading(false)
    }
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
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-16 py-12 w-full">
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

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Creează produse<br />
              complete cu AI.<br />
              <span className="text-blue-200">Mai rapid ca niciodată.</span>
            </h1>
            <p className="text-blue-200 text-lg leading-relaxed max-w-md">
              Platforma care accelerează creșterea magazinelor online și reduce cu până la 70% timpul de creare și optimizare a produselor.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="grid grid-cols-3 gap-3 mb-10"
          >
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
          </motion.div>

          {/* Free trial badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="bg-white/[0.07] backdrop-blur rounded-2xl p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <Gift className="h-5 w-5 text-yellow-300" />
              <span className="text-sm font-semibold text-white">Free Trial inclus</span>
            </div>
            <p className="text-blue-200 text-sm leading-relaxed">
              Primești 20 de credite gratuite la înregistrare. Fără card bancar. Testează toate funcțiile AI fără obligații.
            </p>
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
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold text-gray-900">Creează cont</h2>
              <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">
                <Gift className="h-3 w-3 mr-1" />
                20 credite gratuite
              </Badge>
            </div>
            <p className="text-gray-500 text-sm mb-8">
              Începe să optimizezi produsele magazinului tău cu inteligență artificială.
            </p>
          </motion.div>

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

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">Nume complet</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Numele tău"
                    required
                    className="pl-10 h-11 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white"
                  />
                </div>
              </div>

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
                <Label className="text-sm text-gray-600">Parolă</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minim 6 caractere"
                    required
                    minLength={6}
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
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se creează contul...</>
                ) : (
                  <>Creează cont gratuit<ArrowRight className="h-4 w-4 ml-2" /></>
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Ai deja cont?{' '}
              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Conectează-te
              </Link>
            </p>

            <p className="text-center text-[11px] text-gray-400 mt-4">
              Prin crearea contului, ești de acord cu{' '}
              <Link href="#" className="underline hover:text-gray-500">Termenii și Condițiile</Link>
              {' '}și{' '}
              <Link href="#" className="underline hover:text-gray-500">Politica de Confidențialitate</Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}