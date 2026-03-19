'use client'

import { useT } from '@/lib/i18n/context'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, AlertTriangle, Bell, BellOff, Users, Package,
  RefreshCw, Search, X, Check, Eye,
  Phone, Mail, MapPin, Calendar, Clock, TrendingDown,
  Ban, CheckCircle2, Pencil, Filter,
  ArrowUpRight, ChevronRight, TrendingUp,
  Globe, BarChart3, FileText, Download,
  AlertCircle, ChevronLeft,
  Sparkles, Brain, Hash, DollarSign,
  TriangleAlert, UserX, Award,
  Layers, Settings, Cpu,
  Network, AlertOctagon, Wallet, ArrowDown, ArrowUp,
  ImageIcon, Plus, GitMerge, Link2,
} from 'lucide-react'
import { LABEL_CONFIG } from '@/lib/risk/engine'

// ─── Types ────────────────────────────────────────────────────────────────────

type Customer = {
  id: string; store_id: string; phone: string | null; email: string | null
  name: string | null; risk_score: number; risk_label: keyof typeof LABEL_CONFIG
  total_orders: number; orders_collected: number; orders_refused: number
  orders_not_home: number; orders_cancelled: number
  in_local_blacklist: boolean; in_global_blacklist: boolean
  manually_reviewed: boolean; operator_notes: string | null
  manual_label_override: string | null; last_order_at: string | null; first_order_at: string | null
}

type Order = {
  id: string; external_order_id: string; order_number: string | null
  customer_name: string | null; customer_phone: string | null; customer_email: string | null
  shipping_address: string | null; payment_method: string; total_value: number; currency: string
  order_status: string; risk_score_at_order: number; risk_flags: any[]; ordered_at: string
}

type Alert = {
  id: string; alert_type: string; severity: string; title: string
  description: string | null; is_read: boolean; is_resolved: boolean; created_at: string
}

type Store = { id: string; store_url: string; platform: string }

type FinancialData = {
  period: number; currency: string
  loss: { productLoss: number; shippingLoss: number; returnShippingLoss: number; repackagingLoss: number; totalLoss: number }
  prevLoss: { totalLoss: number }
  blockedValue: number
  collectionRate: number; refusalRate: number; prevRefusalRate: number; refusalRateChange: number
  totalOrders: number; refusedCount: number; collectedCount: number; cancelledCount: number
  projectedMonthlyLoss: number
  daily: Array<{ date: string; refused: number; collected: number; refusalValue: number; refusalRate: number }>
  topLossCustomers: Array<{ id: string; name: string | null; phone: string | null; risk_score: number; risk_label: string; orders_refused: number; total_orders: number; totalLoss: number; lossOrders: number }>
}

type HeatmapPoint = {
  county: string; name: string; lat: number; lng: number
  total: number; refused: number; collected: number
  refusalRate: number; totalValue: number; refusedValue: number; riskLevel: string
}

type ClusterMatch = {
  matchedCustomerId: string; similarity: number; matchReason: string[]
  customer: { id: string; name: string | null; phone: string | null; email: string | null; risk_score: number; risk_label: string; orders_refused: number; total_orders: number } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const getOrderStatusLabels = (t: (k: string, p?: Record<string, string | number>) => string): Record<string, string> => ({
  pending: t('risk.status_pending'), processing: t('risk.status_processing'), shipped: t('risk.status_shipped'),
  collected: t('risk.collected'), refused: t('risk.refused'), not_home: t('risk.status_not_home'),
  cancelled: t('risk.cancelled'), returned: t('risk.status_returned_label'),
})

const ORDER_STATUS_ICON: Record<string, string> = {
  collected: '✓', refused: '✗', not_home: '○', cancelled: '—',
  pending: '·', processing: '◎', shipped: '→', returned: '↩',
}

// ─── Tiny reusable primitives ─────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-neutral-200 rounded-xl ${className}`}>{children}</div>
}

function Btn({ onClick, disabled, children, variant = 'primary', size = 'md', className = '' }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode
  variant?: 'primary' | 'outline' | 'ghost'; size?: 'sm' | 'md'; className?: string
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium transition-all disabled:opacity-40'
  const sizes = { sm: 'h-7 px-2.5 text-[11px] rounded-lg', md: 'h-9 px-3.5 text-[12px] rounded-xl' }
  const variants = {
    primary: 'bg-neutral-900 hover:bg-neutral-800 text-white',
    outline: 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50',
    ghost: 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100',
  }
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-2">{children}</p>
}

// ─── Risk Badge ───────────────────────────────────────────────────────────────

function RiskBadge({ label, score }: { label: keyof typeof LABEL_CONFIG; score?: number }) {
  const cfg = LABEL_CONFIG[label] || LABEL_CONFIG.new
  const styles: Record<string, string> = {
    trusted:     'bg-emerald-50 text-emerald-700 border border-emerald-200',
    new:         'bg-neutral-100 text-neutral-500 border border-neutral-200',
    watch:       'bg-amber-50 text-amber-700 border border-amber-200',
    problematic: 'bg-orange-50 text-orange-700 border border-orange-200',
    blocked:     'bg-red-600 text-white border border-red-600',
  }
  const dots: Record<string, string> = {
    trusted: 'bg-emerald-500', new: 'bg-neutral-400', watch: 'bg-amber-500',
    problematic: 'bg-orange-500', blocked: 'bg-white',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${styles[label] || styles.new}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dots[label] || dots.new}`} />
      {cfg.label}
      {score !== undefined && <span className="opacity-50 tabular-nums">· {score}</span>}
    </span>
  )
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const { t } = useT()
  const r = (size / 2) - 8
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 81 ? '#dc2626' : score >= 61 ? '#ea580c' : score >= 41 ? '#d97706' : '#10b981'
  const label = score >= 81 ? t('risk.label_blocked') : score >= 61 ? t('risk.label_problematic') : score >= 41 ? t('risk.label_watch') : t('risk.label_trusted')
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 absolute">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f5f5f5" strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="text-center z-10">
        <div className="text-xl font-black text-neutral-900 leading-none">{score}</div>
        <div className="text-[9px] text-neutral-400 mt-0.5">{label}</div>
      </div>
    </div>
  )
}

// ─── Behavior Bar ─────────────────────────────────────────────────────────────

function BehaviorBar({ label, value, max, color = 'bg-neutral-900' }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[12px] text-neutral-500">{label}</span>
        <span className="text-[12px] font-semibold text-neutral-900 tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`} />
      </div>
    </div>
  )
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function Timeline({ orders, onUpdateStatus, updatingOrder }: {
  orders: Order[]; onUpdateStatus: (id: string, status: string) => void; updatingOrder: string | null
}) {
  const { t } = useT()
  const ORDER_STATUS_LABELS = getOrderStatusLabels(t)
  const sorted = [...orders].sort((a, b) => new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime())
  return (
    <div className="relative">
      <div className="absolute left-3.5 top-0 bottom-0 w-px bg-neutral-100" />
      <div className="space-y-3">
        {sorted.map((order, i) => {
          const isBad  = ['refused', 'cancelled', 'returned'].includes(order.order_status)
          const isGood = order.order_status === 'collected'
          const isActive = ['pending', 'processing', 'shipped'].includes(order.order_status)
          const icon = ORDER_STATUS_ICON[order.order_status] || '·'
          return (
            <motion.div key={order.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              className="flex items-start gap-3 pl-1">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 z-10 border
                ${isBad  ? 'bg-red-50 text-red-600 border-red-200'     :
                  isGood ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                           'bg-neutral-100 text-neutral-400 border-neutral-200'}`}>
                {icon}
              </div>
              <div className="flex-1 min-w-0 bg-neutral-50 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[12px] font-semibold text-neutral-900">#{order.order_number || order.external_order_id}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                      ${isBad  ? 'bg-red-100 text-red-700'     :
                        isGood ? 'bg-emerald-100 text-emerald-700' :
                                 'bg-neutral-200 text-neutral-600'}`}>
                      {ORDER_STATUS_LABELS[order.order_status] || order.order_status}
                    </span>
                  </div>
                  <span className="text-[12px] font-semibold text-neutral-700 tabular-nums shrink-0">{order.total_value} {order.currency}</span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-[11px] text-neutral-400">
                    {new Date(order.ordered_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {order.payment_method === 'cod' && (
                    <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full border border-amber-100">COD</span>
                  )}
                  {order.shipping_address && (
                    <span className="text-[11px] text-neutral-400 flex items-center gap-0.5 truncate max-w-[120px]">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{order.shipping_address.split(',')[0]}</span>
                    </span>
                  )}
                </div>
                {order.risk_flags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {order.risk_flags.slice(0, 3).map((flag: any, j: number) => (
                      <span key={j} className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full border border-red-100">{flag.label}</span>
                    ))}
                  </div>
                )}
                {isActive && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {[
                      { status: 'collected', label: t('risk.collected_btn'),  cls: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
                      { status: 'refused',   label: t('risk.refused_btn'),  cls: 'bg-red-600 hover:bg-red-700 text-white' },
                      { status: 'not_home',  label: t('risk.absent_btn'),   cls: 'bg-amber-100 hover:bg-amber-200 text-amber-800' },
                      { status: 'cancelled', label: t('risk.cancelled_btn'),   cls: 'bg-neutral-200 hover:bg-neutral-300 text-neutral-700' },
                    ].map(btn => (
                      <button key={btn.status} onClick={() => onUpdateStatus(order.id, btn.status)} disabled={updatingOrder === order.id}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all disabled:opacity-40 ${btn.cls}`}>
                        {btn.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Address Map ──────────────────────────────────────────────────────────────

function AddressMap({ orders }: { orders: Order[] }) {
  const { t } = useT()
  const addressCounts = orders.reduce<Record<string, { count: number; bad: number }>>((acc, o) => {
    if (!o.shipping_address) return acc
    const key = o.shipping_address
    if (!acc[key]) acc[key] = { count: 0, bad: 0 }
    acc[key].count++
    if (['refused', 'not_home', 'cancelled'].includes(o.order_status)) acc[key].bad++
    return acc
  }, {})
  const addresses = Object.entries(addressCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 6)
  if (addresses.length === 0) return (
    <div className="text-center py-8"><MapPin className="h-6 w-6 text-neutral-200 mx-auto mb-2" /><p className="text-[12px] text-neutral-400">{t('risk.no_address_registered')}</p></div>
  )
  return (
    <div className="space-y-2">
      {addresses.map(([addr, data], i) => (
        <div key={i} className="flex items-start gap-2.5 p-3 bg-neutral-50 rounded-xl">
          <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${data.bad > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
            <MapPin className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-neutral-700 font-medium">{addr}</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {t('risk.orders_count_label', { count: String(data.count) })} · {data.bad > 0 ? <span className="text-red-500">{t('risk.refusals_count', { count: String(data.bad) })}</span> : <span className="text-emerald-600">{t('risk.no_issues')}</span>}
            </p>
          </div>
          <div className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${data.bad > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>×{data.count}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Loss Calculator ──────────────────────────────────────────────────────────

function LossCalculator({ customer, orders }: { customer: Customer; orders: Order[] }) {
  const { t } = useT()
  const refused = orders.filter(o => o.order_status === 'refused')
  const totalLost = refused.reduce((s, o) => s + (o.total_value || 0), 0)
  const shippingCost = 15
  const totalShipping = (customer.orders_refused + customer.orders_not_home) * shippingCost
  const totalDamage = totalLost + totalShipping
  if (customer.orders_refused === 0 && customer.orders_not_home === 0) return null
  return (
    <Card className="p-4 bg-red-50 border-red-100">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="h-3.5 w-3.5 text-red-500" />
        <span className="text-[12px] font-semibold text-red-700">{t('risk.estimated_losses_title')}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><p className="text-xl font-black text-red-600">{totalLost.toFixed(0)}</p><p className="text-[10px] text-red-400">{t('risk.ron_refused')}</p></div>
        <div><p className="text-xl font-black text-orange-600">{totalShipping}</p><p className="text-[10px] text-orange-400">{t('risk.ron_shipping')}</p></div>
        <div><p className="text-xl font-black text-neutral-900">{totalDamage.toFixed(0)}</p><p className="text-[10px] text-neutral-500">{t('risk.ron_total')}</p></div>
      </div>
    </Card>
  )
}

// ─── Customer Badges ──────────────────────────────────────────────────────────

function CustomerBadges({ customer }: { customer: Customer }) {
  const { t } = useT()
  const rate = customer.total_orders > 0 ? (customer.orders_collected / customer.total_orders) * 100 : 100
  const badges = []
  if (customer.in_global_blacklist) badges.push({ label: 'Global Blacklist', icon: Globe, color: 'bg-red-600 text-white' })
  if (customer.in_local_blacklist)  badges.push({ label: 'Blacklist Local',  icon: Ban,    color: 'bg-neutral-900 text-white' })
  if (rate < 20 && customer.total_orders >= 5) badges.push({ label: 'Ghost Buyer', icon: UserX, color: 'bg-neutral-100 text-neutral-700 border border-neutral-200' })
  if (customer.orders_refused >= 5)            badges.push({ label: 'Serial Refuser', icon: TriangleAlert, color: 'bg-red-100 text-red-700 border border-red-200' })
  if (customer.total_orders >= 10 && rate >= 90) badges.push({ label: 'VIP Trusted', icon: Award, color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' })
  if (customer.manual_label_override)          badges.push({ label: 'Override Manual', icon: Pencil, color: 'bg-amber-100 text-amber-700 border border-amber-200' })
  if (customer.total_orders <= 1)              badges.push({ label: t('risk.first_order_badge'), icon: Sparkles, color: 'bg-neutral-100 text-neutral-600 border border-neutral-200' })
  if (badges.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b, i) => (
        <span key={i} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium ${b.color}`}>
          <b.icon className="h-3 w-3" />{b.label}
        </span>
      ))}
    </div>
  )
}

// ─── Cluster Tab ──────────────────────────────────────────────────────────────

function ClusterTab({ storeId, customers, onOpenProfile }: {
  storeId: string
  customers: Array<{ id: string; name: string | null; phone: string | null; risk_score: number; risk_label: string }>
  onOpenProfile: (id: string) => void
}) {
  const { t } = useT()
  const [loading, setLoading]         = useState(false)
  const [clusters, setClusters]       = useState<any[]>([])
  const [ran, setRan]                 = useState(false)
  const [candidates, setCandidates]   = useState<any[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(true)
  const [merging, setMerging]         = useState<string | null>(null)
  const [dismissing, setDismissing]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/risk/identity-candidates')
      .then(r => r.json())
      .then(d => setCandidates(d.candidates || []))
      .catch(() => {})
      .finally(() => setLoadingCandidates(false))
  }, [])

  const run = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/risk/cluster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store_id: storeId }) })
      const data = await res.json()
      setClusters(data.clusters || [])
      setRan(true)
    } catch {}
    setLoading(false)
  }

  const mergeCustomers = async (targetId: string, sourceId: string, candidateId: string) => {
    setMerging(candidateId)
    try {
      const res = await fetch('/api/risk/customers/merge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetId, source_id: sourceId }),
      })
      if (res.ok) setCandidates(prev => prev.filter(c => c.id !== candidateId))
    } catch {}
    setMerging(null)
  }

  const dismissCandidate = async (candidateId: string) => {
    setDismissing(candidateId)
    try {
      await fetch('/api/risk/identity-candidates', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: candidateId, status: 'not_duplicate' }),
      })
      setCandidates(prev => prev.filter(c => c.id !== candidateId))
    } catch {}
    setDismissing(null)
  }

  return (
    <div className="space-y-5">

      {/* ── Possible Duplicates ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="h-4 w-4 text-amber-500" />
          <p className="text-[13px] font-semibold text-neutral-900">{t('risk.possible_duplicates')}</p>
          {candidates.length > 0 && (
            <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center">
              {candidates.length}
            </span>
          )}
        </div>
        <p className="text-[12px] text-neutral-400 mb-3">{t('risk.possible_duplicates_desc')}</p>

        {loadingCandidates && (
          <div className="flex items-center gap-2 py-4 text-[12px] text-neutral-400">
            <div className="h-4 w-4 border-2 border-neutral-200 border-t-neutral-500 rounded-full animate-spin" />
            {t('common.loading')}
          </div>
        )}

        {!loadingCandidates && candidates.length === 0 && (
          <div className="border border-neutral-100 rounded-xl p-4 text-center bg-neutral-50">
            <CheckCircle2 className="h-5 w-5 text-neutral-300 mx-auto mb-1.5" />
            <p className="text-[12px] text-neutral-400">{t('risk.no_duplicates_pending')}</p>
          </div>
        )}

        {candidates.length > 0 && (
          <div className="space-y-3">
            {candidates.map((c: any) => {
              const a = c.customer_a, b = c.customer_b
              const pct = Math.round(c.confidence * 100)
              const isBusy = merging === c.id || dismissing === c.id
              return (
                <Card key={c.id} className="p-4 border-amber-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        {pct}% {t('risk.similarity')}
                      </span>
                      {c.match_reasons?.length > 0 && (
                        <span className="text-[11px] text-neutral-400">
                          {c.match_reasons.slice(0, 2).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[a, b].map((cust: any, idx: number) => cust ? (
                      <button key={idx} onClick={() => onOpenProfile(cust.id)}
                        className="text-left p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 transition-colors">
                        <p className="text-[12px] font-medium text-neutral-900 truncate">{cust.name || '—'}</p>
                        <p className="text-[11px] text-neutral-400 truncate">{cust.phone || cust.email || '—'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-neutral-500">{t('risk.orders_label')}: {cust.total_orders}</span>
                          {cust.orders_refused > 0 && (
                            <span className="text-[11px] text-red-500">{cust.orders_refused} {t('risk.refused')}</span>
                          )}
                        </div>
                      </button>
                    ) : null)}
                  </div>

                  <div className="flex gap-2">
                    <Btn size="sm" onClick={() => mergeCustomers(a.id, b.id, c.id)} disabled={isBusy}>
                      {merging === c.id
                        ? <RefreshCw className="h-3 w-3 animate-spin" />
                        : <GitMerge className="h-3 w-3" />}
                      {t('risk.merge_into_first')}
                    </Btn>
                    <Btn size="sm" variant="outline" onClick={() => dismissCandidate(c.id)} disabled={isBusy}>
                      {dismissing === c.id
                        ? <RefreshCw className="h-3 w-3 animate-spin" />
                        : <X className="h-3 w-3" />}
                      {t('risk.not_same_person')}
                    </Btn>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-neutral-100" />

      {/* ── Multi-Identity Cluster Analysis ──────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-neutral-900">{t('risk.multi_identity')}</p>
          <p className="text-[12px] text-neutral-400 mt-0.5">{t('risk.multi_identity_desc')}</p>
        </div>
        <Btn onClick={run} disabled={loading}>
          <Layers className={`h-3.5 w-3.5 ${loading ? 'animate-pulse' : ''}`} />
          {loading ? t('risk.analyzing_btn') : t('risk.run_analysis_btn')}
        </Btn>
      </div>

      {!ran && !loading && (
        <div className="border-2 border-dashed border-neutral-200 rounded-xl p-8 text-center">
          <Network className="h-8 w-8 text-neutral-200 mx-auto mb-3" />
          <p className="text-[13px] font-medium text-neutral-600 mb-1">{t('risk.clustering_analysis')}</p>
          <p className="text-[12px] text-neutral-400 mb-4 max-w-xs mx-auto">
            {t('risk.algorithm_desc')}
          </p>
          <Btn onClick={run}>{t('risk.start_analysis')}</Btn>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center py-16 gap-3">
          <div className="h-7 w-7 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-[12px] text-neutral-400">{t('risk.processing_customers_count', { count: String(customers.length) })}</p>
        </div>
      )}

      {ran && !loading && clusters.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle2 className="h-8 w-8 text-neutral-200 mx-auto mb-3" />
          <p className="text-[13px] font-medium text-neutral-600">{t('risk.no_cluster')}</p>
          <p className="text-[12px] text-neutral-400 mt-1">{t('risk.no_multi_identity')}</p>
        </div>
      )}

      {clusters.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] text-neutral-400">{t('risk.similar_groups_detected', { count: String(clusters.length) })}</p>
          {clusters.map((cluster, i) => (
            <Card key={i} className={`p-4 ${cluster.riskLevel === 'high' ? 'border-red-200' : 'border-amber-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${cluster.riskLevel === 'high' ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <span className="text-[13px] font-semibold text-neutral-900">{t('risk.similar_identities_count', { count: String(cluster.memberCount) })}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                  <span className="text-red-600 font-semibold">{t('risk.refusals_count', { count: String(cluster.combinedRefusals) })}</span>
                  <span>·</span><span>{t('risk.score_max')}: {cluster.maxRiskScore}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                {cluster.members.map((m: any) => (
                  <div key={m.id} onClick={() => onOpenProfile(m.id)}
                    className="flex items-center gap-3 p-2 rounded-xl bg-neutral-50 hover:bg-neutral-100 cursor-pointer">
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-[12px] font-bold shrink-0
                      ${m.risk_label === 'blocked' ? 'bg-red-600 text-white' : m.risk_label === 'problematic' ? 'bg-orange-500 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                      {(m.name || m.phone || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-neutral-900 truncate">{m.name || '—'}</p>
                      <p className="text-[11px] text-neutral-400 truncate">{m.phone || m.email || m.id.slice(0, 8)}</p>
                    </div>
                    <span className="text-[12px] font-semibold text-neutral-700 tabular-nums">{m.risk_score}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ settings, mlAccuracy, mlTotalPredictions, savingSettings, onSave }: {
  settings: any; mlAccuracy: number | null; mlTotalPredictions: number
  savingSettings: boolean; onSave: (updates: any) => Promise<void>
}) {
  const { t } = useT()
  const [local, setLocal] = useState<any>(settings || {})
  const [webhookStatus, setWebhookStatus] = useState<any>(null)
  const [checkingWebhook, setCheckingWebhook] = useState(false)
  const [registeringWebhook, setRegisteringWebhook] = useState(false)

  const checkWebhooks = async () => {
    setCheckingWebhook(true)
    try {
      const res = await fetch('/api/risk/setup-webhooks')
      if (res.ok) setWebhookStatus(await res.json())
    } catch {}
    setCheckingWebhook(false)
  }

  const registerWebhooks = async () => {
    setRegisteringWebhook(true)
    try {
      const res = await fetch('/api/risk/setup-webhooks', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setWebhookStatus({ allActive: data.success, ...data })
        await checkWebhooks()
      }
    } catch {}
    setRegisteringWebhook(false)
  }

  useEffect(() => { checkWebhooks() }, [])
  if (settings && JSON.stringify(settings) !== JSON.stringify(local) && Object.keys(local).length < 5) setLocal(settings)
  const set = (key: string, val: any) => setLocal((prev: any) => ({ ...prev, [key]: val }))

  if (!settings) return (
    <div className="flex items-center justify-center py-16">
      <div className="h-6 w-6 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
    </div>
  )

  function Toggle({ k }: { k: string }) {
    return (
      <button onClick={() => set(k, !local[k])}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${local[k] ? 'bg-neutral-900' : 'bg-neutral-200'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${local[k] ? 'left-5' : 'left-0.5'}`} />
      </button>
    )
  }

  function Inp({ k, type = 'text', min, max, placeholder }: { k: string; type?: string; min?: number; max?: number; placeholder?: string }) {
  const { t } = useT()
    return (
      <input type={type} min={min} max={max} placeholder={placeholder} value={local[k] || ''}
        onChange={e => set(k, type === 'number' ? parseInt(e.target.value) : e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-[13px] focus:outline-none focus:border-neutral-400 bg-white" />
    )
  }

  return (
    <div className="space-y-4 max-w-2xl">

      {/* Webhooks Real-Time */}
      <Card className="p-5">
        <SectionLabel>{t('risk.webhook_setup')}</SectionLabel>
        <p className="text-[12px] text-neutral-400 mb-3">{t('risk.webhook_desc')}</p>
        {webhookStatus ? (
          <div className="space-y-2 mb-3">
            {(['order.created', 'order.updated'] as const).map(topic => {
              const wh = topic === 'order.created' ? webhookStatus.orderCreated : webhookStatus.orderUpdated
              const active = wh?.status === 'active'
              return (
                <div key={topic} className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${active ? 'bg-green-500' : 'bg-red-400'}`} />
                    <span className="text-[13px] text-neutral-700 font-mono">{topic}</span>
                  </div>
                  <span className={`text-[11px] font-medium ${active ? 'text-green-600' : 'text-red-500'}`}>
                    {active ? t('risk.webhook_active') : t('risk.webhook_inactive')}
                    {wh?.id ? ` (#${wh.id})` : ''}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="h-12 flex items-center">
            <div className="h-4 w-4 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
          </div>
        )}
        <div className="flex gap-2">
          <Btn variant="outline" size="sm" onClick={checkWebhooks} disabled={checkingWebhook}>
            {checkingWebhook ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {t('risk.webhook_check')}
          </Btn>
          <Btn size="sm" onClick={registerWebhooks} disabled={registeringWebhook || webhookStatus?.allActive}>
            {registeringWebhook
              ? <><RefreshCw className="h-3 w-3 animate-spin" /> {t('common.loading')}</>
              : webhookStatus?.allActive
                ? <><Check className="h-3 w-3" /> {t('risk.webhook_all_active')}</>
                : <>{t('risk.webhook_register')}</>
            }
          </Btn>
        </div>
      </Card>

      {/* Notificări */}
      <Card className="p-5">
        <SectionLabel>{t('risk.email_notifications')}</SectionLabel>
        <div className="space-y-3">
          <div>
            <label className="text-[12px] text-neutral-500 mb-1 block">{t('risk.email_alerts_label')}</label>
            <Inp k="alert_email" type="email" placeholder="email@magazin.ro" />
          </div>
          {[
            { key: 'email_alerts_enabled',   label: t('risk.alert_per_order') },
            { key: 'alert_on_blocked',        label: t('risk.alert_blocked') },
            { key: 'alert_on_problematic',    label: t('risk.alert_problematic') },
            { key: 'alert_on_watch',          label: t('risk.alert_watch') },
            { key: 'weekly_report_enabled',   label: t('risk.weekly_report_mon') },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0">
              <span className="text-[13px] text-neutral-700">{item.label}</span>
              <Toggle k={item.key} />
            </div>
          ))}
        </div>
      </Card>

      {/* Praguri scor */}
      <Card className="p-5">
        <SectionLabel>{t('risk.risk_thresholds')}</SectionLabel>
        <div className="space-y-4 mt-3">
          {[
            { key: 'score_watch_threshold',        label: t('risk.watch_threshold'),        color: 'text-amber-600' },
            { key: 'score_problematic_threshold',  label: t('risk.threshold_problematic'),  color: 'text-orange-600' },
            { key: 'score_blocked_threshold',      label: t('risk.threshold_blocked'),       color: 'text-red-600' },
          ].map(item => (
            <div key={item.key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-neutral-500">{item.label}</span>
                <span className={`text-[13px] font-bold tabular-nums ${item.color}`}>{local[item.key]}</span>
              </div>
              <input type="range" min={20} max={95} step={1} value={local[item.key] || 50}
                onChange={e => set(item.key, parseInt(e.target.value))} className="w-full accent-neutral-900" />
            </div>
          ))}
        </div>
      </Card>

      {/* Reguli detecție */}
      <Card className="p-5">
        <SectionLabel>{t('risk.detection_rules')}</SectionLabel>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: 'max_orders_per_day',       label: t('risk.max_orders_per_day'),              type: 'number', min: 1, max: 20 },
              { k: 'min_collection_rate_pct',  label: t('risk.min_collection_rate'),        type: 'number', min: 10, max: 100 },
              { k: 'flag_high_value_cod_ron',  label: t('risk.high_cod_threshold'),  type: 'number', min: 100 },
              { k: 'flag_new_account_days',    label: t('risk.new_account_days'),              type: 'number', min: 0, max: 30 },
            ].map(f => (
              <div key={f.k}>
                <label className="text-[11px] text-neutral-400 mb-1 block">{f.label}</label>
                <Inp k={f.k} type={f.type} min={f.min} max={f.max} />
              </div>
            ))}
          </div>
          {[
            { key: 'flag_night_orders',                    label: t('risk.detect_night_orders') },
            { key: 'flag_temp_email',                      label: t('risk.detect_temp_email') },
            { key: 'participate_in_global_blacklist',      label: t('risk.participate_blacklist') },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0">
              <span className="text-[13px] text-neutral-700">{item.label}</span>
              <Toggle k={item.key} />
            </div>
          ))}
        </div>
      </Card>

      {/* ML Model */}
      <Card className="p-5">
        <SectionLabel>{t('risk.adaptive_scoring_ml')}</SectionLabel>
        <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-xl mb-3">
          <div className="h-14 w-14 rounded-xl bg-neutral-900 flex items-center justify-center shrink-0">
            <span className="text-white text-lg font-black tabular-nums">{mlAccuracy !== null ? `${mlAccuracy}%` : '—'}</span>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-neutral-900">{t('risk.model_accuracy')}</p>
            <p className="text-[12px] text-neutral-400 mt-0.5">{t('risk.predictions_processed', { count: String(mlTotalPredictions) })}</p>
            {mlTotalPredictions < 20 && (
              <p className="text-[11px] text-amber-500 mt-1">{t('risk.model_calibrating')}</p>
            )}
          </div>
        </div>
        <p className="text-[12px] text-neutral-400 leading-relaxed">
          {t('risk.ml_model_desc')}
        </p>
      </Card>

      {/* Costuri transport */}
      <Card className="p-5">
        <SectionLabel>{t('risk.transport_costs_title')}</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-neutral-400 mb-1 block">{t('risk.delivery_cost_ron')}</label>
            <Inp k="shipping_cost_ron" type="number" min={0} />
          </div>
          <div>
            <label className="text-[11px] text-neutral-400 mb-1 block">{t('risk.return_cost_ron')}</label>
            <Inp k="return_shipping_cost_ron" type="number" min={0} />
          </div>
        </div>
      </Card>

      <Btn onClick={() => onSave(local)} disabled={savingSettings} className="w-full justify-center py-3 h-auto text-[13px]">
        {savingSettings ? t('common.saving') : t('common.save_settings')}
      </Btn>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}z`
  return `${Math.floor(d / 30)}l`
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RiskShieldPage() {
  const { t } = useT()
  const [stores, setStores]                     = useState<Store[]>([])
  const [selectedStore, setSelectedStore]       = useState<string>('')
  const [customers, setCustomers]               = useState<Customer[]>([])
  const [alerts, setAlerts]                     = useState<Alert[]>([])
  const [stats, setStats]                       = useState<Record<string, number>>({})
  const [loading, setLoading]                   = useState(true)
  const [labelFilter, setLabelFilter]           = useState('all')
  const [search, setSearch]                     = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerOrders, setCustomerOrders]     = useState<Order[]>([])
  const [showProfile, setShowProfile]           = useState(false)
  const [activeTab, setActiveTab]               = useState<'customers' | 'alerts' | 'financial' | 'heatmap' | 'clusters' | 'analytics' | 'settings'>('customers')
  const [profileTab, setProfileTab]             = useState<'overview' | 'timeline' | 'addresses' | '360'>('overview')
  const [unreadAlerts, setUnreadAlerts]         = useState(0)
  const [editNote, setEditNote]                 = useState('')
  const [savingNote, setSavingNote]             = useState(false)
  const [noteSaved, setNoteSaved]               = useState(false)
  const [importingHistory, setImportingHistory] = useState(false)
  const [updatingOrder, setUpdatingOrder]       = useState<string | null>(null)
  const [financialData, setFinancialData]       = useState<FinancialData | null>(null)
  const [financialPeriod, setFinancialPeriod]   = useState(30)
  const [loadingFinancial, setLoadingFinancial] = useState(false)
  const [heatmapData, setHeatmapData]           = useState<HeatmapPoint[]>([])
  const [nationalRefusalRate, setNationalRefusalRate] = useState(0)
  const [loadingHeatmap, setLoadingHeatmap]     = useState(false)
  const [clusterMatches, setClusterMatches]     = useState<ClusterMatch[]>([])
  const [loadingCluster, setLoadingCluster]     = useState(false)
  const [mlAccuracy, setMlAccuracy]             = useState<number | null>(null)
  const [mlTotalPredictions, setMlTotalPredictions] = useState(0)
  const [storeSettings, setStoreSettings]       = useState<any>(null)
  const [savingSettings, setSavingSettings]     = useState(false)
  const [syncingAll, setSyncingAll]             = useState(false)
  const [syncProgress, setSyncProgress]         = useState<any>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { fetchStores() }, [])
  useEffect(() => { if (selectedStore) { fetchCustomers(selectedStore); fetchAlerts(selectedStore) } }, [selectedStore, labelFilter])
  useEffect(() => {
    if (!selectedStore) return
    if (activeTab === 'financial' && !financialData) fetchFinancial()
    if (activeTab === 'heatmap' && heatmapData.length === 0) fetchHeatmap()
    if (activeTab === 'settings' && !storeSettings) fetchStoreSettings()
    if (activeTab === 'analytics') fetchMLStats()
  }, [activeTab, selectedStore])
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => { if (selectedStore) fetchCustomers(selectedStore) }, 350)
    return () => { if (searchRef.current) clearTimeout(searchRef.current) }
  }, [search])

  async function fetchStores() {
    try {
      const res = await fetch('/api/stores'); const data = await res.json()
      const store = data.store || data.stores?.[0] || null
      const list = store ? [store] : []
      setStores(list)
      if (list.length > 0) setSelectedStore(list[0].id)
      else setLoading(false)
    } catch { setLoading(false) }
  }

  async function fetchCustomers(sid?: string) {
    const storeId = sid || selectedStore; if (!storeId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ store_id: storeId, limit: '200' })
      if (labelFilter !== 'all') params.set('label', labelFilter)
      if (search) params.set('search', search)
      const res = await fetch(`/api/risk/customers?${params}`)
      const data = await res.json()
      setCustomers(data.customers || []); setStats(data.stats || {})
      if (data.unreadAlerts !== undefined) setUnreadAlerts(data.unreadAlerts)
    } catch {} finally { setLoading(false) }
  }

  async function fetchAlerts(sid?: string) {
    const storeId = sid || selectedStore; if (!storeId) return
    try {
      const res = await fetch(`/api/risk/alerts?store_id=${storeId}&limit=100`); const data = await res.json()
      setAlerts(data.alerts || []); setUnreadAlerts(data.unread || 0)
    } catch {}
  }

  async function openProfile(customer: Customer) {
    setSelectedCustomer(customer); setEditNote(customer.operator_notes || ''); setProfileTab('overview'); setShowProfile(true)
    try {
      const res = await fetch(`/api/risk/orders?store_id=${selectedStore}&customer_id=${customer.id}&limit=50`)
      const data = await res.json(); setCustomerOrders(data.orders || [])
    } catch { setCustomerOrders([]) }
  }

  async function syncAll() {
    if (syncingAll) return
    setSyncingAll(true); setSyncProgress({ stage: 'init', message: t('risk.connecting_woocommerce') })
    try {
      const evtSource = new EventSource('/api/risk/sync-all')
      evtSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data); setSyncProgress(data)
          if (data.stage === 'done' || data.stage === 'error') {
            evtSource.close()
            if (data.stage === 'done') {
              fetch('/api/risk/repair', { method: 'POST' }).catch(() => {})
              fetch('/api/cron/risk-sync-orders?manual=true').catch(() => {})
              fetchCustomers(selectedStore); fetchAlerts(selectedStore)
            }
            setSyncingAll(false)
          }
        } catch {}
      }
      evtSource.onerror = () => { evtSource.close(); setSyncingAll(false); setSyncProgress({ stage: 'error', message: t('risk.connection_interrupted') }) }
    } catch { setSyncingAll(false); setSyncProgress({ stage: 'error', message: t('risk.error_start') }) }
  }

  async function saveNote() {
    if (!selectedCustomer) return
    setSavingNote(true)
    try {
      const res = await fetch('/api/risk/customers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: selectedCustomer.id, operator_notes: editNote }) })
      if (res.ok) {
        setSelectedCustomer({ ...selectedCustomer, operator_notes: editNote })
        setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, operator_notes: editNote } : c))
        setNoteSaved(true); setTimeout(() => setNoteSaved(false), 2500)
      }
    } catch {} finally { setSavingNote(false) }
  }

  async function importHistory() {
    if (!selectedCustomer) return
    setImportingHistory(true)
    try {
      const res = await fetch('/api/risk/import-history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: selectedCustomer.id }) })
      const data = await res.json()
      if (data.ok) {
        const ordersRes = await fetch(`/api/risk/orders?store_id=${selectedStore}&customer_id=${selectedCustomer.id}&limit=100`)
        const ordersData = await ordersRes.json(); setCustomerOrders(ordersData.orders || [])
        setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, risk_score: data.new_score, risk_label: data.new_label, total_orders: ordersData.orders?.length || c.total_orders } : c))
        alert(t('risk.import_complete', { found: String(data.total_in_woocommerce), imported: String(data.imported) }))
      } else { alert(t('risk.import_error', { error: data.error || '?' })) }
    } catch { alert(t('risk.import_error_generic')) } finally { setImportingHistory(false) }
  }

  async function overrideLabel(customerId: string, label: string | null) {
    await fetch('/api/risk/customers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: customerId, label_override: label }) })
    if (label === null) {
      await fetchCustomers(selectedStore)
      if (selectedCustomer?.id === customerId) {
        const res = await fetch(`/api/risk/customers?store_id=${selectedStore}&limit=200`); const data = await res.json()
        const updated = (data.customers || []).find((c: any) => c.id === customerId)
        if (updated) setSelectedCustomer(updated)
      }
    } else {
      setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, risk_label: label as any, manual_label_override: label } : c))
      if (selectedCustomer?.id === customerId) setSelectedCustomer(prev => prev ? { ...prev, risk_label: label as any, manual_label_override: label } : null)
    }
  }

  async function fetchFinancial(period?: number) {
    const p = period || financialPeriod; setLoadingFinancial(true)
    try {
      const res = await fetch(`/api/risk/financial?store_id=${selectedStore}&period=${p}`); const data = await res.json(); setFinancialData(data)
    } catch {} finally { setLoadingFinancial(false) }
  }

  async function fetchHeatmap() {
    setLoadingHeatmap(true)
    try {
      const res = await fetch(`/api/risk/heatmap?store_id=${selectedStore}&period=90`); const data = await res.json()
      setHeatmapData(data.heatmap || []); setNationalRefusalRate(data.nationalRefusalRate || 0)
    } catch {} finally { setLoadingHeatmap(false) }
  }

  async function fetchClusterForCustomer(customerId: string) {
    setLoadingCluster(true)
    try {
      const res = await fetch(`/api/risk/cluster?customer_id=${customerId}&store_id=${selectedStore}`); const data = await res.json(); setClusterMatches(data.matches || [])
    } catch {} finally { setLoadingCluster(false) }
  }

  async function fetchMLStats() {
    try {
      const res = await fetch(`/api/risk/ml-calibrate?store_id=${selectedStore}`); const data = await res.json()
      setMlAccuracy(data.accuracy); setMlTotalPredictions(data.totalPredictions || 0)
    } catch {}
  }

  async function fetchStoreSettings() {
    try {
      const res = await fetch(`/api/risk/store-settings?store_id=${selectedStore}`); const data = await res.json()
      setStoreSettings(data.settings); setMlAccuracy(data.mlAccuracy); setMlTotalPredictions(data.mlTotalPredictions || 0)
    } catch {}
  }

  async function saveStoreSettings(updates: any) {
    setSavingSettings(true)
    try {
      await fetch('/api/risk/store-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store_id: selectedStore, ...updates }) })
      setStoreSettings((prev: any) => ({ ...prev, ...updates }))
    } catch {} finally { setSavingSettings(false) }
  }

  async function updateOrderStatus(orderId: string, status: string) {
    setUpdatingOrder(orderId)
    await fetch('/api/risk/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: orderId, order_status: status }) })
    setCustomerOrders(prev => prev.map(o => o.id === orderId ? { ...o, order_status: status } : o))
    setUpdatingOrder(null); fetchCustomers()
  }

  async function toggleBlacklist(value: boolean) {
    if (!selectedCustomer) return
    await fetch('/api/risk/customers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: selectedCustomer.id, in_local_blacklist: value }) })
    setSelectedCustomer(prev => prev ? { ...prev, in_local_blacklist: value } : null)
    setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, in_local_blacklist: value } : c))
  }

  async function markAllAlertsRead() {
    await fetch('/api/risk/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mark_all_read: true }) })
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true }))); setUnreadAlerts(0)
  }

  const collectionRate = (c: Customer) => c.total_orders === 0 ? null : Math.round((c.orders_collected / c.total_orders) * 100)
  const totalCustomers = Object.values(stats).reduce((s, v) => s + v, 0)
  const totalOrders    = customers.reduce((s, c) => s + (c.total_orders || 0), 0)
  const totalCollected = customers.reduce((s, c) => s + (c.orders_collected || 0), 0)
  const totalRefused   = customers.reduce((s, c) => s + (c.orders_refused || 0), 0)
  const totalNotHome   = customers.reduce((s, c) => s + (c.orders_not_home || 0), 0)
  const globalCollectionRate = totalOrders > 0 ? Math.round((totalCollected / totalOrders) * 100) : 0
  const globalRefusalRate    = totalOrders > 0 ? Math.round(((totalRefused + totalNotHome) / totalOrders) * 100) : 0
  const activeAlerts = alerts.filter(a => !a.is_resolved).length
  const riskRate     = totalCustomers > 0 ? Math.round(((stats.blocked || 0) + (stats.problematic || 0)) / totalCustomers * 100) : 0

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight">{t('risk.title')}</h1>
          <p className="text-[13px] text-neutral-400 mt-0.5">{t('risk.protection_desc')}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {stores.length > 1 && (
            <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)}
              className="h-9 px-3 rounded-xl border border-neutral-200 text-[12px] text-neutral-700 bg-white focus:outline-none">
              {stores.map(s => <option key={s.id} value={s.id}>{s.store_url}</option>)}
            </select>
          )}
          <Btn variant="outline" onClick={() => { fetchCustomers(); fetchAlerts() }}>
            <RefreshCw className="h-3.5 w-3.5" />{t('risk.refresh_btn')}
          </Btn>
          <Btn variant="outline" onClick={() => window.location.href = '/settings?tab=plugin'}>
            <Download className="h-3.5 w-3.5" />{t('risk.woo_plugin_btn')}
          </Btn>
          <Btn onClick={syncAll} disabled={syncingAll}>
            <RefreshCw className={`h-3.5 w-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
            {syncingAll ? t('common.syncing') : t('risk.sync_woo')}
          </Btn>
        </div>
      </div>

      {/* Sync Progress */}
      {syncProgress && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className={`rounded-xl border p-4 ${syncProgress.stage === 'error' ? 'bg-red-50 border-red-100' : syncProgress.stage === 'done' ? 'bg-emerald-50 border-emerald-100' : 'bg-neutral-50 border-neutral-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {syncProgress.stage === 'error'  ? <AlertCircle className="h-4 w-4 text-red-500" /> :
               syncProgress.stage === 'done'   ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> :
               <RefreshCw className="h-4 w-4 text-neutral-500 animate-spin" />}
              <span className={`text-[13px] font-medium ${syncProgress.stage === 'error' ? 'text-red-700' : syncProgress.stage === 'done' ? 'text-emerald-800' : 'text-neutral-700'}`}>
                {syncProgress.message || t('risk.processing_msg')}
              </span>
            </div>
            {(syncProgress.stage === 'done' || syncProgress.stage === 'error') && (
              <button onClick={() => setSyncProgress(null)} className="text-[11px] text-neutral-400 hover:text-neutral-600">✕</button>
            )}
          </div>
          {syncProgress.totalPages > 0 && syncProgress.page && !['done', 'error'].includes(syncProgress.stage) && (
            <div className="h-1 bg-neutral-200 rounded-full mt-2">
              <div className="h-full bg-neutral-900 rounded-full transition-all"
                style={{ width: `${Math.round((syncProgress.page / syncProgress.totalPages) * 100)}%` }} />
            </div>
          )}
          <div className="flex flex-wrap gap-3 text-[11px] text-neutral-400 mt-1.5">
            {syncProgress.custCreated !== undefined && <span>{syncProgress.custCreated} {t('risk.new_customers')}</span>}
            {syncProgress.ordInserted !== undefined && <span>{t('risk.orders_imported', { count: String(syncProgress.ordInserted) })}</span>}
          </div>
        </motion.div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { key: 'all',          label: t('risk.tab_total'),        value: totalCustomers,       color: 'text-neutral-900' },
          { key: 'blocked',      label: t('risk.blocked_label'),      value: stats.blocked || 0,   color: 'text-red-600' },
          { key: 'problematic',  label: t('risk.tab_problematic'), value: stats.problematic||0, color: 'text-orange-600' },
          { key: 'watch',        label: t('risk.tab_watch'),        value: stats.watch || 0,     color: 'text-amber-600' },
          { key: 'new',          label: t('risk.tab_new'),          value: stats.new || 0,       color: 'text-neutral-600' },
          { key: 'trusted',      label: t('risk.tab_trusted'),      value: stats.trusted || 0,   color: 'text-emerald-600' },
        ].map((s, i) => {
          const isActive = labelFilter === s.key && activeTab === 'customers'
          return (
            <motion.button key={s.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => { setLabelFilter(s.key); setActiveTab('customers') }}
              className={`p-3.5 rounded-xl border text-left transition-all
                ${isActive ? 'bg-neutral-900 border-neutral-900' : 'bg-white border-neutral-200 hover:border-neutral-300'}`}>
              <p className={`text-xl font-bold tabular-nums ${isActive ? 'text-white' : s.color}`}>{s.value}</p>
              <p className={`text-[10px] mt-0.5 uppercase tracking-wide ${isActive ? 'text-neutral-400' : 'text-neutral-400'}`}>{s.label}</p>
            </motion.button>
          )
        })}
      </div>

      {/* Tab Nav */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {[
          { key: 'customers',  label: t('risk.customers_tab'),   icon: Users      },
          { key: 'alerts',     label: t('risk.alerts'),    icon: Bell,  badge: unreadAlerts },
          { key: 'financial',  label: t('risk.tab_financial'), icon: DollarSign },
          { key: 'heatmap',    label: t('risk.tab_heatmap'),   icon: MapPin     },
          { key: 'clusters',   label: t('risk.tab_clusters'),  icon: Network    },
          { key: 'analytics',  label: t('risk.tab_analytics'), icon: BarChart3  },
          { key: 'settings',   label: t('risk.settings_tab_label'),    icon: Settings   },
        ].map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-[12px] font-medium transition-all whitespace-nowrap shrink-0
                ${activeTab === tab.key ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'}`}>
              <Icon className="h-3.5 w-3.5 shrink-0" />{tab.label}
              {(tab as any).badge ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold min-w-[16px] text-center">{(tab as any).badge}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* ═══ CUSTOMERS ═══ */}
      {activeTab === 'customers' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-300" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('risk.search_placeholder_risk')}
              className="w-full pl-10 pr-4 h-9 rounded-xl border border-neutral-200 text-[13px] focus:outline-none focus:border-neutral-400 bg-white" />
          </div>

          <Card className="overflow-hidden">
            {loading ? (
              <div className="p-4 space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-neutral-50 rounded-xl animate-pulse" />)}</div>
            ) : customers.length === 0 ? (
              <div className="py-16 text-center">
                <Shield className="h-8 w-8 text-neutral-200 mx-auto mb-3" />
                <p className="text-[13px] text-neutral-400">{t('risk.no_customer_found')}</p>
                <p className="text-[12px] text-neutral-300 mt-1">{t('risk.customers_appear')}</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-50">
                {/* Header - hidden on mobile */}
                <div className="hidden sm:grid px-4 py-2.5 grid-cols-12 gap-3 text-[10px] font-medium text-neutral-400 uppercase tracking-wide bg-neutral-50">
                  <div className="col-span-5">{t('risk.col_customer')}</div>
                  <div className="col-span-3">{t('risk.col_risk')}</div>
                  <div className="col-span-2 hidden lg:block">{t('risk.col_score')}</div>
                  <div className="col-span-2">{t('risk.orders')}</div>
                </div>
                {customers.map((customer, i) => {
                  const rate = collectionRate(customer)
                  return (
                    <motion.div key={customer.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.015 }}
                      onClick={() => openProfile(customer)}
                      className="cursor-pointer hover:bg-neutral-50 transition-colors">
                      {/* Mobile layout */}
                      <div className="sm:hidden flex items-center gap-3 px-4 py-3">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-[13px] shrink-0
                          ${customer.risk_label === 'blocked'     ? 'bg-red-600 text-white' :
                            customer.risk_label === 'problematic' ? 'bg-orange-500 text-white' :
                            customer.risk_label === 'watch'       ? 'bg-amber-400 text-amber-900' :
                            customer.risk_label === 'trusted'     ? 'bg-emerald-100 text-emerald-700' :
                            'bg-neutral-100 text-neutral-600'}`}>
                          {(customer.name || customer.email || customer.phone || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-neutral-900 truncate">{customer.name || '—'}</p>
                          <p className="text-[11px] text-neutral-400 truncate">{customer.phone || customer.email || '—'}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <RiskBadge label={customer.risk_label} />
                          <span className="text-[11px] text-neutral-400 tabular-nums">{customer.total_orders} cmz</span>
                        </div>
                      </div>
                      {/* Desktop layout */}
                      <div className="hidden sm:grid px-4 py-3 grid-cols-12 gap-3 items-center">
                        <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                          <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-[13px] shrink-0
                            ${customer.risk_label === 'blocked'     ? 'bg-red-600 text-white' :
                              customer.risk_label === 'problematic' ? 'bg-orange-500 text-white' :
                              customer.risk_label === 'watch'       ? 'bg-amber-400 text-amber-900' :
                              customer.risk_label === 'trusted'     ? 'bg-emerald-100 text-emerald-700' :
                              'bg-neutral-100 text-neutral-600'}`}>
                            {(customer.name || customer.email || customer.phone || '?')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-neutral-900 truncate">{customer.name || '—'}</p>
                            <p className="text-[11px] text-neutral-400 truncate">{customer.phone || customer.email || '—'}</p>
                          </div>
                          {(customer.in_local_blacklist || customer.in_global_blacklist) && (
                            <Ban className="h-3.5 w-3.5 text-red-400 shrink-0" />
                          )}
                        </div>
                        <div className="col-span-3"><RiskBadge label={customer.risk_label} /></div>
                        <div className="col-span-2 hidden lg:block">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-14 bg-neutral-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${customer.risk_score >= 81 ? 'bg-red-500' : customer.risk_score >= 61 ? 'bg-orange-400' : customer.risk_score >= 41 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                style={{ width: `${customer.risk_score}%` }} />
                            </div>
                            <span className="text-[11px] text-neutral-400 tabular-nums">{customer.risk_score}</span>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[13px] font-semibold text-neutral-900 tabular-nums">{customer.total_orders}</span>
                          <span className="text-[10px] text-neutral-300 ml-1">cmz</span>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ═══ ALERTS ═══ */}
      {activeTab === 'alerts' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-[12px] text-neutral-400">{t('risk.alerts_count', { total: String(alerts.length), unread: String(unreadAlerts) })}</p>
            {unreadAlerts > 0 && (
              <Btn variant="outline" size="sm" onClick={markAllAlertsRead}>
                <Check className="h-3 w-3" />{t('risk.mark_all_read_btn')}
              </Btn>
            )}
          </div>
          <Card className="overflow-hidden">
            {alerts.length === 0 ? (
              <div className="py-16 text-center">
                <BellOff className="h-7 w-7 text-neutral-200 mx-auto mb-2" />
                <p className="text-[13px] text-neutral-400">{t('risk.no_active_alerts')}</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-50">
                {alerts.map((alert, i) => (
                  <motion.div key={alert.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className={`flex items-start gap-3 px-4 py-3.5 hover:bg-neutral-50 transition-colors ${!alert.is_read ? 'bg-amber-50/20' : ''}`}>
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0
                      ${alert.severity === 'critical' ? 'bg-red-600' : alert.severity === 'warning' ? 'bg-amber-100' : 'bg-neutral-100'}`}>
                      {alert.severity === 'critical' ? <Ban className="h-3.5 w-3.5 text-white" /> :
                       alert.severity === 'warning'  ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> :
                       <AlertCircle className="h-3.5 w-3.5 text-neutral-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-[13px] font-medium ${!alert.is_read ? 'text-neutral-900' : 'text-neutral-600'}`}>{alert.title}</p>
                        {!alert.is_read && <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full
                          ${alert.severity === 'critical' ? 'bg-red-100 text-red-700' : alert.severity === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-500'}`}>
                          {alert.severity}
                        </span>
                      </div>
                      {alert.description && <p className="text-[12px] text-neutral-400 mt-0.5">{alert.description}</p>}
                    </div>
                    <span className="text-[10px] text-neutral-300 shrink-0 tabular-nums">{timeAgo(alert.created_at)}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ═══ FINANCIAL ═══ */}
      {activeTab === 'financial' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-neutral-900">{t('risk.financial_report_title')}</p>
            <div className="flex items-center gap-1">
              {[7, 30, 90].map(p => (
                <button key={p} onClick={() => { setFinancialPeriod(p); fetchFinancial(p) }}
                  className={`h-7 px-3 rounded-lg text-[11px] font-medium transition-all
                    ${financialPeriod === p ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'}`}>
                  {p}z
                </button>
              ))}
            </div>
          </div>

          {loadingFinancial ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-7 w-7 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : financialData ? (
            <>
              {/* Hero pierderi */}
              <Card className="p-5 bg-neutral-900 border-neutral-900">
                <p className="text-[10px] text-neutral-500 uppercase tracking-wide mb-1">{t('risk.total_losses_period', { period: String(financialData.period) })}</p>
                <div className="flex items-end gap-3 mb-4">
                  <p className="text-4xl font-black text-white tabular-nums">{financialData.loss.totalLoss.toLocaleString()} RON</p>
                  {financialData.refusalRateChange !== 0 && (
                    <span className={`text-[12px] font-medium pb-1 flex items-center gap-1 ${financialData.refusalRateChange > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {financialData.refusalRateChange > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {Math.abs(financialData.refusalRateChange)}% {t('risk.vs_previous_period')}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: t('risk.product_value'),       val: financialData.loss.productLoss },
                    { label: t('risk.shipping_forward'),        val: financialData.loss.shippingLoss },
                    { label: t('risk.return_shipping'),     val: financialData.loss.returnShippingLoss },
                    { label: t('risk.repackaging'),        val: financialData.loss.repackagingLoss },
                  ].map(item => (
                    <div key={item.label} className="bg-white/10 rounded-xl p-3">
                      <p className="text-xl font-bold text-white tabular-nums">{item.val.toLocaleString()}</p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Card className="p-4"><p className="text-2xl font-black text-emerald-600 tabular-nums">{financialData.collectionRate}%</p><p className="text-[11px] text-neutral-400 mt-1">{t('risk.pickup_rate')}</p></Card>
                <Card className="p-4"><p className={`text-2xl font-black tabular-nums ${financialData.refusalRate > 20 ? 'text-red-600' : 'text-neutral-900'}`}>{financialData.refusalRate}%</p><p className="text-[11px] text-neutral-400 mt-1">{t('risk.refusal_rate')}</p></Card>
                <Card className="p-4 bg-emerald-50 border-emerald-100 col-span-2 sm:col-span-1"><p className="text-2xl font-black text-emerald-700 tabular-nums">{financialData.blockedValue.toLocaleString()} RON</p><p className="text-[11px] text-emerald-600 mt-1">{t('risk.losses_avoided')}</p></Card>
              </div>

              <Card className="p-4 bg-amber-50 border-amber-200 flex items-center gap-3">
                <AlertOctagon className="h-7 w-7 text-amber-500 shrink-0" />
                <div>
                  <p className="text-[13px] font-semibold text-amber-900">{t('risk.monthly_projection', { amount: financialData.projectedMonthlyLoss.toLocaleString() })}</p>
                  <p className="text-[11px] text-amber-600 mt-0.5">{t('risk.calculated_from')}</p>
                </div>
              </Card>

              {financialData.daily.length > 0 && (
                <Card className="p-4">
                  <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-3">{t('risk.daily_refusals')}</p>
                  <div className="flex items-end gap-0.5 h-16">
                    {financialData.daily.slice(-30).map((d, i) => {
                      const maxVal = Math.max(...financialData.daily.slice(-30).map(x => x.refused), 1)
                      const h = d.refused > 0 ? Math.max((d.refused / maxVal) * 100, 8) : 2
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0 group relative">
                          <div className={`w-full rounded-t transition-all ${d.refused > 0 ? 'bg-neutral-400 group-hover:bg-neutral-600' : 'bg-neutral-100'}`} style={{ height: `${h}%` }} />
                          <div className="absolute bottom-full mb-1 hidden group-hover:block bg-neutral-900 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap z-10">
                            {t('risk.daily_refused_tooltip', { date: d.date.slice(5), count: String(d.refused) })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}

              {financialData.topLossCustomers.length > 0 && (
                <Card className="p-5">
                  <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-3">{t('risk.top_loss_customers')}</p>
                  <div className="space-y-2">
                    {financialData.topLossCustomers.map((c, i) => (
                      <div key={c.id} onClick={() => { const cust = customers.find(x => x.id === c.id); if (cust) openProfile(cust) }}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-neutral-50 cursor-pointer">
                        <span className="text-2xl font-black text-neutral-100 w-6 text-center tabular-nums">{i+1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-neutral-900 truncate">{c.name || c.phone || '—'}</p>
                          <p className="text-[11px] text-neutral-400">{t('risk.refused_parcels', { count: String(c.lossOrders) })}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[13px] font-bold text-red-600 tabular-nums">{c.totalLoss.toLocaleString()} RON</p>
                          <RiskBadge label={c.risk_label as any} score={c.risk_score} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <DollarSign className="h-8 w-8 text-neutral-200 mx-auto mb-3" />
              <Btn onClick={() => fetchFinancial()}>{t('risk.load_financial')}</Btn>
            </div>
          )}
        </div>
      )}

      {/* ═══ HEATMAP ═══ */}
      {activeTab === 'heatmap' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-neutral-900">{t('risk.geo_heatmap_title')}</p>
              <p className="text-[12px] text-neutral-400 mt-0.5">{t('risk.refusal_by_county')}</p>
            </div>
            <Btn variant="outline" size="sm" onClick={fetchHeatmap} disabled={loadingHeatmap}>
              <RefreshCw className={`h-3 w-3 ${loadingHeatmap ? 'animate-spin' : ''}`} />{t('risk.update_btn')}
            </Btn>
          </div>

          {loadingHeatmap ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-7 w-7 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : heatmapData.length > 0 ? (
            <>
              <div className="flex items-center gap-4 text-[11px] text-neutral-400">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-emerald-400 inline-block" />{t('risk.low_risk')}</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-amber-400 inline-block" />{t('risk.medium_risk')}</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-red-500 inline-block" />{t('risk.high_risk')}</span>
                <span className="ml-auto">{t('risk.national_avg')} <strong className="text-neutral-700">{nationalRefusalRate}%</strong></span>
              </div>

              <Card className="overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_auto_auto] text-[10px] font-medium text-neutral-400 uppercase tracking-wide px-4 py-2 bg-neutral-50 border-b border-neutral-100">
                  <span>{t('risk.county')}</span><span className="text-right pr-4">{t('risk.orders_col')}</span><span className="text-right pr-4">{t('risk.refusals_col')}</span><span className="text-right">{t('risk.rate')}</span>
                </div>
                <div className="divide-y divide-neutral-50 max-h-96 overflow-y-auto">
                  {heatmapData.map(point => (
                    <div key={point.county} className="grid grid-cols-[1fr_auto_auto_auto] px-4 py-3 items-center hover:bg-neutral-50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${point.riskLevel === 'high' ? 'bg-red-500' : point.riskLevel === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                          <span className="text-[13px] font-medium text-neutral-900">{point.name}</span>
                        </div>
                        <div className="ml-4 mt-1 h-1 w-24 bg-neutral-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${point.riskLevel === 'high' ? 'bg-red-400' : point.riskLevel === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'}`}
                            style={{ width: `${Math.min(point.refusalRate * 2, 100)}%` }} />
                        </div>
                      </div>
                      <span className="text-[12px] text-neutral-400 text-right pr-4 tabular-nums">{point.total}</span>
                      <span className="text-[12px] text-neutral-600 text-right pr-4 tabular-nums">{point.refused}</span>
                      <span className={`text-[13px] font-bold text-right tabular-nums ${point.riskLevel === 'high' ? 'text-red-600' : point.riskLevel === 'medium' ? 'text-amber-600' : 'text-emerald-600'}`}>{point.refusalRate}%</span>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {heatmapData.slice(0, 3).map((p, i) => (
                  <Card key={p.county} className={`p-4 ${p.riskLevel === 'high' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                    <p className="text-[10px] text-neutral-400 mb-1">{t('risk.max_risk_label', { n: String(i + 1) })}</p>
                    <p className="text-[13px] font-semibold text-neutral-900">{p.name}</p>
                    <p className={`text-2xl font-black mt-1 tabular-nums ${p.riskLevel === 'high' ? 'text-red-600' : 'text-amber-600'}`}>{p.refusalRate}%</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5 tabular-nums">{t('risk.county_orders_count', { refused: String(p.refused), total: String(p.total) })}</p>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <MapPin className="h-8 w-8 text-neutral-200 mx-auto mb-3" />
              <p className="text-[13px] text-neutral-400 mb-1">{t('risk.not_enough_data')}</p>
              <p className="text-[12px] text-neutral-300">{t('risk.address_hint')}</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ CLUSTERS ═══ */}
      {activeTab === 'clusters' && (
        <ClusterTab storeId={selectedStore} customers={customers}
          onOpenProfile={(id) => { const c = customers.find(x => x.id === id); if (c) openProfile(c) }} />
      )}

      {/* ═══ ANALYTICS ═══ */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: t('risk.high_risk_rate'), value: `${riskRate}%`, sub: `${(stats.blocked||0) + (stats.problematic||0)} ${t('risk.high_risk_customers')}`, color: riskRate > 20 ? 'text-red-600' : 'text-neutral-900' },
              { label: t('risk.collection_rate_label'), value: `${globalCollectionRate}%`, sub: `${totalCollected} ${t('common.of')} ${totalOrders}`, color: globalCollectionRate < 60 ? 'text-orange-600' : 'text-emerald-600' },
              { label: t('risk.refusal_rate_label'), value: `${globalRefusalRate}%`, sub: `${totalRefused} ${t('risk.refused')} · ${totalNotHome} ${t('risk.status_not_home')}`, color: globalRefusalRate > 20 ? 'text-red-600' : 'text-neutral-900' },
              { label: t('risk.active_alerts_label'), value: activeAlerts, sub: t('risk.unread_label', { count: String(unreadAlerts) }), color: activeAlerts > 0 ? 'text-red-600' : 'text-neutral-900' },
            ].map((item, i) => (
              <Card key={i} className="p-4">
                <p className={`text-2xl font-black tabular-nums ${item.color}`}>{item.value}</p>
                <p className="text-[11px] text-neutral-500 mt-0.5">{item.label}</p>
                <p className="text-[10px] text-neutral-300 mt-0.5">{item.sub}</p>
              </Card>
            ))}
          </div>

          <Card className="p-5">
            <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-4">{t('risk.risk_distribution')}</p>
            <div className="space-y-3">
              {[
                { key: 'blocked',     label: t('risk.blocked_label'),      color: 'bg-red-500',     text: 'text-red-600' },
                { key: 'problematic', label: t('risk.problematic_label'), color: 'bg-orange-400',  text: 'text-orange-600' },
                { key: 'watch',       label: t('risk.watch_label'),       color: 'bg-amber-400',   text: 'text-amber-600' },
                { key: 'new',         label: t('risk.label_new'),         color: 'bg-neutral-300', text: 'text-neutral-600' },
                { key: 'trusted',     label: t('risk.tab_trusted'),     color: 'bg-emerald-400', text: 'text-emerald-600' },
              ].map(item => {
                const val = stats[item.key] || 0
                const pct = totalCustomers > 0 ? (val / totalCustomers) * 100 : 0
                return (
                  <div key={item.key} className="flex items-center gap-3">
                    <span className="text-[11px] text-neutral-500 w-24 shrink-0">{item.label}</span>
                    <div className="flex-1 h-4 bg-neutral-100 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: 'easeOut' }}
                        className={`h-full rounded-full ${item.color}`} />
                    </div>
                    <div className="flex items-center gap-1.5 w-20 justify-end">
                      <span className={`text-[13px] font-bold tabular-nums ${item.text}`}>{val}</span>
                      <span className="text-[10px] text-neutral-300">({pct.toFixed(0)}%)</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-4">{t('risk.top5_risk')}</p>
            {customers.filter(c => c.risk_label === 'blocked' || c.risk_label === 'problematic').length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="h-7 w-7 text-neutral-200 mx-auto mb-2" />
                <p className="text-[13px] text-neutral-400">{t('risk.no_high_risk')}</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {customers.filter(c => c.risk_label === 'blocked' || c.risk_label === 'problematic').sort((a, b) => b.risk_score - a.risk_score).slice(0, 5).map((c, i) => (
                  <div key={c.id} onClick={() => openProfile(c)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-neutral-50 cursor-pointer transition-colors">
                    <span className="text-2xl font-black text-neutral-100 w-6 text-center tabular-nums">{i+1}</span>
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-[13px] shrink-0 ${c.risk_label === 'blocked' ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}`}>
                      {(c.name || c.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-neutral-900 truncate">{c.name || '—'}</p>
                      <p className="text-[11px] text-neutral-400 truncate">{c.phone || c.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiskBadge label={c.risk_label} score={c.risk_score} />
                      <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ═══ SETTINGS ═══ */}
      {activeTab === 'settings' && (
        <SettingsTab settings={storeSettings} mlAccuracy={mlAccuracy} mlTotalPredictions={mlTotalPredictions}
          savingSettings={savingSettings} onSave={saveStoreSettings} />
      )}

      {/* ═══ CUSTOMER PROFILE PANEL ═══ */}
      <AnimatePresence>
        {showProfile && selectedCustomer && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.25 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40" onClick={() => setShowProfile(false)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed inset-0 sm:right-0 sm:left-auto h-full w-full sm:max-w-lg bg-white z-50 shadow-2xl flex flex-col overflow-hidden border-l border-neutral-200">

              {/* Panel Header */}
              <div className="border-b border-neutral-100 px-5 py-4 flex items-start justify-between shrink-0">
                <div className="flex items-start gap-3">
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-black text-lg shrink-0
                    ${selectedCustomer.risk_label === 'blocked'     ? 'bg-red-600 text-white'        :
                      selectedCustomer.risk_label === 'problematic' ? 'bg-orange-500 text-white'     :
                      selectedCustomer.risk_label === 'watch'       ? 'bg-amber-400 text-amber-900'  :
                      selectedCustomer.risk_label === 'trusted'     ? 'bg-emerald-100 text-emerald-700' :
                      'bg-neutral-100 text-neutral-600'}`}>
                    {(selectedCustomer.name || selectedCustomer.email || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-neutral-900">{selectedCustomer.name || t('risk.unknown_customer')}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <RiskBadge label={selectedCustomer.risk_label} score={selectedCustomer.risk_score} />
                      {selectedCustomer.in_global_blacklist && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full"><Globe className="h-2.5 w-2.5" />Global BL</span>
                      )}
                      {selectedCustomer.in_local_blacklist && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-neutral-900 text-white px-1.5 py-0.5 rounded-full"><Ban className="h-2.5 w-2.5" />{t('risk.local_blacklist_badge')}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowProfile(false)} className="h-8 w-8 rounded-xl bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition-colors">
                  <X className="h-4 w-4 text-neutral-500" />
                </button>
              </div>

              {/* Profile Sub-tabs */}
              <div className="flex border-b border-neutral-100 px-5 shrink-0 overflow-x-auto">
                {[
                  { key: 'overview',   label: t('risk.profile_tab')   },
                  { key: 'timeline',   label: t('risk.history_tab')  },
                  { key: 'addresses',  label: t('risk.addresses_tab')   },
                  { key: '360',        label: '360°'     },
                ].map(tab => (
                  <button key={tab.key}
                    onClick={() => { setProfileTab(tab.key as any); if (tab.key === '360' && selectedCustomer) fetchClusterForCustomer(selectedCustomer.id) }}
                    className={`px-4 py-3 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap
                      ${profileTab === tab.key ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto">

                {/* ── OVERVIEW ── */}
                {profileTab === 'overview' && (
                  <div className="p-5 space-y-5">
                    <div className="flex items-start gap-4">
                      <ScoreRing score={selectedCustomer.risk_score} size={88} />
                      <div className="flex-1 space-y-2">
                        {selectedCustomer.phone && (
                          <a href={`tel:${selectedCustomer.phone}`} className="flex items-center gap-2 text-[13px] hover:text-neutral-900 text-neutral-600 transition-colors group">
                            <Phone className="h-3.5 w-3.5 text-neutral-300 group-hover:text-neutral-500 shrink-0" />{selectedCustomer.phone}
                          </a>
                        )}
                        {selectedCustomer.email && (
                          <a href={`mailto:${selectedCustomer.email}`} className="flex items-center gap-2 text-[13px] hover:text-neutral-900 text-neutral-600 transition-colors group truncate">
                            <Mail className="h-3.5 w-3.5 text-neutral-300 group-hover:text-neutral-500 shrink-0" />{selectedCustomer.email}
                          </a>
                        )}
                        {selectedCustomer.first_order_at && (
                          <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            {t('risk.customer_since', { date: new Date(selectedCustomer.first_order_at).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' }) })}
                          </div>
                        )}
                        {selectedCustomer.last_order_at && (
                          <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            {t('risk.last_order_ago', { time: timeAgo(selectedCustomer.last_order_at) })}
                          </div>
                        )}
                      </div>
                    </div>

                    <CustomerBadges customer={selectedCustomer} />

                    <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
                      <SectionLabel>{t('risk.order_behavior')}</SectionLabel>
                      <BehaviorBar label={t('risk.collected_label')}         value={selectedCustomer.orders_collected} max={selectedCustomer.total_orders} color="bg-emerald-500" />
                      <BehaviorBar label={t('risk.refused_label')}         value={selectedCustomer.orders_refused}   max={selectedCustomer.total_orders} color="bg-red-500" />
                      <BehaviorBar label={t('risk.absent_label')} value={selectedCustomer.orders_not_home} max={selectedCustomer.total_orders} color="bg-amber-400" />
                      <BehaviorBar label={t('risk.cancelled_label')}          value={selectedCustomer.orders_cancelled} max={selectedCustomer.total_orders} color="bg-neutral-300" />
                      <div className="pt-2 border-t border-neutral-200 flex justify-between items-center">
                        <span className="text-[12px] text-neutral-500">{t('risk.global_pickup_label')}</span>
                        <span className={`text-xl font-black tabular-nums
                          ${(collectionRate(selectedCustomer) ?? 100) >= 70 ? 'text-emerald-600' :
                            (collectionRate(selectedCustomer) ?? 100) >= 50 ? 'text-amber-600'  : 'text-red-600'}`}>
                          {collectionRate(selectedCustomer) !== null ? `${collectionRate(selectedCustomer)}%` : '—'}
                        </span>
                      </div>
                    </div>

                    {customerOrders.length > 0 && <LossCalculator customer={selectedCustomer} orders={customerOrders} />}

                    {/* Override label */}
                    <div>
                      <SectionLabel>{t('risk.manual_label_section')}</SectionLabel>
                      <div className="flex flex-wrap gap-2">
                        {(['trusted', 'watch', 'problematic', 'blocked'] as const).map(l => {
                          const isActive = selectedCustomer.risk_label === l
                          const styles: Record<string, { active: string; idle: string }> = {
                            trusted:     { active: 'bg-emerald-600 text-white border-emerald-600',   idle: 'border-neutral-200 text-neutral-500 hover:border-emerald-200 hover:text-emerald-700' },
                            watch:       { active: 'bg-amber-500 text-white border-amber-500',       idle: 'border-neutral-200 text-neutral-500 hover:border-amber-200 hover:text-amber-700' },
                            problematic: { active: 'bg-orange-500 text-white border-orange-500',     idle: 'border-neutral-200 text-neutral-500 hover:border-orange-200 hover:text-orange-700' },
                            blocked:     { active: 'bg-red-600 text-white border-red-600',           idle: 'border-neutral-200 text-neutral-500 hover:border-red-200 hover:text-red-700' },
                          }
                          return (
                            <button key={l} onClick={() => overrideLabel(selectedCustomer.id, l)}
                              className={`px-3 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${isActive ? styles[l].active : styles[l].idle}`}>
                              {LABEL_CONFIG[l].label}
                            </button>
                          )
                        })}
                      </div>
                      {selectedCustomer.manual_label_override && (
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-[10px] text-amber-500 flex items-center gap-1"><Pencil className="h-2.5 w-2.5" />{t('risk.manual_override_active')}</p>
                          <button onClick={() => overrideLabel(selectedCustomer.id, null as any)}
                            className="text-[10px] text-neutral-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                            <X className="h-2.5 w-2.5" />{t('risk.delete_label_btn')}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Note operator */}
                    <div>
                      <SectionLabel>{t('risk.operator_notes')}</SectionLabel>
                      <textarea value={editNote} onChange={e => setEditNote(e.target.value)}
                        placeholder={t('risk.add_internal_notes')} rows={3}
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-[13px] focus:outline-none focus:border-neutral-400 resize-none text-neutral-700 bg-neutral-50" />
                      <Btn onClick={saveNote} disabled={savingNote} className="mt-2"
                        variant={noteSaved ? 'outline' : 'primary'}>
                        {savingNote ? <><RefreshCw className="h-3 w-3 animate-spin" />{t('risk.saving')}</> :
                         noteSaved  ? <><CheckCircle2 className="h-3 w-3" />{t('risk.saved')}</> :
                         t('risk.save_note')}
                      </Btn>
                    </div>

                    {/* Blacklist */}
                    <div className="pt-2 border-t border-neutral-100">
                      <button onClick={() => toggleBlacklist(!selectedCustomer.in_local_blacklist)}
                        className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-[13px] font-semibold transition-all
                          ${selectedCustomer.in_local_blacklist
                            ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                            : 'border-2 border-neutral-900 text-neutral-900 hover:bg-neutral-50'}`}>
                        <Ban className="h-4 w-4" />
                        {selectedCustomer.in_local_blacklist ? t('risk.removed_from_blacklist') : t('risk.added_to_blacklist')}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── TIMELINE ── */}
                {profileTab === 'timeline' && (
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-semibold text-neutral-900">{t('risk.order_history_title')}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full tabular-nums">{t('risk.orders_count', { count: String(customerOrders.length) })}</span>
                        <Btn variant="outline" size="sm" onClick={importHistory} disabled={importingHistory}>
                          <RefreshCw className={`h-3 w-3 ${importingHistory ? 'animate-spin' : ''}`} />
                          {importingHistory ? t('risk.importing') : t('risk.sync_btn')}
                        </Btn>
                      </div>
                    </div>
                    {customerOrders.length === 0 ? (
                      <div className="py-12 text-center">
                        <Package className="h-7 w-7 text-neutral-200 mx-auto mb-2" />
                        <p className="text-[13px] text-neutral-400 mb-3">{t('risk.no_orders_recorded')}</p>
                        <Btn onClick={importHistory} disabled={importingHistory}>
                          <RefreshCw className={`h-3.5 w-3.5 ${importingHistory ? 'animate-spin' : ''}`} />
                          {importingHistory ? t('risk.importing') : t('risk.import_woo_btn')}
                        </Btn>
                      </div>
                    ) : (
                      <Timeline orders={customerOrders} onUpdateStatus={updateOrderStatus} updatingOrder={updatingOrder} />
                    )}
                  </div>
                )}

                {/* ── ADDRESSES ── */}
                {profileTab === 'addresses' && (
                  <div className="p-5 space-y-4">
                    <p className="text-[13px] font-semibold text-neutral-900">{t('risk.delivery_addresses_title')}</p>
                    <Card className="p-3.5 bg-amber-50 border-amber-100 flex items-start gap-2.5">
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[12px] text-amber-700 leading-relaxed">{t('risk.multi_address_warning')}</p>
                    </Card>
                    <AddressMap orders={customerOrders} />
                  </div>
                )}

                {/* ── 360° ── */}
                {profileTab === '360' && (
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-semibold text-neutral-900">{t('risk.similar_identities_title')}</p>
                      <Btn variant="outline" size="sm" onClick={() => selectedCustomer && fetchClusterForCustomer(selectedCustomer.id)} disabled={loadingCluster}>
                        <RefreshCw className={`h-3 w-3 ${loadingCluster ? 'animate-spin' : ''}`} />{t('risk.reanalyze_btn')}
                      </Btn>
                    </div>

                    {loadingCluster ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="h-6 w-6 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : clusterMatches.length === 0 ? (
                      <div className="text-center py-10">
                        <div className="h-11 w-11 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        </div>
                        <p className="text-[13px] font-medium text-neutral-700">{t('risk.no_similar_identity')}</p>
                        <p className="text-[12px] text-neutral-400 mt-1">{t('risk.no_duplicate_accounts')}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Card className="p-3.5 bg-amber-50 border-amber-100 flex items-start gap-2.5">
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-[12px] text-amber-700 leading-relaxed">
                            <span dangerouslySetInnerHTML={{ __html: t('risk.similar_identities_detected', { count: String(clusterMatches.length) }) }} /> 
                          </p>
                        </Card>
                        {clusterMatches.map((match: any, i: number) => (
                          <Card key={i} className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${match.similarity >= 0.9 ? 'bg-red-500' : 'bg-amber-400'}`} />
                                <span className="text-[13px] font-medium text-neutral-900">{match.customer?.name || t('risk.unknown_customer')}</span>
                              </div>
                              <span className="text-[11px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full tabular-nums">
                                {Math.round((match.similarity || 0) * 100)}% similar
                              </span>
                            </div>
                            <div className="space-y-1 mb-3">
                              {match.customer?.phone && <p className="text-[12px] text-neutral-500 flex items-center gap-1.5"><Phone className="h-3 w-3" />{match.customer.phone}</p>}
                              {match.customer?.email && <p className="text-[12px] text-neutral-500 flex items-center gap-1.5"><Mail className="h-3 w-3" />{match.customer.email}</p>}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-neutral-400 mb-3">
                              <span>{match.customer?.total_orders || 0} comenzi</span>
                              <span>{match.customer?.orders_refused || 0} refuzuri</span>
                              {match.customer?.risk_label && <RiskBadge label={match.customer.risk_label} />}
                            </div>
                            {match.matchReason?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {match.matchReason.map((r: string, j: number) => (
                                  <span key={j} className="text-[9px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-full">{r}</span>
                                ))}
                              </div>
                            )}
                            <button onClick={() => { const c = match.customer; if (c) openProfile({ ...c, store_id: selectedCustomer?.store_id || '', in_local_blacklist: false, in_global_blacklist: false, manually_reviewed: false, operator_notes: null, manual_label_override: null, last_order_at: null, first_order_at: null }) }}
                              className="text-[12px] text-neutral-600 hover:text-neutral-900 font-medium flex items-center gap-1 transition-colors">
                              <ArrowUpRight className="h-3 w-3" />{t('risk.open_profile_btn')}
                            </button>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}