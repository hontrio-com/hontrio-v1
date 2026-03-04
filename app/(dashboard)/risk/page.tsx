'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, AlertTriangle, Bell, BellOff, Users, Package,
  RefreshCw, Search, ChevronDown, X, Check, Eye,
  Phone, Mail, MapPin, Calendar, Clock, TrendingDown,
  Info, Ban, CheckCircle2, CircleDot, Pencil, Filter,
  ArrowUpRight, ChevronRight, Minus,
} from 'lucide-react'
import { LABEL_CONFIG } from '@/lib/risk/engine'

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

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Așteptare', processing: 'Procesare', shipped: 'Expediat',
  collected: 'Ridicat ✓', refused: 'Refuzat ✗', not_home: 'Absent',
  cancelled: 'Anulat', returned: 'Returnat',
}

const ORDER_STATUS_STYLE: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  processing: 'bg-gray-200 text-gray-700',
  shipped: 'bg-gray-300 text-gray-800',
  collected: 'bg-gray-100 text-gray-700',
  refused: 'bg-gray-900 text-white',
  not_home: 'bg-gray-200 text-gray-600',
  cancelled: 'bg-gray-700 text-white',
  returned: 'bg-gray-800 text-white',
}

function RiskBadge({ label, score }: { label: keyof typeof LABEL_CONFIG; score?: number }) {
  const cfg = LABEL_CONFIG[label] || LABEL_CONFIG.new
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
      {score !== undefined && <span className="opacity-60 ml-0.5">· {score}</span>}
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${score >= 81 ? 'bg-gray-900' : score >= 61 ? 'bg-gray-700' : score >= 41 ? 'bg-gray-400' : 'bg-gray-200'}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-mono text-gray-500">{score}</span>
    </div>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}z`
}

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
  const [editNote, setEditNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  const [activeTab, setActiveTab] = useState<'customers' | 'alerts'>('customers')
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)

  useEffect(() => { fetchStores() }, [])
  useEffect(() => { if (selectedStore) { fetchCustomers(); fetchAlerts() } }, [selectedStore, labelFilter, search])

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
      const params = new URLSearchParams({ store_id: selectedStore, limit: '50' })
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
      const res = await fetch(`/api/risk/alerts?store_id=${selectedStore}&limit=30`)
      const data = await res.json()
      setAlerts(data.alerts || [])
      setUnreadAlerts(data.unread || 0)
    } catch { }
  }

  const openProfile = async (customer: Customer) => {
    setSelectedCustomer(customer)
    setEditNote(customer.operator_notes || '')
    setShowProfile(true)
    const res = await fetch(`/api/risk/orders?store_id=${selectedStore}&customer_id=${customer.id}&limit=20`)
    const data = await res.json()
    setCustomerOrders(data.orders || [])
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

  const LABELS = ['all', 'blocked', 'problematic', 'watch', 'new', 'trusted'] as const

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gray-900 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Return Risk Shield</h1>
            <p className="text-xs text-gray-400 mt-0.5 font-sans">Detectare clienți problematici · Protecție retururi COD</p>
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

      {/* Stats row */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { key: 'all', label: 'Total', value: Object.values(stats).reduce((s, v) => s + v, 0) },
          { key: 'blocked', label: 'Blocați', value: stats.blocked || 0 },
          { key: 'problematic', label: 'Problematici', value: stats.problematic || 0 },
          { key: 'watch', label: 'Watch', value: stats.watch || 0 },
          { key: 'new', label: 'Noi', value: stats.new || 0 },
          { key: 'trusted', label: 'Trusted', value: stats.trusted || 0 },
        ].map((s, i) => (
          <motion.button
            key={s.key}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            onClick={() => { setLabelFilter(s.key); setActiveTab('customers') }}
            className={`p-3 rounded-2xl border text-left transition-all ${labelFilter === s.key && activeTab === 'customers' ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-100 hover:border-gray-300'}`}
          >
            <p className={`text-xl font-bold ${labelFilter === s.key && activeTab === 'customers' ? 'text-white' : 'text-gray-900'}`}>{s.value}</p>
            <p className={`text-[10px] mt-0.5 ${labelFilter === s.key && activeTab === 'customers' ? 'text-gray-300' : 'text-gray-400'}`}>{s.label}</p>
          </motion.button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-100 pb-0">
        {[
          { key: 'customers', label: 'Clienți', count: customers.length },
          { key: 'alerts', label: 'Alerte', count: unreadAlerts },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Customers Tab */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Caută după telefon, email, nume..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 font-sans"
              />
            </div>
          </div>

          {/* Customer list */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)}
              </div>
            ) : customers.length === 0 ? (
              <div className="py-16 text-center">
                <Shield className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400 font-sans">Niciun client găsit</p>
                <p className="text-xs text-gray-300 mt-1 font-sans">Clienții apar automat la prima comandă analizată</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {/* Header */}
                <div className="px-5 py-2.5 grid grid-cols-12 gap-3 text-[10px] text-gray-400 uppercase tracking-widest">
                  <div className="col-span-3">Client</div>
                  <div className="col-span-2">Risc</div>
                  <div className="col-span-2">Scor</div>
                  <div className="col-span-2">Comenzi</div>
                  <div className="col-span-2">Rată ridicare</div>
                  <div className="col-span-1"></div>
                </div>
                {customers.map((customer, i) => {
                  const rate = collectionRate(customer)
                  return (
                    <motion.div
                      key={customer.id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                      className="px-5 py-3.5 grid grid-cols-12 gap-3 items-center hover:bg-gray-50/50 transition-colors cursor-pointer"
                      onClick={() => openProfile(customer)}
                    >
                      <div className="col-span-3 flex items-center gap-2.5 min-w-0">
                        <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${customer.risk_label === 'blocked' ? 'bg-gray-900' : customer.risk_label === 'problematic' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <span className={`text-xs font-bold ${customer.risk_label === 'blocked' || customer.risk_label === 'problematic' ? 'text-white' : 'text-gray-600'}`}>
                            {(customer.name || customer.email || customer.phone || '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{customer.name || '—'}</p>
                          <p className="text-[10px] text-gray-400 truncate font-sans">{customer.phone || customer.email}</p>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <RiskBadge label={customer.risk_label} />
                        {customer.manual_label_override && (
                          <span className="text-[9px] text-gray-300 block mt-0.5">manual</span>
                        )}
                      </div>
                      <div className="col-span-2"><ScoreBar score={customer.risk_score} /></div>
                      <div className="col-span-2">
                        <span className="text-xs text-gray-700 font-semibold">{customer.total_orders}</span>
                        <span className="text-[10px] text-gray-300 ml-1 font-sans">comenzi</span>
                      </div>
                      <div className="col-span-2">
                        {rate === null ? (
                          <span className="text-[10px] text-gray-300">—</span>
                        ) : (
                          <span className={`text-xs font-semibold ${rate >= 70 ? 'text-gray-700' : rate >= 50 ? 'text-gray-500' : 'text-gray-900'}`}>
                            {rate}%
                          </span>
                        )}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            {unreadAlerts > 0 && (
              <button onClick={markAllAlertsRead} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                <Check className="h-3.5 w-3.5" />Marchează toate citite
              </button>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {alerts.length === 0 ? (
              <div className="py-16 text-center">
                <BellOff className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400 font-sans">Nicio alertă</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {alerts.map((alert, i) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className={`flex items-start gap-3 px-5 py-4 hover:bg-gray-50/50 transition-colors ${!alert.is_read ? 'bg-gray-50/30' : ''}`}
                  >
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      alert.severity === 'critical' ? 'bg-gray-900' : alert.severity === 'warning' ? 'bg-gray-200' : 'bg-gray-100'
                    }`}>
                      {alert.severity === 'critical'
                        ? <Ban className="h-3.5 w-3.5 text-white" />
                        : alert.severity === 'warning'
                        ? <AlertTriangle className="h-3.5 w-3.5 text-gray-700" />
                        : <Info className="h-3.5 w-3.5 text-gray-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${!alert.is_read ? 'text-gray-900' : 'text-gray-600'}`}>{alert.title}</p>
                        {!alert.is_read && <span className="h-1.5 w-1.5 rounded-full bg-gray-900 shrink-0" />}
                      </div>
                      {alert.description && <p className="text-xs text-gray-400 font-sans mt-0.5">{alert.description}</p>}
                    </div>
                    <span className="text-[10px] text-gray-300 shrink-0">{timeAgo(alert.created_at)}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer Profile Drawer */}
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
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl overflow-y-auto"
            >
              <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${selectedCustomer.risk_label === 'blocked' ? 'bg-gray-900' : 'bg-gray-100'}`}>
                    <span className={`text-sm font-bold ${selectedCustomer.risk_label === 'blocked' ? 'text-white' : 'text-gray-700'}`}>
                      {(selectedCustomer.name || selectedCustomer.email || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{selectedCustomer.name || 'Client necunoscut'}</p>
                    <RiskBadge label={selectedCustomer.risk_label} score={selectedCustomer.risk_score} />
                  </div>
                </div>
                <button onClick={() => setShowProfile(false)} className="h-8 w-8 rounded-xl bg-gray-100 flex items-center justify-center">
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Contact */}
                <div className="space-y-2">
                  {selectedCustomer.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="text-gray-700 font-sans">{selectedCustomer.phone}</span>
                    </div>
                  )}
                  {selectedCustomer.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="text-gray-700 font-sans">{selectedCustomer.email}</span>
                    </div>
                  )}
                  {selectedCustomer.first_order_at && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="text-gray-500 font-sans">
                        Client din {new Date(selectedCustomer.first_order_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Total comenzi', value: selectedCustomer.total_orders },
                    { label: 'Ridicate', value: selectedCustomer.orders_collected },
                    { label: 'Refuzate', value: selectedCustomer.orders_refused },
                    { label: 'Rată ridicare', value: collectionRate(selectedCustomer) !== null ? `${collectionRate(selectedCustomer)}%` : '—' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest">{s.label}</p>
                      <p className="text-lg font-bold text-gray-900 mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Override label */}
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Override Etichetă</p>
                  <div className="flex flex-wrap gap-2">
                    {(['trusted', 'watch', 'problematic', 'blocked'] as const).map(l => (
                      <button
                        key={l}
                        onClick={() => overrideLabel(selectedCustomer.id, l)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${selectedCustomer.risk_label === l ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        {LABEL_CONFIG[l].label}
                      </button>
                    ))}
                  </div>
                  {selectedCustomer.manual_label_override && (
                    <p className="text-[10px] text-gray-300 mt-1.5 font-sans">Override manual activ</p>
                  )}
                </div>

                {/* Note operator */}
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Notițe Operator</p>
                  <textarea
                    value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                    placeholder="Adaugă note despre acest client..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 resize-none font-sans text-gray-700"
                  />
                  <button
                    onClick={saveNote}
                    disabled={savingNote}
                    className="mt-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {savingNote ? 'Salvare...' : 'Salvează notița'}
                  </button>
                </div>

                {/* Order history */}
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-3">Istoricul Comenzilor</p>
                  {customerOrders.length === 0 ? (
                    <p className="text-xs text-gray-300 font-sans">Nicio comandă înregistrată</p>
                  ) : (
                    <div className="space-y-2">
                      {customerOrders.map(order => (
                        <div key={order.id} className="rounded-xl border border-gray-100 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="text-xs font-semibold text-gray-900">
                                #{order.order_number || order.external_order_id}
                              </span>
                              <span className="text-[10px] text-gray-400 ml-2 font-sans">
                                {new Date(order.ordered_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-gray-700">{order.total_value} {order.currency}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide ${ORDER_STATUS_STYLE[order.order_status] || 'bg-gray-100 text-gray-500'}`}>
                                {ORDER_STATUS_LABELS[order.order_status] || order.order_status}
                              </span>
                            </div>
                          </div>
                          {/* Status update buttons */}
                          {['pending', 'processing', 'shipped'].includes(order.order_status) && (
                            <div className="flex gap-1.5 mt-2 flex-wrap">
                              {[
                                { status: 'collected', label: '✓ Ridicat' },
                                { status: 'refused', label: '✗ Refuzat' },
                                { status: 'not_home', label: 'Absent' },
                                { status: 'cancelled', label: 'Anulat' },
                              ].map(btn => (
                                <button
                                  key={btn.status}
                                  onClick={() => updateOrderStatus(order.id, btn.status)}
                                  disabled={updatingOrder === order.id}
                                  className="px-2.5 py-1 rounded-lg text-[10px] border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
                                >
                                  {btn.label}
                                </button>
                              ))}
                            </div>
                          )}
                          {/* Risk flags */}
                          {order.risk_flags?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {order.risk_flags.slice(0, 3).map((flag: any, i: number) => (
                                <span key={i} className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-sans">
                                  {flag.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Blacklist toggle */}
                <div className="border-t border-gray-100 pt-4">
                  <button
                    onClick={() => {
                      const newVal = !selectedCustomer.in_local_blacklist
                      fetch('/api/risk/customers', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ customer_id: selectedCustomer.id, in_local_blacklist: newVal }),
                      })
                      setSelectedCustomer(prev => prev ? { ...prev, in_local_blacklist: newVal } : null)
                    }}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${selectedCustomer.in_local_blacklist ? 'bg-gray-900 text-white hover:bg-gray-800' : 'border border-gray-900 text-gray-900 hover:bg-gray-50'}`}
                  >
                    <Ban className="h-4 w-4" />
                    {selectedCustomer.in_local_blacklist ? 'Elimină din blacklist' : 'Adaugă în blacklist'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}