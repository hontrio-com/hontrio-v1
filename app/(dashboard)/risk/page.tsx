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

function IntelligenceReport({ customer, orders }: { customer: Customer; orders: Order[] }) {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<string | null>(null)

  const generate = async () => {
    setLoading(true)
    const rate = customer.total_orders > 0 ? Math.round((customer.orders_collected / customer.total_orders) * 100) : 0
    const context = `
Client: ${customer.name || 'Necunoscut'} | Tel: ${customer.phone || '-'} | Email: ${customer.email || '-'}
Scor risc: ${customer.risk_score}/100 | Label: ${customer.risk_label}
Total comenzi: ${customer.total_orders} | Ridicate: ${customer.orders_collected} | Refuzate: ${customer.orders_refused} | Absent: ${customer.orders_not_home} | Anulate: ${customer.orders_cancelled}
Rată ridicare: ${rate}%
Blacklist local: ${customer.in_local_blacklist ? 'DA' : 'NU'} | Blacklist global: ${customer.in_global_blacklist ? 'DA' : 'NU'}
Note operator: ${customer.operator_notes || 'Nicio notă'}
Ultimele comenzi: ${orders.slice(0, 8).map(o => `#${o.order_number || o.external_order_id} ${o.total_value} RON ${o.order_status} ${o.payment_method} ${o.shipping_address || ''}`).join(' | ')}
    `.trim()

    try {
      const res = await fetch('/api/risk/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_context: context, customer_id: customer.id }),
      })
      const data = await res.json()
      setReport(data.report || 'Nu s-a putut genera raportul.')
    } catch {
      setReport('Eroare la generarea raportului. Verificați conexiunea.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {!report && !loading && (
        <button
          onClick={generate}
          className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-gradient-to-r from-gray-900 to-gray-700 text-white text-sm font-semibold hover:from-gray-800 hover:to-gray-600 transition-all shadow-lg shadow-gray-900/20"
        >
          <Brain className="h-4 w-4" />
          Generează Raport Intelligence AI
          <span className="text-[10px] opacity-50 ml-0.5">~2 credite</span>
        </button>
      )}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-10">
          <div className="h-8 w-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">Analizez comportamentul...</p>
            <p className="text-xs text-gray-400 mt-1">Verificare blacklist global · Pattern analysis · Risk prediction</p>
          </div>
        </div>
      )}
      {report && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-50 rounded-2xl border border-gray-200 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-xl bg-gray-900 flex items-center justify-center">
                <Brain className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-900">Raport Intelligence</span>
                <span className="text-[10px] text-gray-400 ml-2">generat acum</span>
              </div>
            </div>
            <button onClick={() => setReport(null)} className="text-gray-300 hover:text-gray-500 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{report}</p>
          <button
            onClick={generate}
            className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />Regenerează
          </button>
        </motion.div>
      )}
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
  const [activeTab, setActiveTab] = useState<'customers' | 'alerts' | 'analytics'>('customers')
  const [profileTab, setProfileTab] = useState<'overview' | 'timeline' | 'addresses' | 'intel'>('overview')
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  const [editNote, setEditNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { fetchStores() }, [])
  useEffect(() => { if (selectedStore) { fetchCustomers(); fetchAlerts() } }, [selectedStore, labelFilter])

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => { if (selectedStore) fetchCustomers() }, 350)
    return () => { if (searchRef.current) clearTimeout(searchRef.current) }
  }, [search])

  const fetchStores = async () => {
    try {
      const res = await fetch('/api/stores')
      const data = await res.json()
      const storeList = data.stores || data || []
      setStores(storeList)
      if (storeList.length > 0) setSelectedStore(storeList[0].id)
    } catch { setLoading(false) }
  }

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ store_id: selectedStore, limit: '100' })
      if (labelFilter !== 'all') params.set('label', labelFilter)
      if (search) params.set('search', search)
      const res = await fetch(`/api/risk/customers?${params}`)
      const data = await res.json()
      setCustomers(data.customers || [])
      setStats(data.stats || {})
    } catch { } finally { setLoading(false) }
  }

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`/api/risk/alerts?store_id=${selectedStore}&limit=50`)
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

  const saveNote = async () => {
    if (!selectedCustomer) return
    setSavingNote(true)
    await fetch('/api/risk/customers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: selectedCustomer.id, operator_notes: editNote }),
    })
    setSelectedCustomer({ ...selectedCustomer, operator_notes: editNote })
    setSavingNote(false)
  }

  const overrideLabel = async (customerId: string, label: string) => {
    await fetch('/api/risk/customers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customerId, label_override: label }),
    })
    setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, risk_label: label as any, manual_label_override: label } : c))
    if (selectedCustomer?.id === customerId) setSelectedCustomer(prev => prev ? { ...prev, risk_label: label as any } : null)
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

  return (
    <div className="space-y-5 pb-10">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gray-900 flex items-center justify-center shadow-lg shadow-gray-900/20">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Return Risk Shield</h1>
            <p className="text-xs text-gray-400 mt-0.5">Protecție retururi COD · Detectare fraudă · Intelligence global</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {stores.length > 1 && (
            <select
              value={selectedStore}
              onChange={e => setSelectedStore(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 bg-white focus:outline-none"
            >
              {stores.map(s => <option key={s.id} value={s.id}>{s.store_url}</option>)}
            </select>
          )}
          <button onClick={() => { fetchCustomers(); fetchAlerts() }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />Refresh
          </button>
        </div>
      </motion.div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
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
              <p className={`text-2xl font-black ${isActive ? (s.activeColor || 'text-white') : idleColors[s.key]}`}>{s.value}</p>
              <p className={`text-[10px] mt-0.5 uppercase tracking-wide ${isActive ? 'text-gray-400' : 'text-gray-400'}`}>{s.label}</p>
            </motion.button>
          )
        })}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
        {[
          { key: 'customers', label: 'Clienți', icon: Users },
          { key: 'alerts', label: 'Alerte', icon: Bell, badge: unreadAlerts },
          { key: 'analytics', label: 'Analytics', icon: BarChart3 },
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
              <div className="p-6 space-y-3">
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
                    className={`flex items-start gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors ${!alert.is_read ? 'bg-amber-50/20' : ''}`}
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
      {activeTab === 'analytics' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Rată risc ridicat" value={`${riskRate}%`} sub="Blocat + Problematic" color={riskRate > 20 ? 'text-red-600' : 'text-gray-900'} icon={AlertTriangle} />
            <StatCard label="Sub monitorizare" value={`${watchRate}%`} sub="Label Watch" color={watchRate > 30 ? 'text-amber-600' : 'text-gray-900'} icon={Eye} />
            <StatCard label="Clienți de încredere" value={`${trustedRate}%`} sub="Trusted + Noi" color="text-emerald-600" icon={Shield} />
            <StatCard label="Alerte active" value={alerts.filter(a => !a.is_resolved).length} sub={`${unreadAlerts} necitite`} icon={Bell} />
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
              className="fixed right-0 top-0 h-full w-full max-w-xl bg-white z-50 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Panel Header */}
              <div className="bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between shrink-0">
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
              <div className="flex gap-0 border-b border-gray-100 px-5 shrink-0 bg-gray-50/50 overflow-x-auto">
                {[
                  { key: 'overview', label: 'Profil' },
                  { key: 'timeline', label: 'Istoric' },
                  { key: 'addresses', label: 'Adrese' },
                  { key: 'intel', label: '🧠 Intelligence' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setProfileTab(tab.key as any)}
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
                        <p className="text-[10px] text-amber-500 mt-2 flex items-center gap-1">
                          <Pencil className="h-2.5 w-2.5" />Override manual activ
                        </p>
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
                        className="mt-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs hover:bg-gray-800 transition-colors disabled:opacity-50 font-medium"
                      >
                        {savingNote ? 'Salvare...' : 'Salvează nota'}
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
                      <span className="text-[11px] text-gray-400 font-mono bg-gray-100 px-2.5 py-1 rounded-full">{customerOrders.length} comenzi</span>
                    </div>
                    {customerOrders.length === 0 ? (
                      <div className="py-12 text-center">
                        <Package className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">Nicio comandă înregistrată</p>
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

                {/* ── INTELLIGENCE ── */}
                {profileTab === 'intel' && (
                  <div className="p-5 space-y-5">
                    <div className="flex items-start gap-3 bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl p-4 text-white">
                      <Brain className="h-5 w-5 shrink-0 mt-0.5 text-gray-300" />
                      <div>
                        <p className="text-sm font-semibold">Analiză Comportamentală AI</p>
                        <p className="text-xs text-gray-300 mt-1 leading-relaxed">Raport complet bazat pe istoricul comenzilor, pattern-uri de comportament și comparație cu baza de date globală Hontrio.</p>
                      </div>
                    </div>

                    <IntelligenceReport customer={selectedCustomer} orders={customerOrders} />

                    {/* Risk factors */}
                    <div className="bg-gray-50 rounded-2xl p-4">
                      <h4 className="text-[11px] text-gray-400 uppercase tracking-widest mb-3">Factori de Risc Detectați</h4>
                      <div className="space-y-2">
                        {[
                          { condition: selectedCustomer.orders_refused >= 2, label: `${selectedCustomer.orders_refused} colete refuzate`, severity: 'high' },
                          { condition: selectedCustomer.orders_not_home >= 3, label: `${selectedCustomer.orders_not_home} livrări eșuate`, severity: 'medium' },
                          { condition: (collectionRate(selectedCustomer) ?? 100) < 50, label: `Rată ridicare scăzută: ${collectionRate(selectedCustomer)}%`, severity: 'high' },
                          { condition: selectedCustomer.in_global_blacklist, label: 'Prezent în blacklist global Hontrio', severity: 'critical' },
                          { condition: selectedCustomer.in_local_blacklist, label: 'Blocat manual în magazinul tău', severity: 'high' },
                          { condition: selectedCustomer.orders_cancelled >= 3, label: `${selectedCustomer.orders_cancelled} comenzi anulate`, severity: 'medium' },
                        ].filter(f => f.condition).map((f, i) => (
                          <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-gray-100">
                            <div className={`h-2 w-2 rounded-full shrink-0 ${f.severity === 'critical' ? 'bg-red-600' : f.severity === 'high' ? 'bg-orange-500' : 'bg-amber-400'}`} />
                            <span className="text-xs text-gray-700 flex-1">{f.label}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              f.severity === 'critical' ? 'bg-red-100 text-red-700' :
                              f.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>{f.severity}</span>
                          </div>
                        ))}
                        {selectedCustomer.orders_refused < 2 && selectedCustomer.orders_not_home < 3 &&
                         (collectionRate(selectedCustomer) ?? 100) >= 50 && !selectedCustomer.in_global_blacklist && !selectedCustomer.in_local_blacklist && (
                          <p className="text-xs text-emerald-600 flex items-center gap-2 p-2">
                            <CheckCircle2 className="h-3.5 w-3.5" />Niciun factor de risc major detectat
                          </p>
                        )}
                      </div>
                    </div>
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