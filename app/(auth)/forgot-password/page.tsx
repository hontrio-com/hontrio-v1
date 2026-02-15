'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Loader2,
  Mail,
  ArrowLeft,
  Sparkles,
  CheckCircle,
  AlertCircle,
  KeyRound,
} from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Eroare la trimiterea emailului')
        setLoading(false)
        return
      }

      setSent(true)
    } catch {
      setError('Eroare de conexiune')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/20">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-10">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-bold gradient-text">HONTRIO</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            {sent ? (
              /* Success state */
              <div className="text-center">
                <div className="h-14 w-14 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle className="h-7 w-7 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Email trimis!</h2>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                  Am trimis instrucțiunile de resetare a parolei la <strong>{email}</strong>. Verifică-ți inbox-ul și folderul de spam.
                </p>
                <Link href="/login">
                  <Button variant="outline" className="rounded-xl h-10 w-full">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Înapoi la conectare
                  </Button>
                </Link>
              </div>
            ) : (
              /* Form state */
              <>
                <div className="text-center mb-6">
                  <div className="h-14 w-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-5">
                    <KeyRound className="h-7 w-7 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Resetează parola</h2>
                  <p className="text-gray-500 text-sm">
                    Introdu emailul asociat contului tău și îți vom trimite instrucțiunile de resetare.
                  </p>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl mb-5"
                  >
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                    <span className="text-sm text-red-700">{error}</span>
                  </motion.div>
                )}

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

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl h-11 text-sm font-medium"
                  >
                    {loading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se trimite...</>
                    ) : (
                      'Trimite link de resetare'
                    )}
                  </Button>
                </form>

                <div className="mt-5 text-center">
                  <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Înapoi la conectare
                  </Link>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}