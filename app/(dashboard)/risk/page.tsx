'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, AlertTriangle, Bell, BellOff, Users, Package,
  RefreshCw, Search, ChevronDown, X, Check, Eye,
  Phone, Mail, MapPin, Calendar, Clock, TrendingDown,
  Info, Ban, CheckCircle2, CircleDot, Pencil, Filter,
  ArrowUpRight, ChevronRight, Minus, TrendingUp,
  Zap, Star, Globe, BarChart3, FileText, Download,
  Activity, Target, AlertCircle, ChevronLeft,
  Sparkles, Brain, Hash, Fingerprint, Navigation,
  DollarSign, Percent, TriangleAlert, UserX, Award,
  TrendingUp as TrendUp, Layers, Settings, Cpu,
  Link2, Network, AlertOctagon, Wallet, ArrowDown, ArrowUp,
} from 'lucide-react'
import { LABEL_CONFIG } from '@/lib/risk/engine'

// ─── TYPES ───────────────────────────────────────────────────────────────────

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

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Așteptare', processing: 'Procesare', shipped: 'Expediat',
  collected: 'Ridicat', refused: 'Refuzat', not_home: 'Absent',
  cancelled: 'Anulat', returned: 'Returnat',
}

const ORDER_STATUS_STYLE: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  processing: 'bg-blue-50 text-blue-700',
  shipped: 'bg-indigo-50 text-indigo-700',
  collected: 'bg-emerald-50 text-emerald-700',
  refused: 'bg-red-900 text-white',
  not_home: 'bg-orange-50 text-orange-700',
  cancelled: 'bg-gray-700 text-white',
  returned: 'bg-red-100 text-red-700',
}

const ORDER_STATUS_ICON: Record<string, string> = {
  collected: '✓', refused: '✗', not_home: '○', cancelled: '—',
  pending: '·', processing: '◎', shipped: '→', returned: '↩',
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function RiskBadge({ label, score }: { label: keyof typeof LABEL_CONFIG; score?: number }) {
  const cfg = LABEL_CONFIG[label] || LABEL_CONFIG.new
  const colors: Record<string, string> = {
    trusted: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    new: 'bg-gray-100 text-gray-500 border border-gray-200',
    watch: 'bg-amber-50 text-amber-700 border border-amber-200',
    problematic: 'bg-orange-100 text-orange-800 border border-orange-200',
    blocked: 'bg-red-600 text-white border border-red-600',
  }
  const dots: Record<string, string> = {
    trusted: 'bg-emerald-500', new: 'bg-gray-400', watch: 'bg-amber-500',
    problematic: 'bg-orange-600', blocked: 'bg-white',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors[label] || colors.new}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dots[label] || dots.new} shrink-0`} />
      {cfg.label}
      {score !== undefined && <span className="opacity-60 ml-0.5 font-mono">· {score}</span>}
    </span>
  )
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size / 2) - 8
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 81 ? '#dc2626' : score >= 61 ? '#ea580c' : score >= 41 ? '#d97706' : '#10b981'
  const label = score >= 81 ? 'Blocat' : score >= 61 ? 'Problematic' : score >= 41 ? 'Watch' : 'Trusted'
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 absolute">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="text-center z-10">
        <div className="text-xl font-black text-gray-900 leading-none">{score}</div>
        <div className="text-[9px] text-gray-400 font-mono mt-0.5">{label}</div>
      </div>
    </div>
  )
}

function BehaviorBar({ label, value, max, color = 'bg-gray-900' }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] text-gray-500">{label}</span>
        <span className="text-[11px] font-mono font-semibold text-gray-900">{value}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color = 'text-gray-900', icon: Icon }: { label: string; value: string | number; sub?: string; color?: string; icon?: any }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      {Icon && <div className="mb-2"><Icon className="h-4 w-4 text-gray-400" /></div>}
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-300 mt-1">{sub}</p>}
    </div>
  )
}

function Timeline({ orders, onUpdateStatus, updatingOrder }: { orders: Order[]; onUpdateStatus: (id: string, status: string) => void; updatingOrder: string | null }) {
  const sorted = [...orders].sort((a, b) => new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime())
  return (
    <div className="relative">
      <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100" />
      <div className="space-y-3">
        {sorted.map((order, i) => {
          const icon = ORDER_STATUS_ICON[order.order_status] || '·'
          const isBad = ['refused', 'cancelled', 'returned'].includes(order.order_status)
          const isGood = order.order_status === 'collected'
          const isActive = ['pending', 'processing', 'shipped'].includes(order.order_status)
          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-start gap-3 pl-1"
            >
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 z-10 ${
                isBad ? 'bg-red-100 text-red-700 border border-red-200' :
                isGood ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                'bg-gray-100 text-gray-500 border border-gray-200'
              }`}>
                {icon}
              </div>
              <div className="flex-1 min-w-0 bg-gray-50 rounded-xl p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-gray-900">#{order.order_number || order.external_order_id}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ORDER_STATUS_STYLE[order.order_status] || 'bg-gray-100 text-gray-500'}`}>
                      {ORDER_STATUS_LABELS[order.order_status] || order.order_status}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-semibold text-gray-700 shrink-0">{order.total_value} {order.currency}</span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-[10px] text-gray-400">
                    {new Date(order.ordered_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {order.payment_method === 'cod' && (
                    <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full border border-amber-100">COD</span>
                  )}
                  {order.shipping_address && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5 truncate max-w-[120px]">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{order.shipping_address.split(',')[0]}</span>
                    </span>
                  )}
                </div>
                {order.risk_flags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {order.risk_flags.slice(0, 3).map((flag: any, j: number) => (
                      <span key={j} className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full border border-red-100">
                        {flag.label}
                      </span>
                    ))}
                  </div>
                )}
                {isActive && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {[
                      { status: 'collected', label: '✓ Ridicat', cls: 'bg-emerald-600 text-white hover:bg-emerald-700' },
                      { status: 'refused', label: '✗ Refuzat', cls: 'bg-red-600 text-white hover:bg-red-700' },
                      { status: 'not_home', label: '○ Absent', cls: 'bg-amber-100 text-amber-800 hover:bg-amber-200' },
                      { status: 'cancelled', label: '— Anulat', cls: 'bg-gray-200 text-gray-700 hover:bg-gray-300' },
                    ].map(btn => (
                      <button
                        key={btn.status}
                        onClick={() => onUpdateStatus(order.id, btn.status)}
                        disabled={updatingOrder === order.id}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors disabled:opacity-40 ${btn.cls}`}
                      >
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

function AddressMap({ orders }: { orders: Order[] }) {
  const addressCounts = orders.reduce<Record<string, { count: number; bad: number }>>((acc, o) => {
    if (!o.shipping_address) return acc
    const key = o.shipping_address
    if (!acc[key]) acc[key] = { count: 0, bad: 0 }
    acc[key].count++
    if (['refused', 'not_home', 'cancelled'].includes(o.order_status)) acc[key].bad++
    return acc
  }, {})

  const addresses = Object.entries(addressCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)

  if (addresses.length === 0) return (
    <div className="text-center py-8">
      <MapPin className="h-6 w-6 text-gray-200 mx-auto mb-2" />
      <p className="text-xs text-gray-400">Nicio adresă înregistrată</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {addresses.map(([addr, data], i) => (
        <div key={i} className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-xl">
          <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${data.bad > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
            <MapPin className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-700 font-medium">{addr}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {data.count} comenzi · {data.bad > 0 ? <span className="text-red-500">{data.bad} problematice</span> : <span className="text-emerald-600">fără probleme</span>}
            </p>
          </div>
          <div className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${data.bad > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
            ×{data.count}
          </div>
        </div>
      ))}
    </div>
  )
}

function LossCalculator({ customer, orders }: { customer: Customer; orders: Order[] }) {
  const refused = orders.filter(o => o.order_status === 'refused')
  const totalLost = refused.reduce((s, o) => s + (o.total_value || 0), 0)
  const shippingCost = 15
  const totalShipping = (customer.orders_refused + customer.orders_not_home) * shippingCost
  const totalDamage = totalLost + totalShipping

  if (customer.orders_refused === 0 && customer.orders_not_home === 0) return null

  return (
    <div className="bg-red-50 border border-red-100 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-red-500" />
        <span className="text-xs font-semibold text-red-700">Estimare Pierderi Generate</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xl font-black text-red-600">{totalLost.toFixed(0)}</p>
          <p className="text-[10px] text-red-400">RON refuzate</p>
        </div>
        <div>
          <p className="text-xl font-black text-orange-600">{totalShipping}</p>
          <p className="text-[10px] text-orange-400">RON transport</p>
        </div>
        <div>
          <p className="text-xl font-black text-gray-900">{totalDamage.toFixed(0)}</p>
          <p className="text-[10px] text-gray-500">RON total</p>
        </div>
      </div>
    </div>
  )
}

function CustomerBadges({ customer }: { customer: Customer }) {
  const badges = []
  const rate = customer.total_orders > 0 ? (customer.orders_collected / customer.total_orders) * 100 : 100

  if (customer.in_global_blacklist) badges.push({ label: 'Global Blacklist', icon: Globe, color: 'bg-red-600 text-white' })
  if (customer.in_local_blacklist) badges.push({ label: 'Blacklist Local', icon: Ban, color: 'bg-gray-900 text-white' })
  if (rate < 20 && customer.total_orders >= 5) badges.push({ label: 'Ghost Buyer', icon: UserX, color: 'bg-purple-100 text-purple-700 border border-purple-200' })
  if (customer.orders_refused >= 5) badges.push({ label: 'Serial Refuser', icon: TriangleAlert, color: 'bg-red-100 text-red-700 border border-red-200' })
  if (customer.total_orders >= 10 && rate >= 90) badges.push({ label: 'VIP Trusted', icon: Award, color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' })
  if (customer.manual_label_override) badges.push({ label: 'Override Manual', icon: Pencil, color: 'bg-amber-100 text-amber-700 border border-amber-200' })
  if (customer.total_orders <= 1) badges.push({ label: 'Prima comandă', icon: Sparkles, color: 'bg-blue-50 text-blue-700 border border-blue-100' })

  if (badges.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b, i) => (
        <span key={i} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${b.color}`}>
          <b.icon className="h-3 w-3" />
          {b.label}
        </span>
      ))}
    </div>
  )
}

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


// ─── CLUSTER TAB COMPONENT ────────────────────────────────────────────────────
function ClusterTab({ storeId, customers, onOpenProfile }: {
  storeId: string
  customers: Array<{ id: string; name: string | null; phone: string | null; risk_score: number; risk_label: string }>
  onOpenProfile: (id: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [clusters, setClusters] = useState<any[]>([])
  const [ran, setRan] = useState(false)

  const runClustering = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/risk/cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId }),
      })
      const data = await res.json()
      setClusters(data.clusters || [])
      setRan(true)
    } catch {}
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Detectare Identități Multiple</h2>
          <p className="text-xs text-gray-400 mt-0.5">Clienți care comandă cu telefoane sau emailuri diferite</p>
        </div>
        <button onClick={runClustering} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-xl hover:bg-gray-800 disabled:opacity-50">
          <Layers className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} />
          {loading ? 'Analizez...' : 'Rulează Analiza'}
        </button>
      </div>

      {!ran && !loading && (
        <div className="bg-gray-50 rounded-2xl p-8 text-center border-2 border-dashed border-gray-200">
          <Network className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600 mb-1">Analiză Clustering Identitate</p>
          <p className="text-xs text-gray-400 mb-4 max-w-xs mx-auto">
            Algoritmul detectează clienți care folosesc date diferite (telefon, email, nume) dar par a fi aceeași persoană, bazat pe similaritate nume + adresă.
          </p>
          <button onClick={runClustering} className="px-5 py-2 bg-gray-900 text-white text-sm rounded-xl hover:bg-gray-800">
            Pornește analiza
          </button>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="h-8 w-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Procesez {customers.length} clienți...</p>
        </div>
      )}

      {ran && !loading && clusters.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle2 className="h-10 w-10 text-emerald-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">Niciun cluster detectat</p>
          <p className="text-xs text-gray-400 mt-1">Nu au fost identificate identități multiple suspecte</p>
        </div>
      )}

      {clusters.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">{clusters.length} grupuri de identități similare detectate</p>
          {clusters.map((cluster, i) => (
            <div key={i} className={`bg-white border rounded-2xl p-4 ${cluster.riskLevel === 'high' ? 'border-red-200' : 'border-amber-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${cluster.riskLevel === 'high' ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <span className="text-sm font-semibold text-gray-900">{cluster.memberCount} identități similare</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="text-red-600 font-bold">{cluster.combinedRefusals} refuzuri combinate</span>
                  <span>·</span>
                  <span>Scor max: {cluster.maxRiskScore}</span>
                </div>
              </div>
              <div className="space-y-2">
                {cluster.members.map((m: any) => (
                  <div key={m.id}
                    className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer"
                    onClick={() => onOpenProfile(m.id)}>
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold ${m.risk_label === 'blocked' ? 'bg-red-600 text-white' : m.risk_label === 'problematic' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700'}`}>
                      {(m.name || m.phone || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{m.name || '—'}</p>
                      <p className="text-[11px] text-gray-400 truncate">{m.phone || m.email || m.id.slice(0, 8)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.risk_label === 'blocked' ? 'bg-red-100 text-red-700' : m.risk_label === 'problematic' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                        {m.risk_score}
                      </span>
                      <ChevronRight className="h-3 w-3 text-gray-300" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── SETTINGS TAB COMPONENT ───────────────────────────────────────────────────
function SettingsTab({ settings, mlAccuracy, mlTotalPredictions, savingSettings, onSave }: {
  settings: any
  mlAccuracy: number | null
  mlTotalPredictions: number
  savingSettings: boolean
  onSave: (updates: any) => Promise<void>
}) {
  const [local, setLocal] = useState<any>(settings || {})

  // Sync cu settings parent
  if (settings && JSON.stringify(settings) !== JSON.stringify(local) && Object.keys(local).length < 5) {
    setLocal(settings)
  }

  const set = (key: string, val: any) => setLocal((prev: any) => ({ ...prev, [key]: val }))

  const handleSave = async () => {
    await onSave(local)
  }

  if (!settings) return (
    <div className="flex items-center justify-center py-16">
      <div className="h-6 w-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Notificări Email */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Bell className="h-4 w-4" />Notificări Email
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Email pentru alerte</label>
            <input type="email" value={local.alert_email || ''} onChange={e => set('alert_email', e.target.value)}
              placeholder="email@magazin.ro"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
          </div>
          {[
            { key: 'email_alerts_enabled', label: 'Alerte instant per comandă riscantă' },
            { key: 'alert_on_blocked', label: 'Alertă pentru clienți Blocați' },
            { key: 'alert_on_problematic', label: 'Alertă pentru clienți Problematici' },
            { key: 'alert_on_watch', label: 'Alertă pentru clienți Watch' },
            { key: 'weekly_report_enabled', label: 'Raport săptămânal (luni 08:00)' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-700">{item.label}</span>
              <button onClick={() => set(item.key, !local[item.key])}
                className={`relative w-11 h-6 rounded-full transition-colors ${local[item.key] ? 'bg-gray-900' : 'bg-gray-200'}`}>
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${local[item.key] ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Praguri scor */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="h-4 w-4" />Praguri Scor Risc
        </h3>
        <div className="space-y-4">
          {[
            { key: 'score_watch_threshold', label: 'Prag Watch', color: 'text-amber-600', bg: 'bg-amber-50' },
            { key: 'score_problematic_threshold', label: 'Prag Problematic', color: 'text-orange-600', bg: 'bg-orange-50' },
            { key: 'score_blocked_threshold', label: 'Prag Blocat', color: 'text-red-600', bg: 'bg-red-50' },
          ].map(item => (
            <div key={item.key} className="flex items-center gap-4">
              <span className="text-xs text-gray-500 w-36 shrink-0">{item.label}</span>
              <input type="range" min={20} max={95} step={1}
                value={local[item.key] || 50}
                onChange={e => set(item.key, parseInt(e.target.value))}
                className="flex-1" />
              <span className={`text-sm font-bold w-10 text-right ${item.color}`}>{local[item.key]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reguli detecție */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4" />Reguli Detecție
        </h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Max comenzi/zi</label>
              <input type="number" min={1} max={20} value={local.max_orders_per_day || 3}
                onChange={e => set('max_orders_per_day', parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Rată min ridicare (%)</label>
              <input type="number" min={10} max={100} value={local.min_collection_rate_pct || 50}
                onChange={e => set('min_collection_rate_pct', parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Prag COD valoare mare (RON)</label>
              <input type="number" min={100} value={local.flag_high_value_cod_ron || 500}
                onChange={e => set('flag_high_value_cod_ron', parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cont nou (zile)</label>
              <input type="number" min={0} max={30} value={local.flag_new_account_days || 7}
                onChange={e => set('flag_new_account_days', parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
            </div>
          </div>
          {[
            { key: 'flag_night_orders', label: 'Detectează comenzi de noapte (00:00-06:00)' },
            { key: 'flag_temp_email', label: 'Detectează emailuri temporare' },
            { key: 'participate_in_global_blacklist', label: 'Participă la blacklist global Hontrio' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-700">{item.label}</span>
              <button onClick={() => set(item.key, !local[item.key])}
                className={`relative w-11 h-6 rounded-full transition-colors ${local[item.key] ? 'bg-gray-900' : 'bg-gray-200'}`}>
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${local[item.key] ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ML Model */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Cpu className="h-4 w-4" />Scoring Adaptiv (ML)
        </h3>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl mb-3">
          <div className="h-14 w-14 rounded-2xl bg-gray-900 flex items-center justify-center">
            <span className="text-white text-xl font-black">{mlAccuracy !== null ? `${mlAccuracy}%` : '—'}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Acuratețe model</p>
            <p className="text-xs text-gray-500 mt-0.5">{mlTotalPredictions} predicții procesate</p>
            {mlTotalPredictions < 20 && (
              <p className="text-[10px] text-amber-500 mt-1">⚡ Modelul se calibrează — minim 20 comenzi finalizate</p>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Modelul ML ajustează automat ponderea fiecărui semnal de risc în funcție de rezultatele reale ale comenzilor tale.
          Cu cât mai multe comenzi sunt finalizate (ridicate sau refuzate), cu atât predicțiile devin mai precise pentru magazinul tău specific.
        </p>
      </div>

      {/* Costuri transport pentru calcul pierderi */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Wallet className="h-4 w-4" />Costuri Transport (pentru calcul pierderi)
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Cost livrare (RON)</label>
            <input type="number" min={0} value={local.shipping_cost_ron || 15}
              onChange={e => set('shipping_cost_ron', parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Cost retur (RON)</label>
            <input type="number" min={0} value={local.return_shipping_cost_ron || 12}
              onChange={e => set('return_shipping_cost_ron', parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400" />
          </div>
        </div>
      </div>

      <button onClick={handleSave} disabled={savingSettings}
        className="w-full py-3 bg-gray-900 text-white text-sm font-semibold rounded-2xl hover:bg-gray-800 disabled:opacity-50 transition-colors">
        {savingSettings ? 'Salvare...' : 'Salvează toate setările'}
      </button>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function RiskShieldPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStore, setSelectedStore] = useState<string>('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [labelFilter, setLabelFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerOrders, setCustomerOrders] = useState<Order[]>([])
  const [showProfile, setShowProfile] = useState(false)
  const [activeTab, setActiveTab] = useState<'customers' | 'alerts' | 'financial' | 'heatmap' | 'clusters' | 'analytics' | 'settings'>('customers')
  const [profileTab, setProfileTab] = useState<'overview' | 'timeline' | 'addresses' | '360'>('overview')
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  const [editNote, setEditNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [importingHistory, setImportingHistory] = useState(false)
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)
  // New feature states
  const [financialData, setFinancialData] = useState<FinancialData | null>(null)
  const [financialPeriod, setFinancialPeriod] = useState(30)
  const [loadingFinancial, setLoadingFinancial] = useState(false)
  const [heatmapData, setHeatmapData] = useState<HeatmapPoint[]>([])
  const [nationalRefusalRate, setNationalRefusalRate] = useState(0)
  const [loadingHeatmap, setLoadingHeatmap] = useState(false)
  const [clusterMatches, setClusterMatches] = useState<ClusterMatch[]>([])
  const [loadingCluster, setLoadingCluster] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const [repairMsg, setRepairMsg] = useState('')
  const [mlAccuracy, setMlAccuracy] = useState<number | null>(null)
  const [mlTotalPredictions, setMlTotalPredictions] = useState(0)
  const [storeSettings, setStoreSettings] = useState<any>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncProgress, setSyncProgress] = useState<any>(null)
  const [syncingStatuses, setSyncingStatuses] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { fetchStores() }, [])

  useEffect(() => {
    if (selectedStore) { fetchCustomers(selectedStore); fetchAlerts(selectedStore) }
  }, [selectedStore, labelFilter])

  // Fetch data when switching to new tabs
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

  const fetchStores = async () => {
    try {
      const res = await fetch('/api/stores')
      const data = await res.json()
      const store = data.store || data.stores?.[0] || null
      const storeList = store ? [store] : []
      setStores(storeList)
      if (storeList.length > 0) setSelectedStore(storeList[0].id)
      else setLoading(false)
    } catch { setLoading(false) }
  }

  const fetchCustomers = async (sid?: string) => {
    const storeId = sid || selectedStore
    if (!storeId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ store_id: storeId, limit: '200' })
      if (labelFilter !== 'all') params.set('label', labelFilter)
      if (search) params.set('search', search)
      const res = await fetch(`/api/risk/customers?${params}`)
      const data = await res.json()
      setCustomers(data.customers || [])
      setStats(data.stats || {})
      if (data.unreadAlerts !== undefined) setUnreadAlerts(data.unreadAlerts)
    } catch { } finally { setLoading(false) }
  }

  const fetchAlerts = async (sid?: string) => {
    const storeId = sid || selectedStore
    if (!storeId) return
    try {
      const res = await fetch(`/api/risk/alerts?store_id=${storeId}&limit=100`)
      const data = await res.json()
      setAlerts(data.alerts || [])
      setUnreadAlerts(data.unread || 0)
    } catch { }
  }

  const openProfile = async (customer: Customer) => {
    setSelectedCustomer(customer)
    setEditNote(customer.operator_notes || '')
    setProfileTab('overview')
    setShowProfile(true)
    try {
      const res = await fetch(`/api/risk/orders?store_id=${selectedStore}&customer_id=${customer.id}&limit=50`)
      const data = await res.json()
      setCustomerOrders(data.orders || [])
    } catch { setCustomerOrders([]) }
  }

  // ── Sync All — importă toate comenzile din WooCommerce ───────────────────
  const syncAll = async () => {
    if (syncingAll) return
    setSyncingAll(true)
    setSyncProgress({ stage: 'init', message: 'Se conectează...' })

    try {
      const evtSource = new EventSource('/api/risk/sync-all')
      evtSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setSyncProgress(data)
          if (data.stage === 'done' || data.stage === 'error') {
            evtSource.close()
            setSyncingAll(false)
            if (data.stage === 'done') {
              // Reîncarcă datele
              fetchCustomers(selectedStore)
              fetchAlerts(selectedStore)
            }
          }
        } catch {}
      }
      evtSource.onerror = () => {
        evtSource.close()
        setSyncingAll(false)
        setSyncProgress({ stage: 'error', message: 'Conexiunea s-a întrerupt. Încearcă din nou.' })
      }
    } catch {
      setSyncingAll(false)
      setSyncProgress({ stage: 'error', message: 'Eroare la pornirea sincronizării.' })
    }
  }

  // ── Re-sync statusuri comenzi recente ────────────────────────────────────
  const syncStatuses = async () => {
    setSyncingStatuses(true)
    try {
      const res = await fetch('/api/cron/risk-sync-orders?manual=true')
      const data = await res.json()
      const r = data.results?.[0]
      if (r) {
        alert(`✓ ${r.ordersUpdated} statusuri actualizate, ${r.customersRecalculated} clienți recalculați.`)
        if (r.ordersUpdated > 0) fetchCustomers(selectedStore)
      } else {
        alert('Nicio actualizare necesară.')
      }
    } catch { alert('Eroare la sincronizarea statusurilor.') }
    setSyncingStatuses(false)
  }

  const runRepair = async () => {
    setRepairing(true)
    try {
      const res = await fetch('/api/risk/repair', { method: 'POST' })
      const data = await res.json()
      setRepairMsg(data.message || 'Reparare completă')
      setTimeout(() => setRepairMsg(''), 4000)
      fetchCustomers(selectedStore)
    } catch { setRepairMsg('Eroare la reparare') }
    setRepairing(false)
  }

  const saveNote = async () => {
    if (!selectedCustomer) return
    setSavingNote(true)
    try {
      const res = await fetch('/api/risk/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: selectedCustomer.id, operator_notes: editNote }),
      })
      if (res.ok) {
        setSelectedCustomer({ ...selectedCustomer, operator_notes: editNote })
        setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, operator_notes: editNote } : c))
        setNoteSaved(true)
        setTimeout(() => setNoteSaved(false), 2500)
      }
    } catch {}
    setSavingNote(false)
  }

  const importHistory = async () => {
    if (!selectedCustomer) return
    setImportingHistory(true)
    try {
      const res = await fetch('/api/risk/import-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: selectedCustomer.id }),
      })
      const data = await res.json()
      if (data.ok) {
        // Reîncarcă comenzile și clientul
        const ordersRes = await fetch(`/api/risk/orders?store_id=${selectedStore}&customer_id=${selectedCustomer.id}&limit=100`)
        const ordersData = await ordersRes.json()
        setCustomerOrders(ordersData.orders || [])
        // Actualizează datele clientului în listă
        setCustomers(prev => prev.map(c => c.id === selectedCustomer.id
          ? { ...c, risk_score: data.new_score, risk_label: data.new_label, total_orders: ordersData.orders?.length || c.total_orders }
          : c
        ))
        alert(`✓ Import complet: ${data.total_in_woocommerce} comenzi găsite în WooCommerce, ${data.imported} noi importate.`)
      } else {
        alert('Eroare: ' + (data.error || 'necunoscută'))
      }
    } catch (e) {
      alert('Eroare la import')
    }
    setImportingHistory(false)
  }

  const overrideLabel = async (customerId: string, label: string | null) => {
    await fetch('/api/risk/customers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customerId, label_override: label }),
    })
    // Dacă label e null, reîncărcăm clientul ca să obținem scorul real recalculat
    if (label === null) {
      await fetchCustomers(selectedStore)
      if (selectedCustomer?.id === customerId) {
        const res = await fetch(`/api/risk/customers?store_id=${selectedStore}&limit=200`)
        const data = await res.json()
        const updated = (data.customers || []).find((c: any) => c.id === customerId)
        if (updated) setSelectedCustomer(updated)
      }
    } else {
      setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, risk_label: label as any, manual_label_override: label } : c))
      if (selectedCustomer?.id === customerId) setSelectedCustomer(prev => prev ? { ...prev, risk_label: label as any, manual_label_override: label } : null)
    }
  }

  const fetchFinancial = async (period?: number) => {
    if (!selectedStore) return
    const p = period || financialPeriod
    setLoadingFinancial(true)
    try {
      const res = await fetch(`/api/risk/financial?store_id=${selectedStore}&period=${p}`)
      const data = await res.json()
      setFinancialData(data)
    } catch {}
    setLoadingFinancial(false)
  }

  const fetchHeatmap = async () => {
    if (!selectedStore) return
    setLoadingHeatmap(true)
    try {
      const res = await fetch(`/api/risk/heatmap?store_id=${selectedStore}&period=90`)
      const data = await res.json()
      setHeatmapData(data.heatmap || [])
      setNationalRefusalRate(data.nationalRefusalRate || 0)
    } catch {}
    setLoadingHeatmap(false)
  }

  const fetchClusterForCustomer = async (customerId: string) => {
    if (!selectedStore) return
    setLoadingCluster(true)
    try {
      const res = await fetch(`/api/risk/cluster?customer_id=${customerId}&store_id=${selectedStore}`)
      const data = await res.json()
      setClusterMatches(data.matches || [])
    } catch {}
    setLoadingCluster(false)
  }

  const fetchMLStats = async () => {
    if (!selectedStore) return
    try {
      const res = await fetch(`/api/risk/ml-calibrate?store_id=${selectedStore}`)
      const data = await res.json()
      setMlAccuracy(data.accuracy)
      setMlTotalPredictions(data.totalPredictions || 0)
    } catch {}
  }

  const fetchStoreSettings = async () => {
    if (!selectedStore) return
    try {
      const res = await fetch(`/api/risk/store-settings?store_id=${selectedStore}`)
      const data = await res.json()
      setStoreSettings(data.settings)
      setMlAccuracy(data.mlAccuracy)
      setMlTotalPredictions(data.mlTotalPredictions || 0)
    } catch {}
  }

  const saveStoreSettings = async (updates: any) => {
    if (!selectedStore) return
    setSavingSettings(true)
    try {
      await fetch('/api/risk/store-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStore, ...updates }),
      })
      setStoreSettings((prev: any) => ({ ...prev, ...updates }))
    } catch {}
    setSavingSettings(false)
  }

  const updateOrderStatus = async (orderId: string, status: string) => {
    setUpdatingOrder(orderId)
    await fetch('/api/risk/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, order_status: status }),
    })
    setCustomerOrders(prev => prev.map(o => o.id === orderId ? { ...o, order_status: status } : o))
    setUpdatingOrder(null)
    fetchCustomers()
  }

  const toggleBlacklist = async (value: boolean) => {
    if (!selectedCustomer) return
    await fetch('/api/risk/customers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: selectedCustomer.id, in_local_blacklist: value }),
    })
    setSelectedCustomer(prev => prev ? { ...prev, in_local_blacklist: value } : null)
    setCustomers(prev => prev.map(c => c.id === selectedCustomer.id ? { ...c, in_local_blacklist: value } : c))
  }

  const markAllAlertsRead = async () => {
    await fetch('/api/risk/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all_read: true }),
    })
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
    setUnreadAlerts(0)
  }

  const collectionRate = (c: Customer) => {
    if (c.total_orders === 0) return null
    return Math.round((c.orders_collected / c.total_orders) * 100)
  }

  const totalCustomers = Object.values(stats).reduce((s, v) => s + v, 0)
  const riskRate = totalCustomers > 0 ? Math.round(((stats.blocked || 0) + (stats.problematic || 0)) / totalCustomers * 100) : 0
  const watchRate = totalCustomers > 0 ? Math.round((stats.watch || 0) / totalCustomers * 100) : 0
  const trustedRate = totalCustomers > 0 ? Math.round(((stats.trusted || 0) + (stats.new || 0)) / totalCustomers * 100) : 0

  // Statistici calculate din lista de clienți încărcați
  const totalOrders = customers.reduce((s, c) => s + (c.total_orders || 0), 0)
  const totalCollected = customers.reduce((s, c) => s + (c.orders_collected || 0), 0)
  const totalRefused = customers.reduce((s, c) => s + (c.orders_refused || 0), 0)
  const totalNotHome = customers.reduce((s, c) => s + (c.orders_not_home || 0), 0)
  const globalCollectionRate = totalOrders > 0 ? Math.round((totalCollected / totalOrders) * 100) : 0
  const globalRefusalRate = totalOrders > 0 ? Math.round(((totalRefused + totalNotHome) / totalOrders) * 100) : 0
  const activeAlerts = alerts.filter(a => !a.is_resolved).length

  return (
    <div className="space-y-3 sm:space-y-5 pb-10 px-3 sm:px-0">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gray-900 flex items-center justify-center shadow-lg shadow-gray-900/20">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Risk Shield</h1>
            <p className="text-xs text-gray-400 mt-0.5">Protecție retururi COD · Detectare fraudă · Intelligence global</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {stores.length > 1 && (
            <select
              value={selectedStore}
              onChange={e => setSelectedStore(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 bg-white focus:outline-none"
            >
              {stores.map(s => <option key={s.id} value={s.id}>{s.store_url}</option>)}
            </select>
          )}
          <a
            href="/settings?tab=plugin"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Plugin WooCommerce
          </a>
          <button onClick={() => { fetchCustomers(); fetchAlerts() }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />Refresh
          </button>
          <button onClick={runRepair} disabled={repairing} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-200 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50">
            <Zap className="h-3.5 w-3.5" />{repairing ? 'Reparare...' : 'Repară Date'}
          </button>
          <button onClick={syncStatuses} disabled={syncingStatuses} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${syncingStatuses ? 'animate-spin' : ''}`} />{syncingStatuses ? 'Sincronizare...' : 'Sync Statusuri'}
          </button>
          <button onClick={syncAll} disabled={syncingAll} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm">
            <Download className={`h-3.5 w-3.5 ${syncingAll ? 'animate-bounce' : ''}`} />{syncingAll ? 'Import în curs...' : 'Import Complet WooCommerce'}
          </button>
          {repairMsg && <span className="text-xs text-green-600 font-medium">{repairMsg}</span>}
        </div>
      </motion.div>

      {/* ── Sync Progress Bar ── */}
      {syncProgress && syncProgress.stage !== 'done' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {syncProgress.stage === 'error'
                ? <AlertCircle className="h-4 w-4 text-red-500" />
                : <RefreshCw className="h-4 w-4 text-emerald-600 animate-spin" />
              }
              <span className={`text-sm font-semibold ${syncProgress.stage === 'error' ? 'text-red-700' : 'text-emerald-800'}`}>
                {syncProgress.message}
              </span>
            </div>
            {syncProgress.stage === 'done' || syncProgress.stage === 'error' ? (
              <button onClick={() => setSyncProgress(null)} className="text-xs text-gray-500 hover:text-gray-700">Închide</button>
            ) : null}
          </div>
          {syncProgress.totalPages > 0 && syncProgress.page && (
            <div className="w-full bg-emerald-200 rounded-full h-2 mb-2">
              <div
                className="bg-emerald-600 rounded-full h-2 transition-all duration-300"
                style={{ width: `${Math.round((syncProgress.page / syncProgress.totalPages) * 100)}%` }}
              />
            </div>
          )}
          {(syncProgress.inserted !== undefined || syncProgress.customersCreated !== undefined) && (
            <div className="flex gap-4 text-xs text-emerald-700">
              {syncProgress.inserted !== undefined && <span>{syncProgress.inserted} comenzi importate</span>}
              {syncProgress.customersCreated !== undefined && <span>{syncProgress.customersCreated} clienți noi</span>}
              {syncProgress.skipped !== undefined && <span>{syncProgress.skipped} skip</span>}
              {syncProgress.stage === 'recalculating' && syncProgress.total > 0 && (
                <span>Recalculare: {syncProgress.processed}/{syncProgress.total}</span>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2">
        {[
          { key: 'all', label: 'Total', value: totalCustomers, activeColor: '' },
          { key: 'blocked', label: 'Blocați', value: stats.blocked || 0, activeColor: 'text-red-400' },
          { key: 'problematic', label: 'Problematici', value: stats.problematic || 0, activeColor: 'text-orange-300' },
          { key: 'watch', label: 'Watch', value: stats.watch || 0, activeColor: 'text-amber-300' },
          { key: 'new', label: 'Noi', value: stats.new || 0, activeColor: '' },
          { key: 'trusted', label: 'Trusted', value: stats.trusted || 0, activeColor: 'text-emerald-400' },
        ].map((s, i) => {
          const idleColors: Record<string, string> = {
            all: 'text-gray-900', blocked: 'text-red-600', problematic: 'text-orange-600',
            watch: 'text-amber-600', new: 'text-gray-900', trusted: 'text-emerald-600',
          }
          const isActive = labelFilter === s.key && activeTab === 'customers'
          return (
            <motion.button
              key={s.key}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => { setLabelFilter(s.key); setActiveTab('customers') }}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                isActive ? 'bg-gray-900 border-gray-900 shadow-lg shadow-gray-900/20' : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <p className={`text-xl sm:text-2xl font-black ${isActive ? (s.activeColor || 'text-white') : idleColors[s.key]}`}>{s.value}</p>
              <p className={`text-[10px] mt-0.5 uppercase tracking-wide ${isActive ? 'text-gray-400' : 'text-gray-400'}`}>{s.label}</p>
            </motion.button>
          )
        })}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-full sm:w-fit overflow-x-auto">
        {[
          { key: 'customers', label: 'Clienți', icon: Users },
          { key: 'alerts', label: 'Alerte', icon: Bell, badge: unreadAlerts },
          { key: 'financial', label: 'Financiar', icon: DollarSign },
          { key: 'heatmap', label: 'Heatmap', icon: MapPin },
          { key: 'clusters', label: 'Clustere', icon: Network },
          { key: 'analytics', label: 'Analytics', icon: BarChart3 },
          { key: 'settings', label: 'Setări', icon: Settings },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.badge ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold min-w-[18px] text-center">{tab.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ══ TAB: CUSTOMERS ══════════════════════════════════════════════════════ */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Caută după telefon, email, nume..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-white shadow-sm"
            />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-3 sm:p-6 space-y-3">
                {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)}
              </div>
            ) : customers.length === 0 ? (
              <div className="py-20 text-center">
                <Shield className="h-10 w-10 text-gray-100 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Niciun client găsit</p>
                <p className="text-xs text-gray-300 mt-1">Clienții apar automat după prima comandă analizată</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                <div className="px-5 py-3 grid grid-cols-12 gap-3 text-[10px] text-gray-400 uppercase tracking-widest bg-gray-50/50">
                  <div className="col-span-4">Client</div>
                  <div className="col-span-2">Risc</div>
                  <div className="col-span-2 hidden lg:block">Scor</div>
                  <div className="col-span-2">Comenzi</div>
                  <div className="col-span-2 hidden md:block">Rată</div>
                </div>
                {customers.map((customer, i) => {
                  const rate = collectionRate(customer)
                  return (
                    <motion.div
                      key={customer.id}
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.015 }}
                      className="px-5 py-3.5 grid grid-cols-12 gap-3 items-center hover:bg-gray-50/70 transition-colors cursor-pointer"
                      onClick={() => openProfile(customer)}
                    >
                      <div className="col-span-4 flex items-center gap-3 min-w-0">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                          customer.risk_label === 'blocked' ? 'bg-red-600 text-white' :
                          customer.risk_label === 'problematic' ? 'bg-orange-500 text-white' :
                          customer.risk_label === 'watch' ? 'bg-amber-400 text-amber-900' :
                          customer.risk_label === 'trusted' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {(customer.name || customer.email || customer.phone || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{customer.name || '—'}</p>
                          <p className="text-[11px] text-gray-400 truncate">{customer.phone || customer.email || '—'}</p>
                        </div>
                        {(customer.in_local_blacklist || customer.in_global_blacklist) && (
                          <Ban className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        )}
                      </div>
                      <div className="col-span-2">
                        <RiskBadge label={customer.risk_label} />
                      </div>
                      <div className="col-span-2 hidden lg:block">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-14 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                customer.risk_score >= 81 ? 'bg-red-500' :
                                customer.risk_score >= 61 ? 'bg-orange-500' :
                                customer.risk_score >= 41 ? 'bg-amber-400' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${customer.risk_score}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-gray-500">{customer.risk_score}</span>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm font-bold text-gray-900">{customer.total_orders}</span>
                        <span className="text-[10px] text-gray-300 ml-1">comenzi</span>
                      </div>
                      <div className="col-span-2 hidden md:flex items-center gap-1.5">
                        {rate === null ? <span className="text-[11px] text-gray-300">—</span> : (
                          <>
                            <span className={`text-sm font-bold ${rate >= 70 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                              {rate}%
                            </span>
                            {rate < 50 && <TrendingDown className="h-3 w-3 text-red-400" />}
                            {rate >= 80 && <TrendingUp className="h-3 w-3 text-emerald-400" />}
                          </>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB: ALERTS ═══════════════════════════════════════════════════════ */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{alerts.length} alerte · {unreadAlerts} necitite</p>
            {unreadAlerts > 0 && (
              <button onClick={markAllAlertsRead} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                <Check className="h-3.5 w-3.5" />Marchează toate citite
              </button>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {alerts.length === 0 ? (
              <div className="py-20 text-center">
                <BellOff className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Nicio alertă activă</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {alerts.map((alert, i) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className={`flex items-start gap-3 px-3 sm:px-5 py-3 sm:py-4 hover:bg-gray-50/50 transition-colors ${!alert.is_read ? 'bg-amber-50/20' : ''}`}
                  >
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                      alert.severity === 'critical' ? 'bg-red-600 shadow-lg shadow-red-500/20' :
                      alert.severity === 'warning' ? 'bg-amber-100' : 'bg-gray-100'
                    }`}>
                      {alert.severity === 'critical' ? <Ban className="h-4 w-4 text-white" /> :
                       alert.severity === 'warning' ? <AlertTriangle className="h-4 w-4 text-amber-600" /> :
                       <Info className="h-4 w-4 text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-medium ${!alert.is_read ? 'text-gray-900' : 'text-gray-600'}`}>{alert.title}</p>
                        {!alert.is_read && <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                          alert.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>{alert.severity}</span>
                      </div>
                      {alert.description && <p className="text-xs text-gray-500 mt-0.5">{alert.description}</p>}
                    </div>
                    <span className="text-[10px] text-gray-300 shrink-0 font-mono">{timeAgo(alert.created_at)}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB: ANALYTICS ════════════════════════════════════════════════════ */}
      {/* ══ TAB: FINANCIAL ══════════════════════════════════════════════════════ */}
      {activeTab === 'financial' && (
        <div className="space-y-4">
          {/* Period selector */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Raport Financiar Pierderi</h2>
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {[7, 30, 90].map(p => (
                <button key={p}
                  onClick={() => { setFinancialPeriod(p); fetchFinancial(p) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${financialPeriod === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                >{p}z</button>
              ))}
            </div>
          </div>

          {loadingFinancial ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : financialData ? (
            <>
              {/* Total pierderi hero */}
              <div className="bg-gray-900 rounded-2xl p-5 text-white">
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Pierderi totale ({financialData.period} zile)</p>
                <div className="flex items-end gap-3 mb-4">
                  <p className="text-4xl font-black">{financialData.loss.totalLoss.toLocaleString()} RON</p>
                  {financialData.refusalRateChange !== 0 && (
                    <span className={`text-sm font-medium pb-1 flex items-center gap-1 ${financialData.refusalRateChange > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {financialData.refusalRateChange > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {Math.abs(financialData.refusalRateChange)}% față de perioada anterioară
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Valoare marfă', val: financialData.loss.productLoss },
                    { label: 'Transport dus', val: financialData.loss.shippingLoss },
                    { label: 'Transport întors', val: financialData.loss.returnShippingLoss },
                    { label: 'Reimpachetare', val: financialData.loss.repackagingLoss },
                  ].map(item => (
                    <div key={item.label} className="bg-white/10 rounded-xl p-3">
                      <p className="text-xl font-bold">{item.val.toLocaleString()}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                  <p className="text-2xl font-black text-emerald-600">{financialData.collectionRate}%</p>
                  <p className="text-xs text-gray-500 mt-1">Rată ridicare</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                  <p className={`text-2xl font-black ${financialData.refusalRate > 20 ? 'text-red-600' : 'text-gray-900'}`}>{financialData.refusalRate}%</p>
                  <p className="text-xs text-gray-500 mt-1">Rată refuz</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 col-span-2 sm:col-span-1">
                  <p className="text-2xl font-black text-emerald-700">{financialData.blockedValue.toLocaleString()} RON</p>
                  <p className="text-xs text-emerald-600 mt-1">💰 Pierderi evitate</p>
                </div>
              </div>

              {/* Proiecție lunară */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
                <AlertOctagon className="h-8 w-8 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-900">Proiecție lunară: {financialData.projectedMonthlyLoss.toLocaleString()} RON pierderi</p>
                  <p className="text-xs text-amber-700 mt-0.5">Calculat din ritmul ultimelor 7 zile · Fără intervenție Risk Shield</p>
                </div>
              </div>

              {/* Trending zilnic (mini chart) */}
              {financialData.daily.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Refuzuri zilnice</h3>
                  <div className="flex items-end gap-1 h-20">
                    {financialData.daily.slice(-30).map((d, i) => {
                      const maxVal = Math.max(...financialData.daily.slice(-30).map(x => x.refused), 1)
                      const h = d.refused > 0 ? Math.max((d.refused / maxVal) * 100, 8) : 2
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                          <div
                            className={`w-full rounded-t transition-all ${d.refused > 0 ? 'bg-red-400 group-hover:bg-red-500' : 'bg-gray-100'}`}
                            style={{ height: `${h}%` }}
                          />
                          <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                            {d.date.slice(5)}: {d.refused} refuzuri
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Top clienți cu pierderi */}
              {financialData.topLossCustomers.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-2xl p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Top clienți după pierderi cauzate</h3>
                  <div className="space-y-2">
                    {financialData.topLossCustomers.map((c, i) => (
                      <div key={c.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 cursor-pointer"
                        onClick={() => { const cust = customers.find(x => x.id === c.id); if (cust) openProfile(cust) }}>
                        <span className="text-xl font-black text-gray-200 w-6 text-center">{i+1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{c.name || c.phone || '—'}</p>
                          <p className="text-xs text-gray-400">{c.lossOrders} colete refuzate</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-red-600">{c.totalLoss.toLocaleString()} RON</p>
                          <RiskBadge label={c.risk_label as any} score={c.risk_score} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <DollarSign className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <button onClick={() => fetchFinancial()} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-xl">Încarcă datele financiare</button>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: HEATMAP ════════════════════════════════════════════════════════ */}
      {activeTab === 'heatmap' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Heatmap Geografic Risc</h2>
              <p className="text-xs text-gray-400 mt-0.5">Rată refuz pe județe · ultimele 90 zile</p>
            </div>
            <button onClick={fetchHeatmap} disabled={loadingHeatmap}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs hover:bg-gray-200 disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${loadingHeatmap ? 'animate-spin' : ''}`} />Actualizează
            </button>
          </div>

          {loadingHeatmap ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : heatmapData.length > 0 ? (
            <>
              {/* Legendă */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-400 inline-block" />Scăzut (&lt;15%)</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-400 inline-block" />Mediu (15-30%)</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-500 inline-block" />Ridicat (&gt;30%)</span>
                <span className="ml-auto text-gray-400">Media națională: <strong className="text-gray-600">{nationalRefusalRate}%</strong></span>
              </div>

              {/* Lista județe sortată */}
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 text-[11px] text-gray-500 uppercase tracking-wider px-4 py-2 bg-gray-50 border-b border-gray-100">
                  <span>Județ</span>
                  <span className="text-right pr-4">Comenzi</span>
                  <span className="text-right pr-4">Refuzuri</span>
                  <span className="text-right">Rată</span>
                </div>
                <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                  {heatmapData.map(point => (
                    <div key={point.county} className="grid grid-cols-[1fr_auto_auto_auto] gap-0 px-4 py-3 items-center hover:bg-gray-50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${point.riskLevel === 'high' ? 'bg-red-500' : point.riskLevel === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                          <span className="text-sm font-medium text-gray-900">{point.name}</span>
                        </div>
                        <div className="ml-4 mt-0.5 h-1.5 w-32 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${point.riskLevel === 'high' ? 'bg-red-400' : point.riskLevel === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'}`}
                            style={{ width: `${Math.min(point.refusalRate * 2, 100)}%` }} />
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 text-right pr-4">{point.total}</span>
                      <span className="text-xs text-gray-700 text-right pr-4">{point.refused}</span>
                      <span className={`text-sm font-bold text-right ${point.riskLevel === 'high' ? 'text-red-600' : point.riskLevel === 'medium' ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {point.refusalRate}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top 3 județe cu risc */}
              <div className="grid grid-cols-3 gap-2">
                {heatmapData.slice(0, 3).map((p, i) => (
                  <div key={p.county} className={`rounded-2xl p-3 border ${p.riskLevel === 'high' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                    <p className="text-[10px] text-gray-500 mb-1">#{i+1} risc maxim</p>
                    <p className="text-sm font-bold text-gray-900">{p.name}</p>
                    <p className={`text-xl font-black mt-1 ${p.riskLevel === 'high' ? 'text-red-600' : 'text-amber-600'}`}>{p.refusalRate}%</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{p.refused}/{p.total} comenzi</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <MapPin className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400 mb-3">Nu există date suficiente pentru heatmap</p>
              <p className="text-xs text-gray-300">Adresele din comenzile tale trebuie să conțină numele orașului</p>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: CLUSTERS ═══════════════════════════════════════════════════════ */}
      {activeTab === 'clusters' && (
        <ClusterTab storeId={selectedStore} customers={customers} onOpenProfile={(id) => { const c = customers.find(x => x.id === id); if (c) openProfile(c) }} />
      )}

      {/* ══ TAB: SETTINGS ═══════════════════════════════════════════════════════ */}
      {activeTab === 'settings' && (
        <SettingsTab
          settings={storeSettings}
          mlAccuracy={mlAccuracy}
          mlTotalPredictions={mlTotalPredictions}
          savingSettings={savingSettings}
          onSave={saveStoreSettings}
        />
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <StatCard label="Rată risc ridicat" value={`${riskRate}%`} sub={`${(stats.blocked||0) + (stats.problematic||0)} clienți`} color={riskRate > 20 ? 'text-red-600' : 'text-gray-900'} icon={AlertTriangle} />
            <StatCard label="Rată ridicare comenzi" value={`${globalCollectionRate}%`} sub={`${totalCollected} din ${totalOrders} comenzi`} color={globalCollectionRate < 60 ? 'text-orange-600' : 'text-emerald-600'} icon={Shield} />
            <StatCard label="Rată refuzuri" value={`${globalRefusalRate}%`} sub={`${totalRefused} refuzate · ${totalNotHome} absent`} color={globalRefusalRate > 20 ? 'text-red-600' : 'text-gray-900'} icon={Eye} />
            <StatCard label="Alerte active" value={activeAlerts} sub={`${unreadAlerts} necitite`} color={activeAlerts > 0 ? 'text-red-600' : 'text-gray-900'} icon={Bell} />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Distribuție Risc Clienți</h3>
            <div className="space-y-3">
              {[
                { key: 'blocked', label: 'Blocat', color: 'bg-red-500', textColor: 'text-red-600' },
                { key: 'problematic', label: 'Problematic', color: 'bg-orange-400', textColor: 'text-orange-600' },
                { key: 'watch', label: 'Watch', color: 'bg-amber-400', textColor: 'text-amber-600' },
                { key: 'new', label: 'Nou', color: 'bg-blue-200', textColor: 'text-blue-600' },
                { key: 'trusted', label: 'Trusted', color: 'bg-emerald-400', textColor: 'text-emerald-600' },
              ].map(item => {
                const val = stats[item.key] || 0
                const pct = totalCustomers > 0 ? (val / totalCustomers) * 100 : 0
                return (
                  <div key={item.key} className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-500 w-24 shrink-0">{item.label}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className={`h-full rounded-full ${item.color}`}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 w-24 justify-end">
                      <span className={`text-sm font-bold ${item.textColor}`}>{val}</span>
                      <span className="text-[10px] text-gray-400">({pct.toFixed(0)}%)</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Top 5 Clienți cu Risc Maxim</h3>
            {customers.filter(c => c.risk_label === 'blocked' || c.risk_label === 'problematic').length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="h-8 w-8 text-emerald-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Niciun client cu risc ridicat</p>
              </div>
            ) : (
              <div className="space-y-2">
                {customers
                  .filter(c => c.risk_label === 'blocked' || c.risk_label === 'problematic')
                  .sort((a, b) => b.risk_score - a.risk_score)
                  .slice(0, 5)
                  .map((c, i) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => openProfile(c)}
                    >
                      <span className="text-2xl font-black text-gray-100 w-7 text-center leading-none">{i + 1}</span>
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${c.risk_label === 'blocked' ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}`}>
                        {(c.name || c.email || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.name || '—'}</p>
                        <p className="text-[11px] text-gray-400 truncate">{c.phone || c.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <RiskBadge label={c.risk_label} score={c.risk_score} />
                        <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ CUSTOMER PROFILE PANEL ════════════════════════════════════════════ */}
      <AnimatePresence>
        {showProfile && selectedCustomer && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setShowProfile(false)}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed inset-0 sm:right-0 sm:left-auto sm:top-0 h-full w-full sm:max-w-xl bg-white z-50 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Panel Header */}
              <div className="bg-white border-b border-gray-100 px-4 py-3 sm:px-5 sm:py-4 flex items-start justify-between shrink-0">
                <div className="flex items-start gap-3">
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${
                    selectedCustomer.risk_label === 'blocked' ? 'bg-red-600 text-white shadow-lg shadow-red-500/30' :
                    selectedCustomer.risk_label === 'problematic' ? 'bg-orange-500 text-white shadow-lg shadow-orange-400/30' :
                    selectedCustomer.risk_label === 'watch' ? 'bg-amber-400 text-amber-900' :
                    selectedCustomer.risk_label === 'trusted' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {(selectedCustomer.name || selectedCustomer.email || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900">{selectedCustomer.name || 'Client necunoscut'}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <RiskBadge label={selectedCustomer.risk_label} score={selectedCustomer.risk_score} />
                      {selectedCustomer.in_global_blacklist && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full">
                          <Globe className="h-2.5 w-2.5" />Global BL
                        </span>
                      )}
                      {selectedCustomer.in_local_blacklist && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-gray-900 text-white px-2 py-0.5 rounded-full">
                          <Ban className="h-2.5 w-2.5" />Blacklist local
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowProfile(false)} className="h-8 w-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              {/* Profile Sub-tabs */}
              <div className="flex gap-0 border-b border-gray-100 px-3 sm:px-5 shrink-0 bg-gray-50/50 overflow-x-auto scrollbar-none">
                {[
                  { key: 'overview', label: 'Profil' },
                  { key: 'timeline', label: 'Istoric' },
                  { key: 'addresses', label: 'Adrese' },
                  { key: '360', label: '360°' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setProfileTab(tab.key as any)
                      if (tab.key === '360' && selectedCustomer) {
                        fetchClusterForCustomer(selectedCustomer.id)
                      }
                    }}
                    className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                      profileTab === tab.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto">

                {/* ── OVERVIEW ── */}
                {profileTab === 'overview' && (
                  <div className="p-5 space-y-5">
                    {/* Score ring + contact */}
                    <div className="flex items-start gap-5">
                      <ScoreRing score={selectedCustomer.risk_score} size={90} />
                      <div className="flex-1 space-y-2">
                        {selectedCustomer.phone && (
                          <a href={`tel:${selectedCustomer.phone}`} className="flex items-center gap-2 text-sm hover:text-blue-600 transition-colors group">
                            <Phone className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-500 shrink-0" />
                            <span className="text-gray-700 font-medium">{selectedCustomer.phone}</span>
                          </a>
                        )}
                        {selectedCustomer.email && (
                          <a href={`mailto:${selectedCustomer.email}`} className="flex items-center gap-2 text-sm hover:text-blue-600 transition-colors group">
                            <Mail className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-500 shrink-0" />
                            <span className="text-gray-700 truncate">{selectedCustomer.email}</span>
                          </a>
                        )}
                        {selectedCustomer.first_order_at && (
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            <span>Client din {new Date(selectedCustomer.first_order_at).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })}</span>
                          </div>
                        )}
                        {selectedCustomer.last_order_at && (
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span>Ultima comandă acum {timeAgo(selectedCustomer.last_order_at)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Badges */}
                    <CustomerBadges customer={selectedCustomer} />

                    {/* Behavior bars */}
                    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                      <h4 className="text-[11px] text-gray-400 uppercase tracking-widest">Comportament Comenzi</h4>
                      <BehaviorBar label="Ridicate" value={selectedCustomer.orders_collected} max={selectedCustomer.total_orders} color="bg-emerald-500" />
                      <BehaviorBar label="Refuzate" value={selectedCustomer.orders_refused} max={selectedCustomer.total_orders} color="bg-red-500" />
                      <BehaviorBar label="Absent la livrare" value={selectedCustomer.orders_not_home} max={selectedCustomer.total_orders} color="bg-amber-400" />
                      <BehaviorBar label="Anulate" value={selectedCustomer.orders_cancelled} max={selectedCustomer.total_orders} color="bg-gray-300" />
                      <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                        <span className="text-[11px] text-gray-500">Rată ridicare globală</span>
                        <span className={`text-xl font-black ${
                          (collectionRate(selectedCustomer) ?? 100) >= 70 ? 'text-emerald-600' :
                          (collectionRate(selectedCustomer) ?? 100) >= 50 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {collectionRate(selectedCustomer) !== null ? `${collectionRate(selectedCustomer)}%` : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Loss calculator */}
                    {customerOrders.length > 0 && <LossCalculator customer={selectedCustomer} orders={customerOrders} />}

                    {/* Override label */}
                    <div>
                      <p className="text-[11px] text-gray-400 uppercase tracking-widest mb-2.5">Etichetă Manuală</p>
                      <div className="flex flex-wrap gap-2">
                        {(['trusted', 'watch', 'problematic', 'blocked'] as const).map(l => {
                          const styles: Record<string, { idle: string; active: string }> = {
                            trusted: { idle: 'border-gray-200 text-gray-500 hover:border-emerald-200 hover:text-emerald-700', active: 'bg-emerald-600 text-white border-emerald-600' },
                            watch: { idle: 'border-gray-200 text-gray-500 hover:border-amber-200 hover:text-amber-700', active: 'bg-amber-500 text-white border-amber-500' },
                            problematic: { idle: 'border-gray-200 text-gray-500 hover:border-orange-200 hover:text-orange-700', active: 'bg-orange-500 text-white border-orange-500' },
                            blocked: { idle: 'border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-700', active: 'bg-red-600 text-white border-red-600' },
                          }
                          const isActive = selectedCustomer.risk_label === l
                          return (
                            <button
                              key={l}
                              onClick={() => overrideLabel(selectedCustomer.id, l)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${isActive ? styles[l].active : styles[l].idle}`}
                            >
                              {LABEL_CONFIG[l].label}
                            </button>
                          )
                        })}
                      </div>
                      {selectedCustomer.manual_label_override && (
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-[10px] text-amber-500 flex items-center gap-1">
                            <Pencil className="h-2.5 w-2.5" />Override manual activ
                          </p>
                          <button
                            onClick={() => overrideLabel(selectedCustomer.id, null as any)}
                            className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                          >
                            <X className="h-2.5 w-2.5" />Șterge eticheta
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Operator note */}
                    <div>
                      <p className="text-[11px] text-gray-400 uppercase tracking-widest mb-2.5">Note Operator</p>
                      <textarea
                        value={editNote}
                        onChange={e => setEditNote(e.target.value)}
                        placeholder="Adaugă note interne despre acest client..."
                        rows={3}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 resize-none text-gray-700 bg-gray-50"
                      />
                      <button
                        onClick={saveNote}
                        disabled={savingNote}
                        className={`mt-2 px-4 py-2 rounded-xl text-white text-xs transition-all disabled:opacity-50 font-medium flex items-center gap-1.5 ${noteSaved ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-900 hover:bg-gray-800'}`}
                      >
                        {savingNote ? (
                          <><RefreshCw className="h-3 w-3 animate-spin" />Salvare...</>
                        ) : noteSaved ? (
                          <><CheckCircle2 className="h-3 w-3" />Salvat!</>
                        ) : (
                          'Salvează nota'
                        )}
                      </button>
                    </div>

                    {/* Blacklist */}
                    <div className="pt-2 border-t border-gray-100">
                      <button
                        onClick={() => toggleBlacklist(!selectedCustomer.in_local_blacklist)}
                        className={`w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl text-sm font-semibold transition-all ${
                          selectedCustomer.in_local_blacklist
                            ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                            : 'border-2 border-gray-900 text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <Ban className="h-4 w-4" />
                        {selectedCustomer.in_local_blacklist ? '✓ Eliminat din Blacklist' : 'Adaugă în Blacklist'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── TIMELINE ── */}
                {profileTab === 'timeline' && (
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">Istoricul Comenzilor</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-400 font-mono bg-gray-100 px-2.5 py-1 rounded-full">{customerOrders.length} comenzi</span>
                        <button
                          onClick={importHistory}
                          disabled={importingHistory}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-[11px] font-medium hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${importingHistory ? 'animate-spin' : ''}`} />
                          {importingHistory ? 'Se importă...' : 'Sincronizează WooCommerce'}
                        </button>
                      </div>
                    </div>
                    {customerOrders.length === 0 ? (
                      <div className="py-12 text-center">
                        <Package className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                        <p className="text-sm text-gray-400 mb-3">Nicio comandă înregistrată</p>
                        <button
                          onClick={importHistory}
                          disabled={importingHistory}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors mx-auto disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${importingHistory ? 'animate-spin' : ''}`} />
                          {importingHistory ? 'Se importă din WooCommerce...' : 'Importă istoricul din WooCommerce'}
                        </button>
                      </div>
                    ) : (
                      <Timeline orders={customerOrders} onUpdateStatus={updateOrderStatus} updatingOrder={updatingOrder} />
                    )}
                  </div>
                )}

                {/* ── ADDRESSES ── */}
                {profileTab === 'addresses' && (
                  <div className="p-5 space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900">Adrese de Livrare Utilizate</h4>
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3.5 flex items-start gap-2.5">
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 leading-relaxed">Adresele multiple sau problematice pot indica comportament de testare sau fraudă la livrare.</p>
                    </div>
                    <AddressMap orders={customerOrders} />
                  </div>
                )}

                {/* ── 360° ── */}
                {profileTab === '360' && (
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">Identități Similare Detectate</h4>
                      <button
                        onClick={() => selectedCustomer && fetchClusterForCustomer(selectedCustomer.id)}
                        disabled={loadingCluster}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3 w-3 ${loadingCluster ? 'animate-spin' : ''}`} />
                        Reanalizeaza
                      </button>
                    </div>

                    {loadingCluster ? (
                      <div className="flex items-center justify-center py-12">
                        <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
                      </div>
                    ) : clusterMatches.length === 0 ? (
                      <div className="text-center py-10 space-y-2">
                        <div className="h-12 w-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto">
                          <CheckCircle2 className="h-6 w-6 text-green-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-700">Nicio identitate similară</p>
                        <p className="text-xs text-gray-400">Clientul nu pare să aibă conturi duplicate detectate.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3.5 flex items-start gap-2.5">
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700 leading-relaxed">
                            <strong>{clusterMatches.length} identități similare</strong> detectate — pot fi același client cu date diferite.
                          </p>
                        </div>
                        {clusterMatches.map((match: any, i: number) => (
                          <div key={i} className="border border-gray-100 rounded-2xl p-4 space-y-3 bg-white">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${match.similarity >= 0.9 ? 'bg-red-500' : 'bg-amber-400'}`} />
                                <span className="text-sm font-medium text-gray-900">{match.customer?.name || 'Client necunoscut'}</span>
                              </div>
                              <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                                {Math.round((match.similarity || 0) * 100)}% similar
                              </span>
                            </div>
                            <div className="space-y-1">
                              {match.customer?.phone && (
                                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                  <Phone className="h-3 w-3" />{match.customer.phone}
                                </p>
                              )}
                              {match.customer?.email && (
                                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                  <Mail className="h-3 w-3" />{match.customer.email}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-400">
                              <span>{match.customer?.total_orders || 0} comenzi</span>
                              <span>{match.customer?.orders_refused || 0} refuzuri</span>
                              {match.customer?.risk_label && (
                                <span className={`px-2 py-0.5 rounded-full font-medium ${
                                  match.customer.risk_label === 'blocked' ? 'bg-red-100 text-red-700' :
                                  match.customer.risk_label === 'problematic' ? 'bg-orange-100 text-orange-700' :
                                  match.customer.risk_label === 'watch' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-green-100 text-green-700'
                                }`}>{match.customer.risk_label}</span>
                              )}
                            </div>
                            {match.matchReason?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {match.matchReason.map((r: string, j: number) => (
                                  <span key={j} className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{r}</span>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={() => {
                                const c = match.customer
                                if (c) openProfile({ ...c, store_id: selectedCustomer?.store_id || '', in_local_blacklist: false, in_global_blacklist: false, manually_reviewed: false, operator_notes: null, manual_label_override: null, last_order_at: null, first_order_at: null })
                              }}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                            >
                              <ArrowUpRight className="h-3 w-3" />Deschide profil
                            </button>
                          </div>
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