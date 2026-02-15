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

  const openUserModal = (user: User) => {
    setSelectedUser(user)
    setShowUserModal(true)
    setCreditAmount('10')
    setCreditReason('')
    setMessage({ type: '', text: '' })
  }

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
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Eroare' })
        return
      }
      setMessage({ type: 'success', text: `${creditAmount} credite adăugate cu succes!` })
      setSelectedUser({ ...selectedUser, credits: selectedUser.credits + parseInt(creditAmount) })
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, credits: u.credits + parseInt(creditAmount) } : u
      ))
      setCreditAmount('10')
      setCreditReason('')
    } catch {
      setMessage({ type: 'error', text: 'Eroare la adăugarea creditelor' })
    } finally {
      setActionLoading('')
    }
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
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Eroare' })
        return
      }
      setMessage({ type: 'success', text: `${creditAmount} credite retrase.` })
      setSelectedUser({ ...selectedUser, credits: Math.max(0, selectedUser.credits - parseInt(creditAmount)) })
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, credits: Math.max(0, u.credits - parseInt(creditAmount)) } : u
      ))
    } catch {
      setMessage({ type: 'error', text: 'Eroare' })
    } finally {
      setActionLoading('')
    }
  }

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
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Eroare' })
        return
      }
      setMessage({ type: 'success', text: `Plan schimbat la ${newPlan}` })
      setSelectedUser({ ...selectedUser, plan: newPlan })
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, plan: newPlan } : u))
    } catch {
      setMessage({ type: 'error', text: 'Eroare' })
    } finally {
      setActionLoading('')
    }
  }

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
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Eroare' })
        return
      }
      setMessage({ type: 'success', text: `Rol schimbat la ${newRole}` })
      setSelectedUser({ ...selectedUser, role: newRole })
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, role: newRole } : u))
    } catch {
      setMessage({ type: 'error', text: 'Eroare' })
    } finally {
      setActionLoading('')
    }
  }

  // Stats
  const totalCredits = users.reduce((sum, u) => sum + u.credits, 0)
  const planCounts = {
    free: users.filter(u => u.plan === 'free').length,
    starter: users.filter(u => u.plan === 'starter').length,
    professional: users.filter(u => u.plan === 'professional').length,
    enterprise: users.filter(u => u.plan === 'enterprise').length,
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-96 bg-white rounded-2xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold text-gray-900">Utilizatori</h1>
        <p className="text-gray-500 text-sm mt-0.5">Gestionează utilizatorii și permisiunile lor</p>
      </motion.div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total utilizatori', value: users.length, color: 'blue' },
          { label: 'Free Trial', value: planCounts.free, color: 'gray' },
          { label: 'Starter', value: planCounts.starter, color: 'green' },
          { label: 'Professional', value: planCounts.professional, color: 'indigo' },
          { label: 'Enterprise', value: planCounts.enterprise, color: 'purple' },
        ].map((stat, i) => (
          <motion.div key={stat.label} {...fadeInUp} transition={{ duration: 0.3, delay: 0.05 + i * 0.02 }}>
            <div className={`bg-${stat.color === 'gray' ? 'gray' : stat.color}-50 rounded-xl p-3`}>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-[11px] text-gray-500">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search & Filters */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.15 }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Caută după nume sau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 rounded-xl border-gray-200 bg-white"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={`h-10 rounded-xl border-gray-200 gap-2 ${showFilters ? 'bg-red-50 border-red-200 text-red-700' : ''}`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtre
            {activeFilters > 0 && (
              <Badge className="bg-red-600 text-white text-[10px] h-5 w-5 p-0 flex items-center justify-center rounded-full">
                {activeFilters}
              </Badge>
            )}
          </Button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-3 pt-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400 font-medium">Plan:</span>
                  <div className="flex gap-1">
                    {['all', 'free', 'starter', 'professional', 'enterprise'].map(p => (
                      <button
                        key={p}
                        onClick={() => setPlanFilter(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          planFilter === p ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {p === 'all' ? 'Toate' : p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400 font-medium">Rol:</span>
                  <div className="flex gap-1">
                    {['all', 'user', 'admin'].map(r => (
                      <button
                        key={r}
                        onClick={() => setRoleFilter(r)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          roleFilter === r ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {r === 'all' ? 'Toate' : r.charAt(0).toUpperCase() + r.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                {activeFilters > 0 && (
                  <button
                    onClick={() => { setPlanFilter('all'); setRoleFilter('all') }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50"
                  >
                    Resetează
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Results count */}
      {(searchQuery || activeFilters > 0) && (
        <p className="text-sm text-gray-400">{filteredUsers.length} utilizatori găsiți</p>
      )}

      {/* Users table */}
      <motion.div {...fadeInUp} transition={{ duration: 0.3, delay: 0.2 }}>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Utilizator</th>
                    <th className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Plan</th>
                    <th className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Credite</th>
                    <th className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Rol</th>
                    <th className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Înregistrat</th>
                    <th className="text-right text-[11px] font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Acțiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, i) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.3) }}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shrink-0">
                            <span className="text-sm font-medium text-white">
                              {user.name?.[0]?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{user.name || 'Fără nume'}</p>
                            <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge className={`border-0 text-[10px] capitalize ${
                          user.plan === 'enterprise' ? 'bg-purple-100 text-purple-700' :
                          user.plan === 'professional' ? 'bg-indigo-100 text-indigo-700' :
                          user.plan === 'starter' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {user.plan}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-sm font-semibold ${
                          user.credits > 10 ? 'text-green-600' : user.credits > 0 ? 'text-yellow-600' : 'text-red-500'
                        }`}>
                          {user.credits}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge className={`border-0 text-[10px] ${
                          user.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-gray-500">
                          {new Date(user.created_at).toLocaleDateString('ro-RO', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openUserModal(user)}
                          className="rounded-xl h-8 px-3 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Gestionează
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* User Management Modal */}
      <AnimatePresence>
        {showUserModal && selectedUser && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setShowUserModal(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {/* Modal header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 p-5 rounded-t-2xl z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                        <span className="text-lg font-medium text-white">
                          {selectedUser.name?.[0]?.toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{selectedUser.name || 'Fără nume'}</h3>
                        <p className="text-xs text-gray-400">{selectedUser.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowUserModal(false)}
                      className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Message */}
                  <AnimatePresence>
                    {message.text && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
                          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                        }`}
                      >
                        {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        {message.text}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* User info */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-gray-900">{selectedUser.credits}</p>
                      <p className="text-[10px] text-gray-400">Credite</p>
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
                          <Input
                            type="number"
                            value={creditAmount}
                            onChange={(e) => setCreditAmount(e.target.value)}
                            min="1"
                            className="h-10 rounded-xl border-gray-200"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-500">Motiv (opțional)</Label>
                          <Input
                            value={creditReason}
                            onChange={(e) => setCreditReason(e.target.value)}
                            placeholder="Ex: Bonus, compensare..."
                            className="h-10 rounded-xl border-gray-200"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleAddCredits}
                          disabled={actionLoading === 'addCredits' || !creditAmount}
                          className="flex-1 bg-green-600 hover:bg-green-700 rounded-xl h-10 text-sm"
                        >
                          {actionLoading === 'addCredits' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <><Plus className="h-4 w-4 mr-1.5" />Adaugă {creditAmount} credite</>
                          )}
                        </Button>
                        <Button
                          onClick={handleRemoveCredits}
                          disabled={actionLoading === 'removeCredits' || !creditAmount}
                          variant="outline"
                          className="flex-1 rounded-xl h-10 text-sm border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          {actionLoading === 'removeCredits' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <><Minus className="h-4 w-4 mr-1.5" />Retrage {creditAmount} credite</>
                          )}
                        </Button>
                      </div>
                      {/* Quick add buttons */}
                      <div className="flex gap-1.5">
                        {[10, 20, 50, 100, 500].map(amount => (
                          <button
                            key={amount}
                            onClick={() => setCreditAmount(String(amount))}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              creditAmount === String(amount)
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
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
                        <button
                          key={plan}
                          onClick={() => handleChangePlan(plan)}
                          disabled={selectedUser.plan === plan || actionLoading === `plan-${plan}`}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            selectedUser.plan === plan
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-100 hover:border-gray-200'
                          } ${selectedUser.plan === plan ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900 capitalize">{plan}</span>
                            {actionLoading === `plan-${plan}` && <Loader2 className="h-3 w-3 animate-spin text-blue-600" />}
                            {selectedUser.plan === plan && <CheckCircle className="h-4 w-4 text-blue-600" />}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {plan === 'free' ? '20 credite' :
                             plan === 'starter' ? '200 cr/lună' :
                             plan === 'professional' ? '500 cr/lună' : '2000 cr/lună'}
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
                        <button
                          key={role}
                          onClick={() => handleChangeRole(role)}
                          disabled={selectedUser.role === role || actionLoading === `role-${role}`}
                          className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                            selectedUser.role === role
                              ? role === 'admin' ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50'
                              : 'border-gray-100 hover:border-gray-200'
                          }`}
                        >
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
                          {new Date(selectedUser.created_at).toLocaleDateString('ro-RO', {
                            day: 'numeric', month: 'long', year: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Onboarding</span>
                        <Badge className={`border-0 text-[10px] ${
                          selectedUser.onboarding_completed ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                        }`}>
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
    </div>
  )
}