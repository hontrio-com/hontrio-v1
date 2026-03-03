'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Plus, ArrowLeft, Send, Loader2, Clock,
  CheckCircle, AlertCircle, ChevronRight, HelpCircle, Bug,
  Lightbulb, CreditCard, Link2, ChevronDown, ChevronUp,
  Headphones, Zap, Shield, BookOpen, MessageCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

// ─── Types ────────────────────────────────────────────────────────────────────

type Ticket = {
  id: string
  subject: string
  message: string
  status: string
  priority: string
  category: string
  created_at: string
  updated_at: string
  replies_count: number
  admin_replies_count: number
  has_unread: boolean
}

type Reply = {
  id: string
  message: string
  is_admin: boolean
  created_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; dot: string; icon: any }> = {
  open:        { label: 'Deschis',   color: 'bg-blue-50 text-blue-700',    dot: 'bg-blue-500',    icon: AlertCircle },
  in_progress: { label: 'În lucru',  color: 'bg-amber-50 text-amber-700',  dot: 'bg-amber-400',   icon: Clock },
  resolved:    { label: 'Rezolvat',  color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', icon: CheckCircle },
  closed:      { label: 'Închis',    color: 'bg-gray-100 text-gray-500',   dot: 'bg-gray-300',    icon: CheckCircle },
}

const categoryConfig: Record<string, { label: string; icon: any; color: string }> = {
  general:     { label: 'General',    icon: HelpCircle,    color: 'text-gray-500 bg-gray-100' },
  bug:         { label: 'Bug',        icon: Bug,           color: 'text-red-600 bg-red-50' },
  feature:     { label: 'Sugestie',   icon: Lightbulb,     color: 'text-amber-600 bg-amber-50' },
  billing:     { label: 'Facturare',  icon: CreditCard,    color: 'text-violet-600 bg-violet-50' },
  integration: { label: 'Integrare',  icon: Link2,         color: 'text-blue-600 bg-blue-50' },
}

const FAQ = [
  {
    q: 'Cum conectez magazinul WooCommerce?',
    a: 'Mergi la Setări → Integrări și introdu URL-ul magazinului tău împreună cu Consumer Key și Consumer Secret din WooCommerce → WooCommerce → Setări → Avansat → REST API.',
  },
  {
    q: 'Cum funcționează creditele?',
    a: 'Fiecare acțiune AI consumă credite: generarea textului SEO costă 5 credite, regenerarea unei secțiuni 2 credite, iar generarea unei imagini 2–4 credite în funcție de stil. Creditele se reîncarcă conform planului tău.',
  },
  {
    q: 'De ce sincronizarea nu aduce toate produsele?',
    a: 'Verifică dacă cheia API WooCommerce are permisiuni de citire (Read). Dacă folosești un firewall sau Cloudflare, asigură-te că IP-urile noastre nu sunt blocate. Poți reîncerca sincronizarea din pagina Produse.',
  },
  {
    q: 'Cât durează generarea unei imagini AI?',
    a: 'De obicei 20–60 de secunde per imagine, în funcție de complexitatea stilului ales. Imaginile de tip "Fundal Alb" sunt cele mai rapide, iar cele "Seasonal" pot dura puțin mai mult.',
  },
  {
    q: 'Cum public produsele înapoi în WooCommerce?',
    a: 'Din pagina SEO a unui produs, după ce ai generat și salvat conținutul, apasă butonul "Publică în magazin". Produsul va fi actualizat direct în WooCommerce cu titlul și descrierile optimizate.',
  },
  {
    q: 'Pot folosi Hontrio cu alt CMS decât WooCommerce?',
    a: 'Momentan suportăm doar WooCommerce. Suportul pentru Shopify, PrestaShop și alte platforme este în roadmap și va fi disponibil în curând.',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 2)   return 'acum câteva secunde'
  if (mins < 60)  return `acum ${mins} minute`
  if (hours < 24) return `acum ${hours} ${hours === 1 ? 'oră' : 'ore'}`
  if (days === 1) return 'ieri'
  if (days < 7)   return `acum ${days} zile`
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
}

function formatFull(iso: string): string {
  return new Date(iso).toLocaleDateString('ro-RO', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function initials(isAdmin: boolean, name?: string): string {
  if (isAdmin) return 'H'
  if (name) return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return 'Tu'
}

// ─── FAQ Accordion ────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 px-4 py-3.5 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <span className="text-sm font-medium text-gray-800">{q}</span>
        {open
          ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
        }
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 text-sm text-gray-600 leading-relaxed bg-white border-t border-gray-50">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const [tickets, setTickets]               = useState<Ticket[]>([])
  const [loading, setLoading]               = useState(true)
  const [view, setView]                     = useState<'list' | 'create' | 'detail'>('list')
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [replies, setReplies]               = useState<Reply[]>([])
  const [statusFilter, setStatusFilter]     = useState('all')
  const [createSuccess, setCreateSuccess]   = useState(false)

  // Create form
  const [subject, setSubject]   = useState('')
  const [message, setMessage]   = useState('')
  const [category, setCategory] = useState('general')
  const [priority, setPriority] = useState('normal')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Reply
  const [replyText, setReplyText] = useState('')
  const [sending, setSending]     = useState(false)
  const [sendError, setSendError] = useState('')
  const repliesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchTickets() }, [])

  useEffect(() => {
    if (replies.length > 0) {
      repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [replies])

  async function fetchTickets() {
    try {
      const res = await fetch('/api/tickets')
      const data = await res.json()
      setTickets(data.tickets || [])
    } catch {} finally { setLoading(false) }
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message, category, priority }),
      })
      const data = await res.json()
      if (res.ok) {
        setSubject(''); setMessage(''); setCategory('general'); setPriority('normal')
        setCreateSuccess(true)
        await fetchTickets()
        setTimeout(() => { setCreateSuccess(false); setView('list') }, 2000)
      } else {
        setCreateError(data.error || 'Eroare la trimitere')
      }
    } catch { setCreateError('Eroare de rețea. Încearcă din nou.') }
    finally { setCreating(false) }
  }

  async function openTicket(ticket: Ticket) {
    setSelectedTicket(ticket)
    setView('detail')
    setReplies([])
    setSendError('')
    try {
      const res = await fetch('/api/tickets/' + ticket.id)
      const data = await res.json()
      setReplies(data.replies || [])
      // Mark as read locally
      setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, has_unread: false } : t))
    } catch {}
  }

  async function sendReply() {
    if (!replyText.trim() || !selectedTicket) return
    setSending(true)
    setSendError('')
    try {
      const res = await fetch('/api/tickets/' + selectedTicket.id + '/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText }),
      })
      const data = await res.json()
      if (res.ok) {
        setReplies(prev => [...prev, data.reply])
        setReplyText('')
      } else {
        setSendError(data.error || 'Eroare la trimitere')
      }
    } catch { setSendError('Eroare de rețea') }
    finally { setSending(false) }
  }

  const filteredTickets = statusFilter === 'all'
    ? tickets
    : tickets.filter(t => t.status === statusFilter)

  const unreadCount = tickets.filter(t => t.has_unread).length

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-gray-100 rounded-lg animate-pulse" />
      {[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />)}
    </div>
  )

  // ══════════════════════════════════════════════════════════════
  // CREATE VIEW
  // ══════════════════════════════════════════════════════════════
  if (view === 'create') return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => setView('list')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="h-4 w-4" />Înapoi la tichete
      </button>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tichet nou</h1>
        <p className="text-sm text-gray-500 mt-1">Îți răspundem în maxim 24h în zilele lucrătoare</p>
      </div>

      <AnimatePresence>
        {createSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700"
          >
            <CheckCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium text-sm">Tichetul a fost trimis cu succes!</p>
              <p className="text-xs text-emerald-600">Te redirecționăm înapoi...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={createTicket} className="space-y-5">
        {/* Subject */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Subiect <span className="text-red-400">*</span></label>
          <Input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Descrie pe scurt problema sau întrebarea..."
            className="rounded-xl h-11 border-gray-200"
            required maxLength={200}
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{subject.length}/200</p>
        </div>

        {/* Category + Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Categorie</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {Object.entries(categoryConfig).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Prioritate</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="low">Scăzută</option>
              <option value="normal">Normală</option>
              <option value="high">Ridicată</option>
              <option value="urgent">Urgentă</option>
            </select>
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Mesaj <span className="text-red-400">*</span></label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Descrie detaliat problema sau întrebarea ta. Cu cât mai multe detalii, cu atât mai rapid te putem ajuta..."
            className="w-full h-44 rounded-xl border border-gray-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
            required maxLength={5000}
          />
          {/* Progress bar */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${message.length > 4500 ? 'bg-red-400' : message.length > 3000 ? 'bg-amber-400' : 'bg-blue-400'}`}
                style={{ width: `${(message.length / 5000) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 tabular-nums">{message.length}/5000</span>
          </div>
        </div>

        {createError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />{createError}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Button
            type="submit"
            disabled={creating || createSuccess}
            className="bg-blue-600 hover:bg-blue-700 rounded-xl h-11 px-6"
          >
            {creating
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Se trimite...</>
              : <><Send className="h-4 w-4 mr-2" />Trimite tichetul</>
            }
          </Button>
          <button type="button" onClick={() => setView('list')} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Anulează
          </button>
        </div>
      </form>
    </div>
  )

  // ══════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ══════════════════════════════════════════════════════════════
  if (view === 'detail' && selectedTicket) {
    const sc = statusConfig[selectedTicket.status] || statusConfig.open
    const cc = categoryConfig[selectedTicket.category] || categoryConfig.general
    const CatIcon = cc.icon

    return (
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Back */}
        <button
          onClick={() => { setView('list'); setSelectedTicket(null) }}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />Înapoi la tichete
        </button>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h1 className="text-lg font-bold text-gray-900 leading-snug">{selectedTicket.subject}</h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${sc.color}`}>
              {sc.label}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
            <span className={`flex items-center gap-1.5 px-2 py-1 rounded-lg font-medium ${cc.color}`}>
              <CatIcon className="h-3 w-3" />{cc.label}
            </span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Creat {timeAgo(selectedTicket.created_at)}</span>
            <span title={formatFull(selectedTicket.created_at)} className="cursor-help underline decoration-dotted">{formatFull(selectedTicket.created_at)}</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative space-y-3">
          {/* Vertical line */}
          <div className="absolute left-5 top-6 bottom-6 w-px bg-gray-100" />

          {/* Original message */}
          <div className="relative flex gap-4">
            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 z-10">
              Tu
            </div>
            <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">Tu</span>
                <span className="text-xs text-gray-400" title={formatFull(selectedTicket.created_at)}>
                  {timeAgo(selectedTicket.created_at)}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedTicket.message}</p>
            </div>
          </div>

          {/* Replies */}
          {replies.map((reply) => (
            <motion.div
              key={reply.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative flex gap-4"
            >
              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 z-10 ${
                reply.is_admin ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {reply.is_admin ? 'H' : 'Tu'}
              </div>
              <div className={`flex-1 rounded-2xl border p-4 min-w-0 ${
                reply.is_admin
                  ? 'bg-blue-50 border-blue-100'
                  : 'bg-white border-gray-100 shadow-sm'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold ${reply.is_admin ? 'text-blue-700' : 'text-gray-700'}`}>
                    {reply.is_admin ? '🛡️ Echipa Hontrio' : 'Tu'}
                  </span>
                  <span className="text-xs text-gray-400" title={formatFull(reply.created_at)}>
                    {timeAgo(reply.created_at)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{reply.message}</p>
              </div>
            </motion.div>
          ))}

          {/* Scroll anchor */}
          <div ref={repliesEndRef} />
        </div>

        {/* Reply box */}
        {selectedTicket.status !== 'closed' ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Răspunde</p>
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Scrie răspunsul tău..."
              className="w-full h-28 rounded-xl border border-gray-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 bg-gray-50"
              maxLength={5000}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendReply()
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Ctrl+Enter pentru a trimite</span>
              <div className="flex items-center gap-3">
                {sendError && (
                  <span className="text-xs text-red-500">{sendError}</span>
                )}
                <Button
                  onClick={sendReply}
                  disabled={sending || !replyText.trim()}
                  className="bg-blue-600 hover:bg-blue-700 rounded-xl h-9 px-4 gap-2"
                >
                  {sending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <><Send className="h-4 w-4" />Trimite</>
                  }
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-gray-400 bg-gray-50 rounded-2xl">
            Tichetul este închis. Deschide un tichet nou dacă ai nevoie de ajutor suplimentar.
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-gray-900">Suport</h1>
              {unreadCount > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                  {unreadCount} nou
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-0.5">{tickets.length} {tickets.length === 1 ? 'tichet' : 'tichete'}</p>
          </div>
          <Button onClick={() => setView('create')} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-5 shrink-0">
            <Plus className="h-4 w-4 mr-2" />Tichet nou
          </Button>
        </div>
      </motion.div>

      {/* Response time banner */}
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-2xl">
        <div className="h-8 w-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
          <Headphones className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-blue-900">Timp de răspuns: maxim 24h</p>
          <p className="text-xs text-blue-600">Luni–Vineri, 9:00–18:00. Răspundem la fiecare tichet.</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-emerald-600 font-medium">Online</span>
        </div>
      </div>

      {/* Status filters */}
      {tickets.length > 0 && (
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {[
            { value: 'all',         label: 'Toate',     count: tickets.length },
            { value: 'open',        label: 'Deschise',  count: tickets.filter(t => t.status === 'open').length },
            { value: 'in_progress', label: 'În lucru',  count: tickets.filter(t => t.status === 'in_progress').length },
            { value: 'resolved',    label: 'Rezolvate', count: tickets.filter(t => t.status === 'resolved').length },
            { value: 'closed',      label: 'Închise',   count: tickets.filter(t => t.status === 'closed').length },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                statusFilter === opt.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                statusFilter === opt.value ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
              }`}>{opt.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Empty state + FAQ */}
      {tickets.length === 0 ? (
        <div className="space-y-6">
          {/* Hero empty */}
          <div className="text-center py-10">
            <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-gray-800 font-semibold text-lg mb-1">Niciun tichet deschis</p>
            <p className="text-sm text-gray-400 max-w-sm mx-auto mb-5">
              Dacă ai o problemă sau o întrebare, suntem aici să te ajutăm. Îți răspundem în maxim 24h.
            </p>
            <Button onClick={() => setView('create')} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-6">
              <Plus className="h-4 w-4 mr-2" />Deschide un tichet
            </Button>
          </div>

          {/* FAQ */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Întrebări frecvente</h2>
            </div>
            <div className="space-y-2">
              {FAQ.map((item, i) => <FaqItem key={i} q={item.q} a={item.a} />)}
            </div>
          </div>
        </div>

      ) : (
        <div className="space-y-4">
          {/* Tickets list */}
          {filteredTickets.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 text-gray-200" />
              <p className="text-sm">Niciun tichet cu statusul selectat</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTickets.map((ticket, i) => {
                const sc = statusConfig[ticket.status] || statusConfig.open
                const cc = categoryConfig[ticket.category] || categoryConfig.general
                const CatIcon = cc.icon
                return (
                  <motion.div
                    key={ticket.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => openTicket(ticket)}
                    className={`group flex items-center gap-4 bg-white rounded-2xl border p-4 hover:shadow-md transition-all cursor-pointer ${
                      ticket.has_unread ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100 hover:border-blue-100'
                    }`}
                  >
                    {/* Status icon */}
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${sc.color}`}>
                      <CatIcon className="h-5 w-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{ticket.subject}</p>
                        {ticket.has_unread && (
                          <span className="flex items-center gap-1 text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full shrink-0">
                            NOU
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Status badge */}
                        <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.color}`}>
                          <div className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                        {/* Category */}
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cc.color}`}>
                          {cc.label}
                        </span>
                        {/* Reply count */}
                        {ticket.replies_count > 0 && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {ticket.replies_count} {ticket.replies_count === 1 ? 'răspuns' : 'răspunsuri'}
                            {ticket.admin_replies_count > 0 && (
                              <span className="text-blue-500">· {ticket.admin_replies_count} de la echipă</span>
                            )}
                          </span>
                        )}
                        {/* Time */}
                        <span className="text-[10px] text-gray-400" title={formatFull(ticket.updated_at)}>
                          {timeAgo(ticket.updated_at)}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
                  </motion.div>
                )
              })}
            </div>
          )}

          {/* FAQ inline — always visible if has tickets */}
          <div className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Întrebări frecvente</h2>
            </div>
            <div className="space-y-2">
              {FAQ.map((item, i) => <FaqItem key={i} q={item.q} a={item.a} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}