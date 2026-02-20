'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  MessageSquare, ArrowLeft, Send, Loader2, Clock, CheckCircle,
  AlertCircle, ChevronRight, ChevronLeft, Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

type Ticket = {
  id: string; subject: string; message: string; status: string
  priority: string; category: string; created_at: string; updated_at: string
  users: { name: string; email: string }
}
type Reply = {
  id: string; message: string; is_admin: boolean; created_at: string
  users: { name: string; email: string }
}

const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: 'Deschis', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'În lucru', color: 'bg-yellow-100 text-yellow-700' },
  resolved: { label: 'Rezolvat', color: 'bg-green-100 text-green-700' },
  closed: { label: 'Închis', color: 'bg-gray-100 text-gray-500' },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Scăzută', color: 'text-gray-500' },
  normal: { label: 'Normală', color: 'text-blue-600' },
  high: { label: 'Ridicată', color: 'text-orange-600' },
  urgent: { label: 'Urgentă', color: 'text-red-600' },
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)

  const [selected, setSelected] = useState<Ticket | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => { fetchTickets() }, [statusFilter, page])

  async function fetchTickets() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString() })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch('/api/admin/tickets?' + params)
      const data = await res.json()
      setTickets(data.tickets || [])
      setTotalPages(data.total_pages || 0)
      setStatusCounts(data.status_counts || {})
    } catch {} finally { setLoading(false) }
  }

  async function openTicket(ticket: Ticket) {
    setSelected(ticket)
    try {
      const res = await fetch('/api/admin/tickets/' + ticket.id)
      const data = await res.json()
      setReplies(data.replies || [])
    } catch {}
  }

  async function updateStatus(status: string) {
    if (!selected) return
    try {
      await fetch('/api/admin/tickets/' + selected.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setSelected({ ...selected, status })
      fetchTickets()
    } catch {}
  }

  async function sendReply() {
    if (!replyText.trim() || !selected) return
    setSending(true)
    try {
      const res = await fetch('/api/admin/tickets/' + selected.id + '/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText }),
      })
      if (res.ok) {
        const data = await res.json()
        setReplies(prev => [...prev, { ...data.reply, users: { name: 'Admin', email: '' } }])
        setReplyText('')
        if (selected.status === 'open') setSelected({ ...selected, status: 'in_progress' })
      }
    } catch {} finally { setSending(false) }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  // ===== DETAIL VIEW =====
  if (selected) {
    const sc = statusConfig[selected.status] || statusConfig.open
    const pc = priorityConfig[selected.priority] || priorityConfig.normal
    return (
      <div className="max-w-3xl space-y-6">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" />Toate tichetele
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{selected.subject}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {selected.users?.name || 'User'} &bull; {selected.users?.email} &bull; {formatDate(selected.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={sc.color + ' text-xs'}>{sc.label}</Badge>
            <span className={`text-xs font-medium ${pc.color}`}>{pc.label}</span>
          </div>
        </div>

        {/* Status actions */}
        <div className="flex gap-2">
          {['open', 'in_progress', 'resolved', 'closed'].map(s => {
            const c = statusConfig[s]
            return (
              <button key={s} onClick={() => updateStatus(s)} disabled={selected.status === s}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selected.status === s ? c.color + ' ring-2 ring-offset-1 ring-blue-300' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                {c.label}
              </button>
            )
          })}
        </div>

        {/* Original message */}
        <Card className="rounded-2xl border-gray-100">
          <CardContent className="p-4">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.message}</p>
          </CardContent>
        </Card>

        {/* Replies */}
        <div className="space-y-3">
          {replies.map(reply => (
            <div key={reply.id} className={`p-4 rounded-2xl ${reply.is_admin ? 'bg-blue-50 border border-blue-100 ml-4' : 'bg-white border border-gray-100 mr-4'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-medium ${reply.is_admin ? 'text-blue-600' : 'text-gray-600'}`}>
                  {reply.is_admin ? '🛡️ ' + (reply.users?.name || 'Admin') : '👤 ' + (reply.users?.name || 'User')}
                </span>
                <span className="text-xs text-gray-400">{formatDate(reply.created_at)}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.message}</p>
            </div>
          ))}
        </div>

        {/* Reply box */}
        <div className="flex gap-3">
          <Input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Răspunde ca admin..." className="rounded-xl flex-1"
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()} maxLength={5000} />
          <Button onClick={sendReply} disabled={sending || !replyText.trim()} className="bg-blue-600 hover:bg-blue-700 rounded-xl">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    )
  }

  // ===== LIST VIEW =====
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Tichete Suport</h1>

      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'all', label: 'Toate' },
          { value: 'open', label: 'Deschise' },
          { value: 'in_progress', label: 'În lucru' },
          { value: 'resolved', label: 'Rezolvate' },
          { value: 'closed', label: 'Închise' },
        ].map(opt => (
          <button key={opt.value} onClick={() => { setStatusFilter(opt.value); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === opt.value ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {opt.label} ({statusCounts[opt.value] || 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16"><MessageSquare className="h-12 w-12 text-gray-200 mx-auto mb-3" /><p className="text-gray-500">Niciun tichet</p></div>
      ) : (
        <div className="space-y-2">
          {tickets.map(ticket => {
            const sc = statusConfig[ticket.status] || statusConfig.open
            const pc = priorityConfig[ticket.priority] || priorityConfig.normal
            return (
              <div key={ticket.id} onClick={() => openTicket(ticket)}
                className="group flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-blue-100 transition-all cursor-pointer">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{ticket.subject}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={sc.color + ' text-[10px] px-1.5 py-0 h-5'}>{sc.label}</Badge>
                    <span className={`text-[10px] font-medium ${pc.color}`}>{pc.label}</span>
                    <span className="text-[11px] text-gray-400">{ticket.users?.name || 'User'}</span>
                    <span className="text-[11px] text-gray-400">{formatDate(ticket.created_at)}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 shrink-0" />
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm text-gray-500">Pagina {page} din {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  )
}