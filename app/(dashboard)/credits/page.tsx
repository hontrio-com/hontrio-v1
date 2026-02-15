'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CreditCard,
  Loader2,
  ImageIcon,
  FileText,
  CheckCircle,
  Sparkles,
  Zap,
  Crown,
  ArrowRight,
  Shield,
  Clock,
  Receipt,
  ChevronDown,
  ChevronUp,
  Rocket,
  Gift,
  ExternalLink,
  AlertCircle,
  Plus,
  Minus,
  Settings,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'

type Transaction = {
  id: string
  type: string
  amount: number
  balance_after: number
  description: string
  reference_type: string
  created_at: string
}

const fadeInUp = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
}

const plans = [
  {
    id: 'free',
    name: 'Free Trial',
    price: 0,
    period: '',
    description: 'Perfect pentru a testa platforma',
    icon: Gift,
    color: 'gray',
    credits: 20,
    features: ['20 credite incluse', 'Generare text AI', 'Generare imagini AI', '1 magazin conectat', 'Suport prin email'],
    limitations: ['Fără generare în masă', 'Fără suport prioritar'],
    popular: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    period: '/lună',
    description: 'Ideal pentru magazine mici',
    icon: Zap,
    color: 'blue',
    credits: 200,
    features: ['200 credite / lună', 'Generare text AI nelimitată', 'Toate stilurile de imagini', '1 magazin conectat', 'Suport prioritar', 'Analiză SEO completă'],
    limitations: [],
    popular: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 99,
    period: '/lună',
    description: 'Pentru magazine în creștere',
    icon: Rocket,
    color: 'indigo',
    credits: 500,
    features: ['500 credite / lună', 'Tot ce include Starter', 'Generare în masă (batch)', '3 magazine conectate', 'Suport prioritar 24/7', 'API access', 'Rapoarte avansate'],
    limitations: [],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 249,
    period: '/lună',
    description: 'Pentru operațiuni la scară mare',
    icon: Crown,
    color: 'purple',
    credits: 2000,
    features: ['2000 credite / lună', 'Tot ce include Professional', 'Magazine nelimitate', 'Manager de cont dedicat', 'SLA garantat 99.9%', 'Integrări custom', 'Training personalizat', 'Facturare personalizată'],
    limitations: [],
    popular: false,
  },
]

const creditPacks = [
  { id: 'pack_50', credits: 50, price: 15, perCredit: 0.30, popular: false },
  { id: 'pack_100', credits: 100, price: 25, perCredit: 0.25, popular: false },
  { id: 'pack_250', credits: 250, price: 50, perCredit: 0.20, popular: true },
  { id: 'pack_500', credits: 500, price: 85, perCredit: 0.17, popular: false },
  { id: 'pack_1000', credits: 1000, price: 150, perCredit: 0.15, popular: false },
]

export default function SubscriptionPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)
  const [activeTab, setActiveTab] = useState('plans')
  const [showAllTransactions, setShowAllTransactions] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState('')
  const [portalLoading, setPortalLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const userPlan = (session?.user as any)?.plan || 'free'

  // Handle success/cancel from Stripe
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setMessage({ type: 'success', text: 'Abonament activat cu succes! Creditele au fost adăugate în contul tău.' })
      setActiveTab('history')
    }
    if (searchParams.get('credits_success') === 'true') {
      setMessage({ type: 'success', text: 'Credite achiziționate cu succes! Au fost adăugate în contul tău.' })
      setActiveTab('history')
    }
    if (searchParams.get('canceled') === 'true') {
      setMessage({ type: 'error', text: 'Plata a fost anulată. Poți încerca din nou oricând.' })
    }
  }, [searchParams])

  useEffect(() => {
    fetchCredits()
  }, [])

  const fetchCredits = async () => {
    try {
      const res = await fetch('/api/credits')
      const data = await res.json()
      setBalance(data.balance || 0)
      setTransactions(data.transactions || [])
    } catch {
      console.error('Error loading credits')
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async (planId: string) => {
    if (planId === 'free') return
    setCheckoutLoading(planId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setMessage({ type: 'error', text: data.error || 'Eroare la inițializarea plății' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Eroare de conexiune' })
    } finally {
      setCheckoutLoading('')
    }
  }

  const handleBuyCredits = async (packId: string) => {
    setCheckoutLoading(packId)
    try {
      const res = await fetch('/api/stripe/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack_id: packId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setMessage({ type: 'error', text: data.error || 'Eroare la inițializarea plății' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Eroare de conexiune' })
    } finally {
      setCheckoutLoading('')
    }
  }

  const handleManageSubscription = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setMessage({ type: 'error', text: data.error || 'Nu ai un abonament activ' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Eroare de conexiune' })
    } finally {
      setPortalLoading(false)
    }
  }

  const totalUsed = transactions.filter(t => t.type === 'usage').reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const currentPlan = plans.find(p => p.id === userPlan) || plans[0]
  const maxCredits = currentPlan.credits
  const displayedTransactions = showAllTransactions ? transactions : transactions.slice(0, 8)

  const getIcon = (refType: string) => {
    switch (refType) {
      case 'image_generation': return <ImageIcon className="h-3.5 w-3.5" />
      case 'text_generation': return <FileText className="h-3.5 w-3.5" />
      case 'subscription': case 'subscription_renewal': case 'credit_purchase': return <Plus className="h-3.5 w-3.5" />
      default: return <CreditCard className="h-3.5 w-3.5" />
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-48 bg-white rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-80 bg-white rounded-2xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <motion.div {...fadeInUp} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold text-gray-900">Abonament & Credite</h1>
        <p className="text-gray-500 text-sm mt-0.5">Gestionează planul, creditele și facturarea</p>
      </motion.div>

      {/* Message */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`flex items-center gap-3 p-4 rounded-xl ${
              message.type === 'success' ? 'bg-green-50 border border-green-100 text-green-700' : 'bg-red-50 border border-red-100 text-red-700'
            }`}
          >
            {message.type === 'success' ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
            <span className="text-sm">{message.text}</span>
            <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto text-current opacity-50 hover:opacity-100">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current plan banner */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.05 }}>
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
                <currentPlan.icon className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">Plan {currentPlan.name}</h2>
                  {userPlan !== 'free' && (
                    <Badge className="bg-white/20 text-white border-0 text-[10px]">Activ</Badge>
                  )}
                </div>
                <p className="text-blue-200 text-sm mt-0.5">{currentPlan.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-white/10 backdrop-blur rounded-xl p-4 min-w-[140px]">
                <p className="text-xs text-blue-200 mb-1">Credite disponibile</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{balance}</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full mt-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((balance / maxCredits) * 100, 100)}%` }}
                    transition={{ duration: 1, delay: 0.3 }}
                    className="h-full bg-white/80 rounded-full"
                  />
                </div>
              </div>
              {userPlan !== 'free' && (
                <Button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  variant="ghost"
                  className="text-white hover:bg-white/10 rounded-xl"
                >
                  {portalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
                  Gestionează abonament
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.1 }}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gray-100/80 p-1 rounded-xl h-auto">
            <TabsTrigger value="plans" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm">
              <Sparkles className="h-4 w-4 mr-2" />Planuri
            </TabsTrigger>
            <TabsTrigger value="credits" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm">
              <CreditCard className="h-4 w-4 mr-2" />Cumpără credite
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 text-sm">
              <Receipt className="h-4 w-4 mr-2" />Istoric & Facturi
            </TabsTrigger>
          </TabsList>

          {/* PLANS TAB */}
          <TabsContent value="plans" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {plans.map((plan, i) => {
                const isCurrent = userPlan === plan.id
                const isUpgrade = plans.indexOf(plan) > plans.findIndex(p => p.id === userPlan)
                return (
                  <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}>
                    <Card className={`rounded-2xl h-full flex flex-col relative overflow-hidden ${
                      plan.popular ? 'border-2 border-blue-500 shadow-lg shadow-blue-100' :
                      isCurrent ? 'border-2 border-blue-200 bg-blue-50/30' : 'border border-gray-100 shadow-sm'
                    }`}>
                      {plan.popular && (
                        <div className="absolute top-0 right-0">
                          <div className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">RECOMANDAT</div>
                        </div>
                      )}
                      <CardContent className="p-5 flex flex-col flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                            plan.color === 'gray' ? 'bg-gray-100' : plan.color === 'blue' ? 'bg-blue-100' :
                            plan.color === 'indigo' ? 'bg-indigo-100' : 'bg-purple-100'
                          }`}>
                            <plan.icon className={`h-5 w-5 ${
                              plan.color === 'gray' ? 'text-gray-600' : plan.color === 'blue' ? 'text-blue-600' :
                              plan.color === 'indigo' ? 'text-indigo-600' : 'text-purple-600'
                            }`} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                            <p className="text-xs text-gray-400">{plan.description}</p>
                          </div>
                        </div>
                        <div className="mb-4">
                          <div className="flex items-baseline gap-1">
                            {plan.price === 0 ? (
                              <span className="text-3xl font-bold text-gray-900">Gratuit</span>
                            ) : (
                              <><span className="text-3xl font-bold text-gray-900">{plan.price}</span><span className="text-gray-400 text-sm">RON{plan.period}</span></>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1"><span className="font-medium text-gray-600">{plan.credits} credite</span> incluse</p>
                        </div>
                        <div className="space-y-2 flex-1">
                          {plan.features.map((f, j) => (
                            <div key={j} className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                              <span className="text-sm text-gray-600">{f}</span>
                            </div>
                          ))}
                          {plan.limitations.map((l, j) => (
                            <div key={j} className="flex items-start gap-2 opacity-50">
                              <div className="h-4 w-4 rounded-full border border-gray-300 mt-0.5 shrink-0" />
                              <span className="text-sm text-gray-400 line-through">{l}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-5">
                          {isCurrent ? (
                            <Button disabled className="w-full rounded-xl h-10 bg-gray-100 text-gray-500 border-0">
                              <CheckCircle className="h-4 w-4 mr-2" />Plan curent
                            </Button>
                          ) : isUpgrade ? (
                            <Button
                              onClick={() => handleSubscribe(plan.id)}
                              disabled={checkoutLoading === plan.id}
                              className={`w-full rounded-xl h-10 ${
                                plan.popular ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-900 hover:bg-gray-800 text-white'
                              }`}
                            >
                              {checkoutLoading === plan.id ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Se procesează...</>
                              ) : (
                                <><Zap className="h-4 w-4 mr-2" />Upgrade la {plan.name}</>
                              )}
                            </Button>
                          ) : (
                            <Button
                              onClick={handleManageSubscription}
                              disabled={portalLoading}
                              variant="outline"
                              className="w-full rounded-xl h-10 border-gray-200"
                            >
                              Gestionează
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
            <Card className="rounded-2xl border-0 shadow-sm mt-6 bg-gradient-to-br from-gray-50 to-blue-50/30">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <Shield className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">Plată securizată prin Stripe</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Toate plățile sunt procesate securizat prin Stripe. Poți face upgrade sau downgrade oricând din portalul de facturare. Anularea se face simplu, fără obligații. Acceptăm Visa, Mastercard, și alte metode de plată.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CREDITS TAB */}
          <TabsContent value="credits" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center">
                        <CreditCard className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Cumpără credite suplimentare</h3>
                        <p className="text-xs text-gray-400">Creditele nu expiră și se adaugă la balanța ta</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {creditPacks.map((pack) => (
                        <div key={pack.id} className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                          pack.popular ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50/30'
                        }`}>
                          <div className="flex items-center gap-4">
                            <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${
                              pack.popular ? 'bg-blue-100' : 'bg-gray-100'
                            }`}>
                              <Sparkles className={`h-5 w-5 ${pack.popular ? 'text-blue-600' : 'text-gray-500'}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-base font-semibold text-gray-900">{pack.credits} credite</span>
                                {pack.popular && <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px]">Popular</Badge>}
                              </div>
                              <span className="text-xs text-gray-400">{pack.perCredit.toFixed(2)} RON / credit</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-gray-900">{pack.price} RON</span>
                            <Button
                              size="sm"
                              onClick={() => handleBuyCredits(pack.id)}
                              disabled={checkoutLoading === pack.id}
                              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white h-9 px-4"
                            >
                              {checkoutLoading === pack.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Cumpără'
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-4">
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Costuri per acțiune</h3>
                    <div className="space-y-3">
                      {[
                        { label: 'Generare text AI', cost: '5 credite', icon: FileText },
                        { label: 'Imagine Fundal Alb', cost: '2 credite', icon: ImageIcon },
                        { label: 'Imagine Lifestyle', cost: '3 credite', icon: ImageIcon },
                        { label: 'Imagine Premium', cost: '3 credite', icon: ImageIcon },
                        { label: 'Imagine Seasonal', cost: '4 credite', icon: ImageIcon },
                        { label: 'Generare automată (3x)', cost: '8 credite', icon: Sparkles },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <item.icon className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-sm text-gray-600">{item.label}</span>
                          </div>
                          <span className="text-xs font-medium text-gray-900">{item.cost}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-900">Plată securizată</span>
                    </div>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Toate tranzacțiile sunt procesate securizat prin Stripe. Acceptăm Visa, Mastercard, și alte metode de plată.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* HISTORY TAB */}
          <TabsContent value="history" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">Istoric tranzacții</CardTitle>
                      <span className="text-xs text-gray-400">{transactions.length} tranzacții</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {transactions.length === 0 ? (
                      <div className="text-center py-12">
                        <Clock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">Nicio tranzacție încă</p>
                        <p className="text-sm text-gray-400 mt-1">Tranzacțiile vor apărea aici</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1">
                          {displayedTransactions.map((t) => (
                            <div key={t.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                                  t.amount > 0 ? 'bg-green-100 text-green-600' :
                                  t.reference_type === 'image_generation' ? 'bg-purple-100 text-purple-600' :
                                  'bg-blue-100 text-blue-600'
                                }`}>
                                  {getIcon(t.reference_type)}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{t.description || t.type}</p>
                                  <p className="text-[11px] text-gray-400">
                                    {new Date(t.created_at).toLocaleDateString('ro-RO', {
                                      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-bold ${t.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                  {t.amount > 0 ? '+' : ''}{t.amount}
                                </p>
                                <p className="text-[10px] text-gray-400">Balanță: {t.balance_after}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {transactions.length > 8 && (
                          <button
                            onClick={() => setShowAllTransactions(!showAllTransactions)}
                            className="w-full mt-3 py-2 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1"
                          >
                            {showAllTransactions ? <><ChevronUp className="h-3 w-3" />Arată mai puțin</> : <><ChevronDown className="h-3 w-3" />Arată toate ({transactions.length})</>}
                          </button>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
              <div className="space-y-4">
                <Card className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Sumar consum</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="text-gray-500">Credite utilizate</span>
                          <span className="font-semibold text-gray-900">{totalUsed}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min((totalUsed / maxCredits) * 100, 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="text-gray-500">Credite rămase</span>
                          <span className="font-semibold text-gray-900">{balance}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min((balance / maxCredits) * 100, 100)}%` }} />
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-blue-500" /><span className="text-gray-500">Texte generate</span></div>
                          <span className="font-medium text-gray-900">{transactions.filter(t => t.reference_type === 'text_generation').length}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5 text-purple-500" /><span className="text-gray-500">Imagini generate</span></div>
                          <span className="font-medium text-gray-900">{transactions.filter(t => t.reference_type === 'image_generation').length}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {userPlan !== 'free' && (
                  <Card className="rounded-2xl border-0 shadow-sm">
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Facturare</h3>
                      <p className="text-xs text-gray-500 leading-relaxed mb-3">
                        Gestionează abonamentul, metoda de plată și descarcă facturile din portalul Stripe.
                      </p>
                      <Button
                        onClick={handleManageSubscription}
                        disabled={portalLoading}
                        variant="outline"
                        size="sm"
                        className="w-full rounded-xl h-9 border-gray-200 text-xs"
                      >
                        {portalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ExternalLink className="h-3.5 w-3.5 mr-1.5" />}
                        Deschide portalul de facturare
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  )
}