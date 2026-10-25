'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, ArrowLeft, Send, Loader2, Clock, CheckCircle,
  AlertCircle, ChevronRight, ChevronLeft, Shield, Search, X,
  HelpCircle, Bug, Lightbulb, CreditCard, Link2, User, Mail,
  Tag, Zap, Paperclip, FileText, Download, Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useT } from '@/lib/i18n/context'
import type { TFunction } from '@/lib/i18n/translate'

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
  users: { name: string; email: string }
}

type Reply = {
  id: string
  message: string
  is_admin: boolean
  created_at: string
  users: { name: string; email: string }
  attachments?: Attachment[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

const getStatusConfig = (t: TFunction): Record<string, { label: string; color: string; dot: string }> => ({
  open:        { label: t('admin.tickets_status_open'),        color: 'bg-blue-50 text-blue-700',      dot: 'bg-blue-500' },
  in_progress: { label: t('admin.tickets_status_in_progress'), color: 'bg-amber-50 text-amber-700',    dot: 'bg-amber-400' },
  resolved:    { label: t('admin.tickets_status_resolved'),    color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  closed:      { label: t('admin.tickets_status_closed'),      color: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-300' },
})

const getPriorityConfig = (t: TFunction): Record<string, { label: string; color: string; bg: string }> => ({
  low:    { label: t('admin.tickets_priority_low'),    color: 'text-gray-500',  bg: 'bg-gray-100' },
  normal: { label: t('admin.tickets_priority_normal'), color: 'text-blue-600',  bg: 'bg-blue-50' },
  high:   { label: t('admin.tickets_priority_high'),   color: 'text-orange-600', bg: 'bg-orange-50' },
  urgent: { label: t('admin.tickets_priority_urgent'), color: 'text-red-600',    bg: 'bg-red-50' },
})

const getCategoryConfig = (t: TFunction): Record<string, { label: string; icon: any; color: string }> => ({
  general:     { label: t('admin.tickets_category_general'),     icon: HelpCircle, color: 'text-gray-500 bg-gray-100' },
  bug:         { label: t('admin.tickets_category_bug'),         icon: Bug,        color: 'text-red-600 bg-red-50' },
  feature:     { label: t('admin.tickets_category_feature'),     icon: Lightbulb,  color: 'text-amber-600 bg-amber-50' },
  billing:     { label: t('admin.tickets_category_billing'),     icon: CreditCard, color: 'text-violet-600 bg-violet-50' },
  integration: { label: t('admin.tickets_category_integration'), icon: Link2,      color: 'text-blue-600 bg-blue-50' },
})

// ─── Attachment Types ────────────────────────────────────────────────────────

type Attachment = { url: string; name: string; size: number; type: string }
type PendingFile = Attachment & { uploading: boolean; error?: string; localId: string }

const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword'
const MAX_FILES = 5
const MAX_SIZE  = 10 * 1024 * 1024

function isImage(type: string) { return type.startsWith('image/') }
function formatBytes(b: number) {
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB'
  return (b / (1024 * 1024)).toFixed(1) + ' MB'
}

function AttachmentChip({ att, onRemove }: { att: PendingFile | Attachment & { uploading?: boolean; error?: string; localId?: string }; onRemove?: () => void }) {
  const img = isImage(att.type)
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs max-w-[200px] ${'error' in att && att.error ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
      {img ? <img src={att.url} alt="" className="h-6 w-6 rounded object-cover shrink-0" /> : <FileText className="h-4 w-4 text-gray-400 shrink-0" />}
      <span className="truncate text-gray-700 font-medium">{att.name}</span>
      {'uploading' in att && att.uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400 shrink-0" />
        : 'error' in att && att.error ? <span className="text-red-500 shrink-0">!</span>
        : onRemove ? <button onClick={onRemove} className="text-gray-400 hover:text-red-500 shrink-0"><X className="h-3.5 w-3.5" /></button>
        : <a href={att.url} target="_blank" rel="noopener" className="text-gray-400 hover:text-blue-500 shrink-0"><Download className="h-3.5 w-3.5" /></a>
      }
    </div>
  )
}

function AttachmentGallery({ attachments }: { attachments: Attachment[] }) {
  if (!attachments?.length) return null
  const images = attachments.filter(a => isImage(a.type))
  const files  = attachments.filter(a => !isImage(a.type))
  return (
    <div className="mt-2 space-y-2">
      {images.length > 0 && <div className="flex flex-wrap gap-2">{images.map((att, i) => (<a key={i} href={att.url} target="_blank" rel="noopener"><img src={att.url} alt={att.name} className="h-24 w-24 rounded-xl object-cover border border-gray-200 hover:opacity-90 cursor-zoom-in" /></a>))}</div>}
      {files.length > 0 && <div className="flex flex-wrap gap-2">{files.map((att, i) => <AttachmentChip key={i} att={att as any} />)}</div>}
    </div>
  )
}

function useAttachments() {
  const { t } = useT()
  const [pending, setPending] = useState<PendingFile[]>([])
  async function addFiles(files: FileList) {
    const toAdd = Array.from(files).slice(0, MAX_FILES - pending.length)
    for (const file of toAdd) {
      if (file.size > MAX_SIZE) { alert(t('admin.tickets_file_too_large', { name: file.name })); continue }
      const localId = Math.random().toString(36).slice(2)
      const preview = isImage(file.type) ? URL.createObjectURL(file) : ''
      setPending(p => [...p, { localId, name: file.name, size: file.size, type: file.type, url: preview, uploading: true }])
      const fd = new FormData(); fd.append('file', file)
      try {
        const res = await fetch('/api/tickets/upload', { method: 'POST', body: fd })
        const data = await res.json()
        setPending(p => p.map(f => f.localId === localId ? { ...f, url: res.ok ? data.url : preview, uploading: false, error: res.ok ? undefined : data.error } : f))
      } catch { setPending(p => p.map(f => f.localId === localId ? { ...f, uploading: false, error: t('common.error_upload') } : f)) }
    }
  }
  function remove(localId: string) { setPending(p => p.filter(f => f.localId !== localId)) }
  function clear() { setPending([]) }
  const ready = pending.filter(f => !f.uploading && !f.error).map(({ url, name, size, type }) => ({ url, name, size, type }))
  const uploading = pending.some(f => f.uploading)
  return { pending, addFiles, remove, clear, ready, uploading }
}

function DropZone({ onFiles, disabled }: { onFiles: (f: FileList) => void; disabled?: boolean }) {
  const { t } = useT()
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files) }}
      onClick={() => inputRef.current?.click()}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-all ${drag ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300'} ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <Upload className="h-4 w-4 text-gray-400 shrink-0" />
      <div>
        <p className="text-xs font-medium text-gray-600">{t('common.add_files')} <span className="text-blue-500">{t('common.or_drag')}</span></p>
        <p className="text-[10px] text-gray-400 mt-0.5">{t('admin.tickets_dropzone_hint', { max: MAX_FILES })}</p>
      </div>
      <input ref={inputRef} type="file" multiple accept={ACCEPTED} className="hidden" onChange={e => e.target.files && onFiles(e.target.files)} />
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string, t: TFunction, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 2)   return t('common.time_just_now')
  if (mins < 60)  return t('common.time_minutes_ago', { count: mins })
  if (hours < 24) return t('common.time_hours_ago', { count: hours })
  if (days === 1) return t('common.time_yesterday')
  if (days < 7)   return t('common.time_days_ago', { count: days })
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

function formatFull(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminTicketsPage() {
  const { t, intlLocale } = useT()
  const statusConfig = getStatusConfig(t)
  const priorityConfig = getPriorityConfig(t)
  const categoryConfig = getCategoryConfig(t)
  const [tickets, setTickets]         = useState<Ticket[]>([])
  const [loading, setLoading]         = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [page, setPage]               = useState(1)
  const [totalPages, setTotalPages]   = useState(0)
  const [total, setTotal]             = useState(0)
  const [search, setSearch]           = useState('')
  const [searchInput, setSearchInput] = useState('')

  const [selected, setSelected]       = useState<Ticket | null>(null)
  const [replies, setReplies]         = useState<Reply[]>([])
  const [replyText, setReplyText]     = useState('')
  const [sending, setSending]         = useState(false)
  const [sendError, setSendError]     = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const repliesEndRef = useRef<HTMLDivElement>(null)
  const replyAtts = useAttachments()

  useEffect(() => { fetchTickets() }, [statusFilter, page, search])

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    if (replies.length > 0) {
      repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [replies])

  async function fetchTickets() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString() })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)
      const res = await fetch('/api/admin/tickets?' + params)
      const data = await res.json()
      setTickets(data.tickets || [])
      setTotalPages(data.total_pages || 0)
      setTotal(data.total || 0)
      setStatusCounts(data.status_counts || {})
    } catch {} finally { setLoading(false) }
  }

  async function openTicket(ticket: Ticket) {
    setSelected(ticket)
    setReplies([])
    setSendError('')
    try {
      const res = await fetch('/api/admin/tickets/' + ticket.id)
      const data = await res.json()
      setReplies(data.replies || [])
    } catch {}
  }

  async function updateStatus(status: string) {
    if (!selected || updatingStatus) return
    setUpdatingStatus(true)
    try {
      const res = await fetch('/api/admin/tickets/' + selected.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setSelected({ ...selected, status })
        setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, status } : t))
        setStatusCounts(prev => {
          const next = { ...prev }
          next[selected.status] = Math.max(0, (next[selected.status] || 0) - 1)
          next[status] = (next[status] || 0) + 1
          return next
        })
      }
    } catch {} finally { setUpdatingStatus(false) }
  }

  async function sendReply() {
    if (!replyText.trim() || !selected) return
    setSending(true)
    setSendError('')
    try {
      const res = await fetch('/api/admin/tickets/' + selected.id + '/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText, attachments: replyAtts.ready }),
      })
      const data = await res.json()
      if (res.ok) {
        setReplies(prev => [...prev, { ...data.reply, users: { name: t('admin.users_role_admin'), email: '' } }])
        setReplyText(''); replyAtts.clear()
        // Auto-update status locally if was open
        if (selected.status === 'open') {
          setSelected({ ...selected, status: 'in_progress' })
          setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, status: 'in_progress' } : t))
        }
      } else {
        setSendError(data.error || t('admin.tickets_send_error'))
      }
    } catch { setSendError(t('common.error_connection')) }
    finally { setSending(false) }
  }

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────
  if (selected) {
    const sc = statusConfig[selected.status] || statusConfig.open
    const pc = priorityConfig[selected.priority] || priorityConfig.normal
    const cc = categoryConfig[selected.category] || categoryConfig.general
    const CatIcon = cc.icon

    return (
      <div className="max-w-3xl space-y-5">
        {/* Back */}
        <button
          onClick={() => { setSelected(null); setReplies([]) }}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />{t('admin.tickets_all')}
        </button>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h1 className="text-lg font-bold text-gray-900 leading-snug">{selected.subject}</h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1.5 ${sc.color}`}>
              <div className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
              {sc.label}
            </span>
          </div>

          {/* User info */}
          <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
            <span className="flex items-center gap-1.5 text-gray-600 font-medium">
              <User className="h-3.5 w-3.5 text-gray-400" />
              {selected.users?.name || t('admin.users_role_user')}
            </span>
            <span className="flex items-center gap-1.5 text-gray-400">
              <Mail className="h-3.5 w-3.5" />
              {selected.users?.email}
            </span>
            <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-medium ${cc.color}`}>
              <CatIcon className="h-3 w-3" />{cc.label}
            </span>
            <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${pc.bg} ${pc.color}`}>
              {pc.label}
            </span>
            <span className="text-gray-400" title={formatFull(selected.created_at, intlLocale)}>
              {timeAgo(selected.created_at, t, intlLocale)}
            </span>
          </div>

          {/* Status controls */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">{t('admin.tickets_change_status')}</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(statusConfig).map(([s, cfg]) => (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  disabled={selected.status === s || updatingStatus}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    selected.status === s
                      ? `${cfg.color} border-current ring-2 ring-offset-1 ring-blue-300`
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100 disabled:opacity-40'
                  }`}
                >
                  <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative space-y-3">
          <div className="absolute left-5 top-6 bottom-6 w-px bg-gray-100" />

          {/* Original message */}
          <div className="relative flex gap-4">
            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 z-10">
              {selected.users?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">{selected.users?.name || t('admin.users_role_user')}</span>
                <span className="text-xs text-gray-400" title={formatFull(selected.created_at, intlLocale)}>
                  {timeAgo(selected.created_at, t, intlLocale)}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selected.message}</p>
            </div>
          </div>

          {/* Replies */}
          {replies.map(reply => (
            <motion.div
              key={reply.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative flex gap-4"
            >
              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 z-10 ${
                reply.is_admin ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {reply.is_admin ? 'A' : (reply.users?.name?.[0]?.toUpperCase() || 'U')}
              </div>
              <div className={`flex-1 rounded-2xl border p-4 min-w-0 ${
                reply.is_admin ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100 shadow-sm'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold flex items-center gap-1.5 ${reply.is_admin ? 'text-blue-700' : 'text-gray-700'}`}>
                    {reply.is_admin && <Shield className="h-3 w-3" />}
                    {reply.is_admin ? (reply.users?.name || t('admin.users_role_admin')) : (reply.users?.name || t('admin.users_role_user'))}
                  </span>
                  <span className="text-xs text-gray-400" title={formatFull(reply.created_at, intlLocale)}>
                    {timeAgo(reply.created_at, t, intlLocale)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{reply.message}</p>
                {(reply.attachments?.length ?? 0) > 0 && <AttachmentGallery attachments={reply.attachments!} />}
              </div>
            </motion.div>
          ))}

          <div ref={repliesEndRef} />
        </div>

        {/* Reply box */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center"><Shield className="h-3.5 w-3.5 text-white" /></div>
            <p className="text-xs font-semibold text-gray-600">{t('admin.tickets_reply_as_admin')}</p>
            {selected.status === 'open' && (
              <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Zap className="h-2.5 w-2.5" />{t('admin.tickets_will_become', { status: statusConfig.in_progress.label })}
              </span>
            )}
          </div>
          <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
            placeholder={t('admin.tickets_reply_placeholder')}
            className="w-full h-32 rounded-xl border border-gray-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 bg-gray-50"
            maxLength={5000} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendReply() }} />
          <DropZone onFiles={replyAtts.addFiles} disabled={replyAtts.pending.length >= MAX_FILES} />
          {replyAtts.pending.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {replyAtts.pending.map(f => <AttachmentChip key={f.localId} att={f} onRemove={() => replyAtts.remove(f.localId)} />)}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{t('admin.tickets_reply_counter', { length: replyText.length })}</span>
            <div className="flex items-center gap-3">
              {sendError && <span className="text-xs text-red-500">{sendError}</span>}
              <Button onClick={sendReply} disabled={sending || (!replyText.trim() && replyAtts.ready.length === 0) || replyAtts.uploading} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-9 px-4 gap-2">
                {sending || replyAtts.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" />{t('admin.tickets_send')}</>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.tickets_title')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('admin.tickets_total', { count: total })}</p>
        </div>
        <div className="flex items-center gap-2">
          {statusCounts['open'] > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-full">
              <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              {t('admin.tickets_open_count', { count: statusCounts['open'] })}
            </span>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t('admin.tickets_search_placeholder')}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="pl-10 h-10 rounded-xl border-gray-200 bg-white"
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearch('') }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {[
            { value: 'all',         label: t('common.all') },
            { value: 'open',        label: t('admin.tickets_filter_open') },
            { value: 'in_progress', label: t('admin.tickets_status_in_progress') },
            { value: 'resolved',    label: t('admin.tickets_filter_resolved') },
            { value: 'closed',      label: t('admin.tickets_filter_closed') },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setPage(1) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                statusFilter === opt.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                statusFilter === opt.value ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
              }`}>{statusCounts[opt.value] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{t('admin.tickets_empty')}</p>
          {search && <p className="text-sm text-gray-400 mt-1">{t('admin.tickets_empty_search', { query: search })}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {/* List header */}
          <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            <div className="col-span-5">{t('admin.tickets_col_subject')}</div>
            <div className="col-span-3">{t('admin.users_role_user')}</div>
            <div className="col-span-1 text-center">{t('common.priority')}</div>
            <div className="col-span-2 text-center">{t('admin.status')}</div>
            <div className="col-span-1 text-right">{t('admin.date')}</div>
          </div>

          {tickets.map((ticket, i) => {
            const sc = statusConfig[ticket.status] || statusConfig.open
            const pc = priorityConfig[ticket.priority] || priorityConfig.normal
            const cc = categoryConfig[ticket.category] || categoryConfig.general
            const CatIcon = cc.icon
            return (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => openTicket(ticket)}
                className="group grid grid-cols-12 gap-4 items-center bg-white rounded-2xl border border-gray-100 px-4 py-3.5 hover:border-blue-100 hover:shadow-sm transition-all cursor-pointer"
              >
                {/* Subject + category */}
                <div className="col-span-12 sm:col-span-5 flex items-center gap-3 min-w-0">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${cc.color}`}>
                    <CatIcon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{ticket.subject}</p>
                </div>

                {/* User */}
                <div className="hidden sm:block col-span-3 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{ticket.users?.name || '—'}</p>
                  <p className="text-xs text-gray-400 truncate">{ticket.users?.email}</p>
                </div>

                {/* Priority */}
                <div className="hidden sm:flex col-span-1 justify-center">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pc.bg} ${pc.color}`}>
                    {pc.label}
                  </span>
                </div>

                {/* Status */}
                <div className="hidden sm:flex col-span-2 justify-center">
                  <span className={`flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.color}`}>
                    <div className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                    {sc.label}
                  </span>
                </div>

                {/* Date */}
                <div className="hidden sm:flex col-span-1 justify-end items-center gap-1">
                  <span className="text-xs text-gray-400 text-right" title={formatFull(ticket.updated_at, intlLocale)}>
                    {timeAgo(ticket.updated_at, t, intlLocale)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-400 transition-colors shrink-0" />
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">{t('admin.page_of', { page, total: totalPages })}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}