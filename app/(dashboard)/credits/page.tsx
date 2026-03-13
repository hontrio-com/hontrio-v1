'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CreditCard, Loader2, ImageIcon, FileText, CheckCircle,
  Sparkles, Zap, Crown, Shield, Clock, Receipt,
  ChevronDown, ChevronUp, Rocket, Gift, ExternalLink,
  AlertCircle, Plus, Settings, TrendingDown, TrendingUp,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Transaction = {
  id: string; type: string; amount: number; balance_after: number
  description: string; reference_type: string; created_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'free', name: 'Free Trial', price: 0, period: '',
    description: 'Perfect pentru a testa platforma',
    icon: Gift, credits: 20,
    features: ['20 credite incluse', 'Generare text AI', 'Generare imagini AI', '1 magazin conectat', 'Suport prin email'],
    limitations: ['Fără generare în masă', 'Fără suport prioritar'],
  },
  {
    id: 'starter', name: 'Starter', price: 99, period: '/lună',
    description: 'Ideal pentru magazine mici',
    icon: Zap, credits: 250,
    features: ['250 credite / lună', 'Generare text AI nelimitată', 'Toate stilurile de imagini', '1 magazin conectat', 'Suport prioritar', 'Analiză SEO completă'],
    limitations: [],
  },
  {
    id: 'professional', name: 'Professional', price: 249, period: '/lună',
    description: 'Pentru magazine în creștere',
    icon: Rocket, credits: 750,
    features: ['750 credite / lună', 'Tot ce include Starter', 'Generare în masă (batch)', '3 magazine conectate', 'Suport prioritar 24/7', 'Rapoarte avansate'],
    limitations: [], popular: true,
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 499, period: '/lună',
    description: 'Pentru operațiuni la scară mare',
    icon: Crown, credits: 2000,
    features: ['2000 credite / lună', 'Tot ce include Professional', 'Magazine nelimitate', 'Manager de cont dedicat', 'SLA garantat 99.9%', 'Training personalizat'],
    limitations: [],
  },
]

const PACKS = [
  { id: 'pack_50',   credits: 50,   price: 39,  perCredit: 0.78, popular: false },
  { id: 'pack_100',  credits: 100,  price: 69,  perCredit: 0.69, popular: false },
  { id: 'pack_300',  credits: 300,  price: 159, perCredit: 0.53, popular: true  },
  { id: 'pack_500',  credits: 500,  price: 249, perCredit: 0.50, popular: false },
  { id: 'pack_1000', credits: 1000, price: 399, perCredit: 0.40, popular: false },
]

const COSTS = [
  { label: 'Generare text AI',      cost: '5 cr.', icon: FileText  },
  { label: 'Imagine Fundal Alb',    cost: '2 cr.', icon: ImageIcon },
  { label: 'Imagine Lifestyle',     cost: '3 cr.', icon: ImageIcon },
  { label: 'Imagine Premium',       cost: '3 cr.', icon: ImageIcon },
  { label: 'Imagine Seasonal',      cost: '4 cr.', icon: ImageIcon },
  { label: 'Generare automată 3×',  cost: '8 cr.', icon: Sparkles  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function txIcon(refType: string) {
  if (refType === 'image_generation') return ImageIcon
  if (refType === 'text_generation')  return FileText
  return Plus
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-neutral-200 rounded-xl ${className}`}>{children}</div>
}

function Btn({ onClick, disabled, children, variant = 'primary', className = '' }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode
  variant?: 'primary' | 'outline'; className?: string
}) {
  const base = 'inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-[13px] font-medium transition-all disabled:opacity-50'
  const v = { primary: 'bg-neutral-900 hover:bg-neutral-800 text-white', outline: 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50' }
  return <button onClick={onClick} disabled={disabled} className={`${base} ${v[variant]} ${className}`}>{children}</button>
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function SubscriptionPageInner() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading]           = useState(true)
  const [balance, setBalance]           = useState(0)
  const [tab, setTab]                   = useState('plans')
  const [showAll, setShowAll]           = useState(false)
  const [checkoutId, setCheckoutId]     = useState('')
  const [portalLoading, setPortalLoading] = useState(false)
  const [msg, setMsg]                   = useState({ type: '', text: '' })

  const userPlan = (session?.user as any)?.plan || 'free'

  useEffect(() => {
    if (searchParams.get('success') === 'true') { setMsg({ type: 'success', text: 'Abonament activat! Creditele au fost adăugate.' }); setTab('history') }
    if (searchParams.get('credits_success') === 'true') { setMsg({ type: 'success', text: 'Credite achiziționate cu succes!' }); setTab('history') }
    if (searchParams.get('canceled') === 'true') { setMsg({ type: 'error', text: 'Plata a fost anulată. Poți încerca din nou oricând.' }) }
  }, [searchParams])

  useEffect(() => { fetchCredits() }, [])

  async function fetchCredits() {
    try { const r = await fetch('/api/credits'); const d = await r.json(); setBalance(d.balance || 0); setTransactions(d.transactions || []) }
    catch {} finally { setLoading(false) }
  }

  async function handleSubscribe(planId: string) {
    if (planId === 'free') return
    setCheckoutId(planId)
    try {
      const r = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: planId }) })
      const d = await r.json()
      if (d.url) window.location.href = d.url
      else setMsg({ type: 'error', text: d.error || 'Eroare la inițializarea plății' })
    } catch { setMsg({ type: 'error', text: 'Eroare de conexiune' }) }
    finally { setCheckoutId('') }
  }

  async function handleBuyPack(packId: string) {
    setCheckoutId(packId)
    try {
      const r = await fetch('/api/stripe/credits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pack_id: packId }) })
      const d = await r.json()
      if (d.url) window.location.href = d.url
      else setMsg({ type: 'error', text: d.error || 'Eroare la inițializarea plății' })
    } catch { setMsg({ type: 'error', text: 'Eroare de conexiune' }) }
    finally { setCheckoutId('') }
  }

  async function handlePortal() {
    setPortalLoading(true)
    try {
      const r = await fetch('/api/stripe/portal', { method: 'POST' }); const d = await r.json()
      if (d.url) window.location.href = d.url
      else setMsg({ type: 'error', text: d.error || 'Nu ai un abonament activ' })
    } catch { setMsg({ type: 'error', text: 'Eroare de conexiune' }) }
    finally { setPortalLoading(false) }
  }

  const currentPlan  = PLANS.find(p => p.id === userPlan) || PLANS[0]
  const planIdx      = PLANS.findIndex(p => p.id === userPlan)
  const totalUsed    = transactions.filter(t => t.type === 'usage').reduce((s, t) => s + Math.abs(t.amount), 0)
  const displayed    = showAll ? transactions : transactions.slice(0, 8)

  if (loading) return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-neutral-100 rounded-xl animate-pulse" />
      <div className="h-32 bg-neutral-50 rounded-xl animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-72 bg-neutral-50 rounded-xl animate-pulse" />)}
      </div>
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight">Abonament & Credite</h1>
        <p className="text-[13px] text-neutral-400 mt-0.5">Gestionează planul, creditele și facturarea</p>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {msg.text && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] ${msg.type === 'success' ? 'bg-neutral-900 text-white' : 'bg-red-50 border border-red-100 text-red-700'}`}>
            {msg.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{msg.text}</span>
            <button onClick={() => setMsg({ type: '', text: '' })} className="ml-auto opacity-50 hover:opacity-100">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current plan banner */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="h-12 w-12 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
              <currentPlan.icon className="h-6 w-6 text-neutral-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-semibold text-neutral-900">Plan {currentPlan.name}</p>
                {userPlan !== 'free' && (
                  <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md">Activ</span>
                )}
              </div>
              <p className="text-[12px] text-neutral-400">{currentPlan.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[11px] text-neutral-400 mb-0.5">Credite disponibile</p>
              <p className="text-[28px] font-bold text-neutral-900 tabular-nums leading-none">{balance}</p>
              <div className="h-1 w-24 bg-neutral-100 rounded-full mt-1.5">
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((balance / currentPlan.credits) * 100, 100)}%` }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="h-full bg-neutral-900 rounded-full" />
              </div>
            </div>
            {userPlan !== 'free' && (
              <Btn variant="outline" onClick={handlePortal} disabled={portalLoading}>
                {portalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
                Gestionează
              </Btn>
            )}
          </div>
        </div>
      </Card>

      {/* Tab nav */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
        {[
          { value: 'plans',   label: 'Planuri',          icon: Sparkles   },
          { value: 'credits', label: 'Cumpără credite',  icon: CreditCard },
          { value: 'history', label: 'Istoric & Facturi', icon: Receipt   },
        ].map(t => {
          const Icon = t.icon
          return (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-medium transition-all whitespace-nowrap shrink-0
                ${tab === t.value ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'}`}>
              <Icon className="h-3.5 w-3.5 shrink-0" />{t.label}
            </button>
          )
        })}
      </div>

      {/* ═══ PLANURI ═══ */}
      {tab === 'plans' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {PLANS.map((plan, i) => {
              const isCurrent = userPlan === plan.id
              const isUpgrade = i > planIdx
              const PlanIcon  = plan.icon
              return (
                <motion.div key={plan.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className={`relative h-full flex flex-col bg-white rounded-xl border-2 overflow-hidden transition-all
                    ${(plan as any).popular ? 'border-neutral-900' : isCurrent ? 'border-neutral-300' : 'border-neutral-200 hover:border-neutral-300'}`}>
                    {(plan as any).popular && (
                      <div className="absolute top-0 right-0 bg-neutral-900 text-white text-[9px] font-bold px-3 py-1 rounded-bl-xl tracking-wide">RECOMANDAT</div>
                    )}
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-9 w-9 rounded-xl bg-neutral-100 flex items-center justify-center">
                          <PlanIcon className="h-4 w-4 text-neutral-500" />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-neutral-900">{plan.name}</p>
                          <p className="text-[11px] text-neutral-400">{plan.description}</p>
                        </div>
                      </div>

                      <div className="mb-4">
                        {plan.price === 0
                          ? <p className="text-[28px] font-bold text-neutral-900">Gratuit</p>
                          : <p className="text-[28px] font-bold text-neutral-900">{plan.price} <span className="text-[14px] font-normal text-neutral-400">RON{plan.period}</span></p>
                        }
                        <p className="text-[11px] text-neutral-400 mt-0.5"><span className="font-medium text-neutral-600">{plan.credits} credite</span> incluse</p>
                      </div>

                      <div className="space-y-1.5 flex-1 mb-4">
                        {plan.features.map((f, j) => (
                          <div key={j} className="flex items-start gap-2">
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                            <span className="text-[12px] text-neutral-600">{f}</span>
                          </div>
                        ))}
                        {plan.limitations.map((l, j) => (
                          <div key={j} className="flex items-start gap-2 opacity-40">
                            <div className="h-3.5 w-3.5 rounded-full border border-neutral-300 mt-0.5 shrink-0" />
                            <span className="text-[12px] text-neutral-400 line-through">{l}</span>
                          </div>
                        ))}
                      </div>

                      {isCurrent ? (
                        <button disabled className="w-full h-9 rounded-xl bg-neutral-100 text-neutral-400 text-[12px] font-medium flex items-center justify-center gap-1.5">
                          <CheckCircle className="h-3.5 w-3.5" />Plan curent
                        </button>
                      ) : isUpgrade ? (
                        <button onClick={() => handleSubscribe(plan.id)} disabled={checkoutId === plan.id}
                          className="w-full h-9 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[12px] font-medium flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all">
                          {checkoutId === plan.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                          {checkoutId === plan.id ? 'Se procesează...' : `Upgrade la ${plan.name}`}
                        </button>
                      ) : (
                        <button onClick={handlePortal} disabled={portalLoading}
                          className="w-full h-9 rounded-xl border border-neutral-200 text-neutral-500 hover:bg-neutral-50 text-[12px] font-medium flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all">
                          Gestionează
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          <Card className="p-4 bg-neutral-50">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-xl bg-white border border-neutral-200 flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4 text-neutral-400" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-neutral-700 mb-0.5">Plată securizată prin Stripe</p>
                <p className="text-[12px] text-neutral-400 leading-relaxed">
                  Toate plățile sunt procesate securizat. Poți face upgrade sau downgrade oricând. Anularea se face simplu, fără obligații. Acceptăm Visa, Mastercard, și alte metode de plată.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ═══ CREDITE ═══ */}
      {tab === 'credits' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <Card className="p-5">
              <p className="text-[13px] font-semibold text-neutral-900 mb-0.5">Cumpără credite suplimentare</p>
              <p className="text-[12px] text-neutral-400 mb-4">Creditele nu expiră și se adaugă la balanța ta</p>
              <div className="space-y-2">
                {PACKS.map(pack => (
                  <div key={pack.id} className={`flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all
                    ${pack.popular ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${pack.popular ? 'bg-neutral-900' : 'bg-neutral-100'}`}>
                        <Sparkles className={`h-4 w-4 ${pack.popular ? 'text-white' : 'text-neutral-400'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-semibold text-neutral-900">{pack.credits} credite</p>
                          {pack.popular && <span className="text-[9px] font-bold bg-neutral-900 text-white px-1.5 py-0.5 rounded-md">POPULAR</span>}
                        </div>
                        <p className="text-[11px] text-neutral-400 tabular-nums">{pack.perCredit.toFixed(2)} RON / credit</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-[15px] font-bold text-neutral-900 tabular-nums">{pack.price} RON</p>
                      <button onClick={() => handleBuyPack(pack.id)} disabled={!!checkoutId}
                        className="h-8 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[12px] font-medium disabled:opacity-50 transition-all flex items-center gap-1.5">
                        {checkoutId === pack.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Cumpără'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-3">Cost per acțiune</p>
              <div className="space-y-2">
                {COSTS.map((item, i) => {
                  const Icon = item.icon
                  return (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-neutral-300" />
                        <span className="text-[13px] text-neutral-600">{item.label}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-md tabular-nums">{item.cost}</span>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card className="p-5 bg-neutral-50">
              <div className="flex items-center gap-2 mb-1.5">
                <Shield className="h-3.5 w-3.5 text-neutral-400" />
                <p className="text-[12px] font-semibold text-neutral-700">Plată securizată</p>
              </div>
              <p className="text-[12px] text-neutral-500 leading-relaxed">
                Tranzacțiile sunt procesate securizat prin Stripe. Acceptăm Visa, Mastercard, și alte metode de plată.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* ═══ ISTORIC ═══ */}
      {tab === 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[13px] font-semibold text-neutral-900">Istoric tranzacții</p>
                <span className="text-[11px] text-neutral-400">{transactions.length} total</span>
              </div>

              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-8 w-8 text-neutral-200 mx-auto mb-3" />
                  <p className="text-[13px] font-medium text-neutral-500">Nicio tranzacție încă</p>
                  <p className="text-[12px] text-neutral-400 mt-1">Tranzacțiile vor apărea aici</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-neutral-50">
                    {displayed.map(t => {
                      const Icon = txIcon(t.reference_type)
                      return (
                        <div key={t.id} className="flex items-center gap-3 py-2.5">
                          <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${t.amount > 0 ? 'bg-emerald-50' : 'bg-neutral-100'}`}>
                            <Icon className={`h-3.5 w-3.5 ${t.amount > 0 ? 'text-emerald-600' : 'text-neutral-400'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-neutral-700 truncate">{t.description || t.type}</p>
                            <p className="text-[11px] text-neutral-400">
                              {new Date(t.created_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-[13px] font-semibold tabular-nums ${t.amount > 0 ? 'text-emerald-600' : 'text-neutral-700'}`}>
                              {t.amount > 0 ? '+' : ''}{t.amount}
                            </p>
                            <p className="text-[10px] text-neutral-400 tabular-nums">sold: {t.balance_after}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {transactions.length > 8 && (
                    <button onClick={() => setShowAll(s => !s)}
                      className="w-full mt-3 py-2 text-[12px] text-neutral-500 hover:text-neutral-700 font-medium flex items-center justify-center gap-1 transition-colors">
                      {showAll
                        ? <><ChevronUp className="h-3 w-3" />Arată mai puțin</>
                        : <><ChevronDown className="h-3 w-3" />Arată toate ({transactions.length})</>}
                    </button>
                  )}
                </>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-4">Sumar consum</p>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-[13px] mb-1.5">
                    <span className="text-neutral-500">Credite utilizate</span>
                    <span className="font-semibold text-neutral-900 tabular-nums">{totalUsed}</span>
                  </div>
                  <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full bg-neutral-400 rounded-full transition-all" style={{ width: `${Math.min((totalUsed / currentPlan.credits) * 100, 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[13px] mb-1.5">
                    <span className="text-neutral-500">Credite rămase</span>
                    <span className="font-semibold text-neutral-900 tabular-nums">{balance}</span>
                  </div>
                  <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min((balance / currentPlan.credits) * 100, 100)}%` }} />
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-100 space-y-2">
                  {[
                    { label: 'Texte generate', icon: FileText, count: transactions.filter(t => t.reference_type === 'text_generation').length },
                    { label: 'Imagini generate', icon: ImageIcon, count: transactions.filter(t => t.reference_type === 'image_generation').length },
                  ].map((item, i) => {
                    const Icon = item.icon
                    return (
                      <div key={i} className="flex items-center justify-between text-[13px]">
                        <div className="flex items-center gap-2 text-neutral-500"><Icon className="h-3.5 w-3.5" />{item.label}</div>
                        <span className="font-medium text-neutral-900 tabular-nums">{item.count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Card>

            {userPlan !== 'free' && (
              <Card className="p-5">
                <p className="text-[13px] font-semibold text-neutral-900 mb-1">Facturare</p>
                <p className="text-[12px] text-neutral-400 leading-relaxed mb-3">
                  Gestionează abonamentul, metoda de plată și descarcă facturile din portalul Stripe.
                </p>
                <Btn variant="outline" onClick={handlePortal} disabled={portalLoading} className="w-full justify-center">
                  {portalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                  Portal de facturare
                </Btn>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-neutral-300" /></div>}>
      <SubscriptionPageInner />
    </Suspense>
  )
}