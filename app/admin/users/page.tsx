'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Loader2,
  SearchIcon,
  SlidersHorizontal,
  X,
  Plus,
  Minus,
  CreditCard,
  Shield,
  Crown,
  CheckCircle,
  AlertCircle,
  MoreHorizontal,
  Mail,
  Calendar,
  Package,
  ImageIcon,
  ArrowUpRight,
  ArrowDownRight,
  UserCheck,
  UserX,
  Sparkles,
  ChevronDown,
  Eye,
  Gift,
  Trash2,
  Bell,
  Send,
  MessageSquare,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

type User = {
  id: string
  email: string
  name: string | null
  role: string
  credits: number
  plan: string
  onboarding_completed: boolean
  created_at: string
}

const fadeInUp = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  // Modal states
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [creditAmount, setCreditAmount] = useState('10')
  const [creditReason, setCreditReason] = useState('')
  const [message, setMessage] = useState({ type: '', text: '' })

  // Notification states
  const [showNotifyModal, setShowNotifyModal] = useState(false)
  const [notifyUser, setNotifyUser] = useState<User | null>(null)
  const [notifyTitle, setNotifyTitle] = useState('')
  const [notifyMessage, setNotifyMessage] = useState('')
  const [notifyType, setNotifyType] = useState('info')
  const [sendingNotify, setSendingNotify] = useState(false)

  // Global notification states
  const [showGlobalNotifyModal, setShowGlobalNotifyModal] = useState(false)
  const [globalTitle, setGlobalTitle] = useState('')
  const [globalMessage, setGlobalMessage] = useState('')
  const [globalType, setGlobalType] = useState('info')
  const [sendingGlobal, setSendingGlobal] = useState(false)

  // Delete states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      setUsers(data.users || [])
    } catch {
      console.error('Error loading users')
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = searchQuery === '' ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.name || '').toLowerCase().includes(searchQuery.toLowerCase())
      const matchesPlan = planFilter === 'all' || u.plan === planFilter
      const matchesRole = roleFilter === 'all' || u.role === roleFilter
      return matchesSearch && matchesPlan && matchesRole
    })
  }, [users, searchQuery, planFilter, roleFilter])

  const activeFilters = (planFilter !== 'all' ? 1 : 0) + (roleFilter !== 'all' ? 1 : 0)

  const showMsg = (type: string, text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 5000)
  }

  const openUserModal = (user: User) => {
    setSelectedUser(user)
    setShowUserModal(true)
    setCreditAmount('10')
    setCreditReason('')
    setMessage({ type: '', text: '' })
  }

  // ===== CREDITS =====
  const handleAddCredits = async () => {
    if (!selectedUser || !creditAmount) return
    setActionLoading('addCredits')
    setMessage({ type: '', text: '' })
    try {
      const res = await fetch('/api/admin/users/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.id,
          amount: parseInt(creditAmount),
          reason: creditReason || 'Credite adăugate de admin',
        }),
      })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error || 'Eroare'); return }
      showMsg('success', `${creditAmount} credite adăugate cu succes!`)
      setSelectedUser({ ...selectedUser, credits: selectedUser.credits + parseInt(creditAmount) })
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, credits: u.credits + parseInt(creditAmount) } : u
      ))
      setCreditAmount('10')
      setCreditReason('')
    } catch { showMsg('error', 'Eroare la adăugarea creditelor') }
    finally { setActionLoading('') }
  }

  const handleRemoveCredits = async () => {
    if (!selectedUser || !creditAmount) return
    setActionLoading('removeCredits')
    setMessage({ type: '', text: '' })
    try {
      const res = await fetch('/api/admin/users/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUser.id,
          amount: -parseInt(creditAmount),
          reason: creditReason || 'Credite retrase de admin',
        }),
      })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error || 'Eroare'); return }
      showMsg('success', `${creditAmount} credite retrase.`)
      setSelectedUser({ ...selectedUser, credits: Math.max(0, selectedUser.credits - parseInt(creditAmount)) })
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, credits: Math.max(0, u.credits - parseInt(creditAmount)) } : u
      ))
    } catch { showMsg('error', 'Eroare') }
    finally { setActionLoading('') }
  }

  // ===== PLAN =====
  const handleChangePlan = async (newPlan: string) => {
    if (!selectedUser) return
    setActionLoading(`plan-${newPlan}`)
    setMessage({ type: '', text: '' })
    try {
      const res = await fetch('/api/admin/users/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUser.id, plan: newPlan }),
      })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error || 'Eroare'); return }
      showMsg('success', `Plan schimbat la ${newPlan}`)
      setSelectedUser({ ...selectedUser, plan: newPlan })
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, plan: newPlan } : u))
    } catch { showMsg('error', 'Eroare') }
    finally { setActionLoading('') }
  }

  // ===== ROLE =====
  const handleChangeRole = async (newRole: string) => {
    if (!selectedUser) return
    setActionLoading(`role-${newRole}`)
    setMessage({ type: '', text: '' })
    try {
      const res = await fetch('/api/admin/users/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUser.id, role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error || 'Eroare'); return }
      showMsg('success', `Rol schimbat la ${newRole}`)
      setSelectedUser({ ...selectedUser, role: newRole })
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, role: newRole } : u))
    } catch { showMsg('error', 'Eroare') }
    finally { setActionLoading('') }
  }

  // ===== DELETE USER =====
  const openDeleteConfirm = (user: User) => {
    setDeleteUser(user)
    setDeleteConfirmText('')
    setShowDeleteConfirm(true)
  }

  const handleDeleteUser = async () => {
    if (!deleteUser || deleteConfirmText !== deleteUser.email) return
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: deleteUser.id }),
      })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error || 'Eroare la ștergere'); return }
      showMsg('success', data.message || 'Utilizator șters')
      setUsers(prev => prev.filter(u => u.id !== deleteUser.id))
      setShowDeleteConfirm(false)
      setShowUserModal(false)
      setSelectedUser(null)
      setDeleteUser(null)
    } catch { showMsg('error', 'Eroare la ștergere') }
    finally { setDeleting(false) }
  }

  // ===== SEND NOTIFICATION TO USER =====
  const openNotifyModal = (user: User) => {
    setNotifyUser(user)
    setNotifyTitle('')
    setNotifyMessage('')
    setNotifyType('info')
    setShowNotifyModal(true)
  }

  const handleSendNotification = async () => {
    if (!notifyUser || !notifyTitle || !notifyMessage) return
    setSendingNotify(true)
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: notifyUser.id,
          title: notifyTitle,
          message: notifyMessage,
          type: notifyType,
          is_global: false,
        }),
      })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error || 'Eroare'); return }
      showMsg('success', `Notificare trimisă către ${notifyUser.name || notifyUser.email}`)
      setShowNotifyModal(false)
    } catch { showMsg('error', 'Eroare la trimitere') }
    finally { setSendingNotify(false) }
  }

  // ===== SEND GLOBAL NOTIFICATION =====
  const handleSendGlobalNotification = async () => {
    if (!globalTitle || !globalMessage) return
    setSendingGlobal(true)
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: globalTitle,
          message: globalMessage,
          type: globalType,
          is_global: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) { showMsg('error', data.error || 'Eroare'); return }
      showMsg('success', 'Notificare globală trimisă către toți utilizatorii!')
      setShowGlobalNotifyModal(false)
      setGlobalTitle('')
      setGlobalMessage('')
    } catch { showMsg('error', 'Eroare la trimitere') }
    finally { setSendingGlobal(false) }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight font-mono">Utilizatori</h1>
            <p className="text-gray-500 text-sm mt-0.5">{users.length} utilizatori înregistrați</p>
          </div>
          <Button
            onClick={() => setShowGlobalNotifyModal(true)}
            className="bg-gray-900 hover:bg-gray-800 text-white rounded-xl h-10 px-4 text-sm"
          >
            <Bell className="h-4 w-4 mr-2" />
            Notificare globală
          </Button>
        </div>
      </motion.div>

      {/* Message */}
      <AnimatePresence>
        {message.text && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`flex items-center gap-3 p-4 rounded-xl ${
              message.type === 'success' ? 'bg-gray-50 border border-gray-200 text-gray-800' : 'bg-gray-900 text-white border border-gray-900'
            }`}
          >
            {message.type === 'success' ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
            <span className="text-sm">{message.text}</span>
            <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto text-current opacity-50 hover:opacity-100">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + Filters */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.05 }}>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Caută după email sau nume..."
              className="pl-10 h-10 rounded-xl border-gray-200"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="rounded-xl h-10 px-4 border-gray-200 relative"
          >
            <SlidersHorizontal className="h-4 w-4 mr-1.5" />
            Filtre
            {activeFilters > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-gray-900 text-white text-[10px] flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </Button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 flex gap-3 flex-wrap"
            >
              <div className="flex gap-1.5">
                <span className="text-xs text-gray-400 self-center mr-1">Plan:</span>
                {['all', 'free', 'starter', 'professional', 'enterprise'].map(p => (
                  <button
                    key={p}
                    onClick={() => setPlanFilter(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      planFilter === p ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {p === 'all' ? 'Toate' : p}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <span className="text-xs text-gray-400 self-center mr-1">Rol:</span>
                {['all', 'user', 'admin'].map(r => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      roleFilter === r ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {r === 'all' ? 'Toate' : r}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Users list */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.1 }}>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-0">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Niciun utilizator găsit</p>
              </div>
            ) : (
              <div>
                {filteredUsers.map((user, i) => (
                  <div key={user.id}>
                    <div
                      onClick={() => openUserModal(user)}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                          user.role === 'admin' ? 'bg-gray-900' : 'bg-gray-100'
                        }`}>
                          <span className={`text-sm font-bold ${user.role === 'admin' ? 'text-white' : 'text-gray-700'}`}>
                            {user.name?.[0]?.toUpperCase() || user.email[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">{user.name || 'Fără nume'}</p>
                            {user.role === 'admin' && (
                              <Badge className="bg-red-100 text-red-700 border-0 text-[9px]">Admin</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={`border-0 text-[10px] capitalize ${
                          user.plan === 'enterprise' ? 'bg-purple-100 text-purple-700' :
                          user.plan === 'professional' ? 'bg-indigo-100 text-indigo-700' :
                          user.plan === 'starter' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {user.plan}
                        </Badge>
                        <span className="text-xs text-gray-400 w-14 text-right">{user.credits} cr</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); openNotifyModal(user) }}
                          className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Trimite notificare"
                        >
                          <Bell className="h-3.5 w-3.5 text-blue-400" />
                        </button>
                      </div>
                    </div>
                    {i < filteredUsers.length - 1 && <div className="border-b border-gray-50 ml-[4.5rem]" />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ===== USER MANAGEMENT MODAL ===== */}
      <AnimatePresence>
        {showUserModal && selectedUser && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              onClick={() => setShowUserModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto"
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-gray-900">Gestionează utilizator</h3>
                  <button onClick={() => setShowUserModal(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Message inside modal */}
                {message.text && (
                  <div className={`flex items-center gap-2 p-3 rounded-xl mb-4 text-sm ${
                    message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {message.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                    {message.text}
                  </div>
                )}

                <div className="space-y-5">
                  {/* User info */}
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                      selectedUser.role === 'admin'
                        ? 'bg-gradient-to-br from-red-500 to-rose-600'
                        : 'bg-gradient-to-br from-blue-500 to-indigo-500'
                    }`}>
                      <span className="text-lg font-medium text-white">
                        {selectedUser.name?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{selectedUser.name || 'Fără nume'}</p>
                      <p className="text-sm text-gray-400">{selectedUser.email}</p>
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-gray-900">{selectedUser.credits}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Credite</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <Badge className={`border-0 text-[10px] capitalize ${
                        selectedUser.plan === 'enterprise' ? 'bg-purple-100 text-purple-700' :
                        selectedUser.plan === 'professional' ? 'bg-indigo-100 text-indigo-700' :
                        selectedUser.plan === 'starter' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-200 text-gray-600'
                      }`}>
                        {selectedUser.plan}
                      </Badge>
                      <p className="text-[10px] text-gray-400 mt-1">Plan</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <Badge className={`border-0 text-[10px] ${
                        selectedUser.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {selectedUser.role}
                      </Badge>
                      <p className="text-[10px] text-gray-400 mt-1">Rol</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Manage Credits */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-blue-600" />
                      Gestionează credite
                    </h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-500">Cantitate</Label>
                          <Input type="number" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} min="1" className="h-10 rounded-xl border-gray-200" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-500">Motiv (opțional)</Label>
                          <Input value={creditReason} onChange={(e) => setCreditReason(e.target.value)} placeholder="Ex: Bonus..." className="h-10 rounded-xl border-gray-200" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleAddCredits} disabled={actionLoading === 'addCredits' || !creditAmount} className="flex-1 bg-green-600 hover:bg-green-700 rounded-xl h-10 text-sm">
                          {actionLoading === 'addCredits' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1.5" />Adaugă</>}
                        </Button>
                        <Button onClick={handleRemoveCredits} disabled={actionLoading === 'removeCredits' || !creditAmount} variant="outline" className="flex-1 rounded-xl h-10 text-sm border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                          {actionLoading === 'removeCredits' ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Minus className="h-4 w-4 mr-1.5" />Retrage</>}
                        </Button>
                      </div>
                      <div className="flex gap-1.5">
                        {[10, 20, 50, 100, 500].map(amount => (
                          <button key={amount} onClick={() => setCreditAmount(String(amount))} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${creditAmount === String(amount) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            {amount}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Change Plan */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Crown className="h-4 w-4 text-purple-600" />
                      Schimbă planul
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {['free', 'starter', 'professional', 'enterprise'].map(plan => (
                        <button key={plan} onClick={() => handleChangePlan(plan)} disabled={selectedUser.plan === plan || actionLoading === `plan-${plan}`}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${selectedUser.plan === plan ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'} ${selectedUser.plan === plan ? 'cursor-default' : 'cursor-pointer'}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900 capitalize">{plan}</span>
                            {actionLoading === `plan-${plan}` && <Loader2 className="h-3 w-3 animate-spin text-blue-600" />}
                            {selectedUser.plan === plan && <CheckCircle className="h-4 w-4 text-blue-600" />}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {plan === 'free' ? '20 credite' : plan === 'starter' ? '200 cr/lună · 49€' : plan === 'professional' ? '500 cr/lună · 99€' : '2000 cr/lună · 249€'}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Change Role */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-red-600" />
                      Schimbă rolul
                    </h4>
                    <div className="flex gap-2">
                      {['user', 'admin'].map(role => (
                        <button key={role} onClick={() => handleChangeRole(role)} disabled={selectedUser.role === role || actionLoading === `role-${role}`}
                          className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${selectedUser.role === role ? (role === 'admin' ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50') : 'border-gray-100 hover:border-gray-200'}`}>
                          <div className="flex items-center justify-center gap-2">
                            {role === 'admin' ? <Shield className="h-4 w-4 text-red-600" /> : <UserCheck className="h-4 w-4 text-blue-600" />}
                            <span className="text-sm font-medium text-gray-900 capitalize">{role}</span>
                            {actionLoading === `role-${role}` && <Loader2 className="h-3 w-3 animate-spin" />}
                            {selectedUser.role === role && <CheckCircle className="h-4 w-4 text-green-500" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Send Notification */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Bell className="h-4 w-4 text-blue-600" />
                      Acțiuni rapide
                    </h4>
                    <div className="flex gap-2">
                      <Button onClick={() => openNotifyModal(selectedUser)} variant="outline" className="flex-1 rounded-xl h-10 text-sm border-blue-200 text-blue-600 hover:bg-blue-50">
                        <MessageSquare className="h-4 w-4 mr-1.5" />
                        Trimite notificare
                      </Button>
                      <Button onClick={() => openDeleteConfirm(selectedUser)} variant="outline" className="rounded-xl h-10 text-sm border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 px-4">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Details */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Detalii</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">ID</span>
                        <span className="text-gray-700 font-mono text-xs">{selectedUser.id.slice(0, 16)}...</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Înregistrat</span>
                        <span className="text-gray-700">
                          {new Date(selectedUser.created_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Onboarding</span>
                        <Badge className={`border-0 text-[10px] ${selectedUser.onboarding_completed ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                          {selectedUser.onboarding_completed ? 'Complet' : 'Incomplet'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===== SEND NOTIFICATION MODAL ===== */}
      <AnimatePresence>
        {showNotifyModal && notifyUser && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={() => setShowNotifyModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Trimite notificare</h3>
                  <button onClick={() => setShowNotifyModal(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
                </div>
                <p className="text-sm text-gray-500 mb-4">Către: <span className="font-medium text-gray-700">{notifyUser.name || notifyUser.email}</span></p>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Titlu</Label>
                    <Input value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} placeholder="Titlul notificării" className="h-10 rounded-xl border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Mesaj</Label>
                    <textarea value={notifyMessage} onChange={(e) => setNotifyMessage(e.target.value)} placeholder="Mesajul notificării..." className="w-full h-24 px-3 py-2 text-sm rounded-xl border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Tip</Label>
                    <div className="flex gap-2">
                      {[
                        { value: 'info', label: 'Info', color: 'bg-blue-100 text-blue-700' },
                        { value: 'success', label: 'Succes', color: 'bg-green-100 text-green-700' },
                        { value: 'warning', label: 'Atenție', color: 'bg-yellow-100 text-yellow-700' },
                        { value: 'error', label: 'Eroare', color: 'bg-red-100 text-red-700' },
                      ].map(t => (
                        <button key={t.value} onClick={() => setNotifyType(t.value)} className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${notifyType === t.value ? t.color + ' ring-2 ring-offset-1 ring-gray-300' : 'bg-gray-100 text-gray-500'}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleSendNotification} disabled={sendingNotify || !notifyTitle || !notifyMessage} className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl h-10">
                    {sendingNotify ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    Trimite notificare
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===== GLOBAL NOTIFICATION MODAL ===== */}
      <AnimatePresence>
        {showGlobalNotifyModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={() => setShowGlobalNotifyModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Bell className="h-5 w-5 text-blue-600" />
                    Notificare globală
                  </h3>
                  <button onClick={() => setShowGlobalNotifyModal(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
                </div>
                <p className="text-sm text-gray-500 mb-4">Această notificare va fi vizibilă pentru <span className="font-medium text-gray-700">toți utilizatorii</span> platformei.</p>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Titlu</Label>
                    <Input value={globalTitle} onChange={(e) => setGlobalTitle(e.target.value)} placeholder="Ex: Actualizare platformă" className="h-10 rounded-xl border-gray-200" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Mesaj</Label>
                    <textarea value={globalMessage} onChange={(e) => setGlobalMessage(e.target.value)} placeholder="Mesajul care va fi afișat tuturor..." className="w-full h-24 px-3 py-2 text-sm rounded-xl border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">Tip</Label>
                    <div className="flex gap-2">
                      {[
                        { value: 'info', label: 'Info', color: 'bg-blue-100 text-blue-700' },
                        { value: 'success', label: 'Succes', color: 'bg-green-100 text-green-700' },
                        { value: 'warning', label: 'Atenție', color: 'bg-yellow-100 text-yellow-700' },
                        { value: 'error', label: 'Eroare', color: 'bg-red-100 text-red-700' },
                      ].map(t => (
                        <button key={t.value} onClick={() => setGlobalType(t.value)} className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${globalType === t.value ? t.color + ' ring-2 ring-offset-1 ring-gray-300' : 'bg-gray-100 text-gray-500'}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleSendGlobalNotification} disabled={sendingGlobal || !globalTitle || !globalMessage} className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl h-10">
                    {sendingGlobal ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
                    Trimite la toți utilizatorii
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===== DELETE CONFIRMATION MODAL ===== */}
      <AnimatePresence>
        {showDeleteConfirm && deleteUser && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={() => setShowDeleteConfirm(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center">
                    <Trash2 className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Șterge utilizator</h3>
                    <p className="text-sm text-red-500">Această acțiune este permanentă!</p>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4">
                  <p className="text-sm text-red-700 mb-2">Vor fi șterse definitiv:</p>
                  <div className="text-xs text-red-600 space-y-1">
                    <p>• Contul și datele utilizatorului</p>
                    <p>• Toate produsele și imaginile generate</p>
                    <p>• Istoricul de tranzacții și credite</p>
                    <p>• Conexiunile cu magazine</p>
                    <p>• Notificările</p>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-3">
                  Pentru confirmare, scrie emailul utilizatorului: <span className="font-mono font-medium text-gray-900">{deleteUser.email}</span>
                </p>

                <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder={deleteUser.email} className="h-10 rounded-xl border-gray-200 mb-4 font-mono text-sm" />

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-xl h-10">Anulează</Button>
                  <Button onClick={handleDeleteUser} disabled={deleting || deleteConfirmText !== deleteUser.email} className="flex-1 bg-red-600 hover:bg-red-700 rounded-xl h-10 text-white">
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    Șterge definitiv
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}