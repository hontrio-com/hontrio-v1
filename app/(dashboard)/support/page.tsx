'use client'

import { useT } from '@/lib/i18n/context'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Plus, ArrowLeft, Send, Loader2, Clock,
  CheckCircle, AlertCircle, ChevronRight, HelpCircle, Bug,
  Lightbulb, CreditCard, Link2, ChevronDown, ChevronUp,
  BookOpen, MessageCircle, Paperclip, X, FileText,
  Image as ImageIcon, Download, Upload, Headphones,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type Ticket = {
  id: string; subject: string; message: string; status: string
  priority: string; category: string; created_at: string; updated_at: string
  replies_count: number; admin_replies_count: number; has_unread: boolean
}
type Reply = {
  id: string; message: string; is_admin: boolean; created_at: string
  attachments?: Attachment[]
}
type Attachment = { url: string; name: string; size: number; type: string }

// ─── Config ───────────────────────────────────────────────────────────────────

const getStatus = (t: (k: string) => string): Record<string, { label: string; bg: string; text: string; dot: string }> => ({
  open:        { label: t('support.open'), bg: 'bg-neutral-100', text: 'text-neutral-700', dot: 'bg-neutral-900' },
  in_progress: { label: t('support.status_in_progress'), bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-400' },
  resolved:    { label: t('support.reply'),  bg: 'bg-neutral-900', text: 'text-white',        dot: 'bg-white' },
  closed:      { label: t('support.status_closed'),   bg: 'bg-neutral-100', text: 'text-neutral-400',  dot: 'bg-neutral-300' },
})

const getCategory = (t: (k: string) => string): Record<string, { label: string; icon: any }> => ({
  general:     { label: t('support.general'),   icon: HelpCircle },
  bug:         { label: 'Bug',       icon: Bug },
  feature:     { label: t('support.feature'),  icon: Lightbulb },
  billing:     { label: t('support.billing'),  icon: CreditCard },
  integration: { label: t('settings.tab_integrations'), icon: Link2 },
})

const getFaq = (t: (k: string) => string) => [
  { q: t('support.faq_connect_q'), a: t('support.faq_connect_a') },
  { q: t('support.faq_credits_q'), a: t('support.faq_credits_a') },
  { q: t('support.faq_sync_q'), a: t('support.faq_sync_a') },
  { q: t('support.faq_image_q'), a: t('support.faq_image_a') },
  { q: t('support.faq_publish_q'), a: t('support.faq_publish_a') },
  { q: t('support.faq_cms_q'), a: t('support.faq_cms_a') },
]

const MAX_FILES = 5
const MAX_SIZE  = 10 * 1024 * 1024
const ACCEPTED  = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000)
  if (m < 2)   return 'just now'
  if (m < 60)  return `${m}m ago`
  if (h < 24)  return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 7)   return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatFull(iso: string) {
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isImage(t: string) { return t.startsWith('image/') }

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-neutral-100 rounded-xl ${className || ''}`} />
}

// ─── Attachment components ────────────────────────────────────────────────────

type PendingFile = Attachment & { uploading: boolean; error?: string; localId: string }

function useAttachments() {
  const { t } = useT()
  const [pending, setPending] = useState<PendingFile[]>([])

  async function addFiles(files: FileList) {
    const toAdd = Array.from(files).slice(0, MAX_FILES - pending.length)
    for (const file of toAdd) {
      if (file.size > MAX_SIZE) { alert(`"${file.name}" ${t('support.max_size')}`); continue }
      const localId = Math.random().toString(36).slice(2)
      const preview = isImage(file.type) ? URL.createObjectURL(file) : ''
      setPending(p => [...p, { localId, name: file.name, size: file.size, type: file.type, url: preview, uploading: true }])
      const fd = new FormData(); fd.append('file', file)
      try {
        const res = await fetch('/api/tickets/upload', { method: 'POST', body: fd })
        const data = await res.json()
        setPending(p => p.map(f => f.localId === localId ? { ...f, url: res.ok ? data.url : f.url, uploading: false, error: res.ok ? undefined : data.error } : f))
      } catch {
        setPending(p => p.map(f => f.localId === localId ? { ...f, uploading: false, error: t('common.error_upload') } : f))
      }
    }
  }

  function remove(id: string) { setPending(p => p.filter(f => f.localId !== id)) }
  function clear() { setPending([]) }
  const ready = pending.filter(f => !f.uploading && !f.error).map(({ url, name, size, type }) => ({ url, name, size, type }))

  return { pending, addFiles, remove, clear, ready, uploading: pending.some(f => f.uploading) }
}

function AttachChip({ att, onRemove }: { att: PendingFile; onRemove?: () => void }) {
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[12px] max-w-[200px] ${att.error ? 'border-red-200 bg-red-50' : 'border-neutral-200 bg-neutral-50'}`}>
      {isImage(att.type)
        ? <img src={att.url} alt="" className="h-5 w-5 rounded object-cover shrink-0" />
        : <FileText className="h-3.5 w-3.5 text-neutral-400 shrink-0" />}
      <span className="truncate text-neutral-700 font-medium">{att.name}</span>
      {att.uploading ? <Loader2 className="h-3 w-3 animate-spin text-neutral-400 shrink-0" />
        : att.error ? <span className="text-red-500 shrink-0 text-[10px]">!</span>
        : onRemove ? <button onClick={onRemove} className="text-neutral-300 hover:text-red-500 shrink-0 transition-colors"><X className="h-3 w-3" /></button>
        : att.url && <a href={att.url} target="_blank" rel="noopener" className="text-neutral-300 hover:text-neutral-600 shrink-0"><Download className="h-3 w-3" /></a>
      }
    </div>
  )
}

function AttachGallery({ attachments }: { attachments: Attachment[] }) {
  if (!attachments?.length) return null
  const imgs  = attachments.filter(a => isImage(a.type))
  const files = attachments.filter(a => !isImage(a.type))
  return (
    <div className="mt-3 space-y-2">
      {imgs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imgs.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noopener">
              <img src={a.url} alt={a.name} className="h-20 w-20 rounded-xl object-cover border border-neutral-200 hover:opacity-90 transition-opacity" />
            </a>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((a, i) => <AttachChip key={i} att={{ ...a, uploading: false, localId: String(i) }} />)}
        </div>
      )}
    </div>
  )
}

function DropZone({ onFiles, disabled }: { onFiles: (f: FileList) => void; disabled?: boolean }) {
  const { t } = useT()
  const [drag, setDrag] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files) }}
      onClick={() => ref.current?.click()}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-all
        ${drag ? 'border-neutral-400 bg-neutral-50' : 'border-neutral-200 bg-neutral-50 hover:border-neutral-300'}
        ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <Upload className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
      <div>
        <p className="text-[12px] font-medium text-neutral-600">{t('common.add_files')} <span className="text-neutral-900 underline underline-offset-2">{t('common.or_drag')}</span></p>
        <p className="text-[10px] text-neutral-400 mt-0.5">{t('support.dropzone_hint').replace('{count}', String(MAX_FILES))}</p>
      </div>
      <input ref={ref} type="file" multiple accept={ACCEPTED} className="hidden" onChange={e => e.target.files && onFiles(e.target.files)} />
    </div>
  )
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${open ? 'border-neutral-300' : 'border-neutral-200'}`}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 px-4 py-3.5 bg-white hover:bg-neutral-50 transition-colors text-left">
        <span className="text-[13px] font-medium text-neutral-800">{q}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-neutral-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="px-4 pb-4 pt-1 text-[13px] text-neutral-500 leading-relaxed border-t border-neutral-100">{a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const { t } = useT()
  const STATUS = getStatus(t)
  const s = STATUS[status] || STATUS.open
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} shrink-0`} />
      {s.label}
    </span>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const { t } = useT()
  const STATUS = getStatus(t)
  const CATEGORY = getCategory(t)
  const FAQ = getFaq(t)
  const [tickets, setTickets]           = useState<Ticket[]>([])
  const [loading, setLoading]           = useState(true)
  const [view, setView]                 = useState<'list' | 'create' | 'detail'>('list')
  const [selected, setSelected]         = useState<Ticket | null>(null)
  const [replies, setReplies]           = useState<Reply[]>([])
  const [tabFilter, setTabFilter]       = useState('all')
  const [createSuccess, setCreateSuccess] = useState(false)

  const [subject, setSubject]   = useState('')
  const [message, setMessage]   = useState('')
  const [category, setCategory] = useState('general')
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState('')

  const [replyText, setReplyText] = useState('')
  const [sending, setSending]     = useState(false)
  const [sendErr, setSendErr]     = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const createAtts = useAttachments()
  const replyAtts  = useAttachments()

  useEffect(() => { fetchTickets() }, [])
  useEffect(() => { if (replies.length) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [replies])

  async function fetchTickets() {
    try { const r = await fetch('/api/tickets'); const d = await r.json(); setTickets(d.tickets || []) }
    catch {} finally { setLoading(false) }
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault()
    if (createAtts.uploading) return
    setCreating(true); setCreateErr('')
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message, category, priority: 'normal', attachments: createAtts.ready }),
      })
      const data = await res.json()
      if (res.ok) {
        setSubject(''); setMessage(''); setCategory('general'); createAtts.clear()
        setCreateSuccess(true)
        await fetchTickets()
        setTimeout(() => { setCreateSuccess(false); setView('list') }, 2000)
      } else { setCreateErr(data.error || t('common.error_generic')) }
    } catch { setCreateErr(t('common.error_connection')) }
    finally { setCreating(false) }
  }

  async function openTicket(t: Ticket) {
    setSelected(t); setView('detail'); setReplies([]); setSendErr('')
    try {
      const r = await fetch('/api/tickets/' + t.id)
      const d = await r.json()
      setReplies(d.replies || [])
      setTickets(prev => prev.map(x => x.id === t.id ? { ...x, has_unread: false } : x))
    } catch {}
  }

  async function sendReply() {
    if (!replyText.trim() || !selected || replyAtts.uploading) return
    setSending(true); setSendErr('')
    try {
      const res = await fetch('/api/tickets/' + selected.id + '/replies', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText, attachments: replyAtts.ready }),
      })
      const data = await res.json()
      if (res.ok) { setReplies(p => [...p, data.reply]); setReplyText(''); replyAtts.clear() }
      else setSendErr(data.error || t('support.network_error'))
    } catch { setSendErr(t('support.network_error')) }
    finally { setSending(false) }
  }

  const filtered = tabFilter === 'all' ? tickets : tickets.filter(t => t.status === tabFilter)
  const unread = tickets.filter(t => t.has_unread).length

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
    </div>
  )

  // ── CREATE VIEW ───────────────────────────────────────────────────────────
  if (view === 'create') return (
    <div className="max-w-2xl space-y-5">
      <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-[13px] text-neutral-400 hover:text-neutral-700 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />{t('support.back_to_tickets')}
      </button>

      <div>
        <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight">{t('support.new_ticket')}</h1>
        <p className="text-[13px] text-neutral-400 mt-0.5">{t('support.reply_24h')}</p>
      </div>

      <AnimatePresence>
        {createSuccess && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-4 py-3 bg-neutral-900 text-white rounded-xl text-[13px]">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{t('support.ticket_sent_redirect')}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={createTicket} className="space-y-4">
        <div>
          <label className="block text-[12px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5">
            {t('support.subject')} <span className="text-red-400">*</span>
          </label>
          <input value={subject} onChange={e => setSubject(e.target.value)} required maxLength={200}
            placeholder={t('support.describe_short')}
            className="w-full h-10 px-3.5 rounded-xl border border-neutral-200 bg-white text-[13px] text-neutral-900 placeholder:text-neutral-300 focus:outline-none focus:border-neutral-400 transition-all" />
          <p className="text-[10px] text-neutral-300 mt-1 text-right tabular-nums">{subject.length}/200</p>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5">{t('products.category')}</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CATEGORY).map(([k, v]) => {
              const Icon = v.icon
              return (
                <button key={k} type="button" onClick={() => setCategory(k)}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-xl border text-[12px] font-medium transition-all
                    ${category === k ? 'bg-neutral-900 border-neutral-900 text-white' : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-800'}`}>
                  <Icon className="h-3 w-3" />{v.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5">
            {t('support.message')} <span className="text-red-400">*</span>
          </label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} required maxLength={5000}
            placeholder={t('support.describe_detailed')}
            className="w-full h-40 px-3.5 py-3 rounded-xl border border-neutral-200 bg-white text-[13px] text-neutral-900 placeholder:text-neutral-300 resize-none focus:outline-none focus:border-neutral-400 transition-all leading-relaxed" />
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-0.5 bg-neutral-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${message.length > 4500 ? 'bg-red-400' : message.length > 3000 ? 'bg-amber-400' : 'bg-neutral-300'}`}
                style={{ width: `${(message.length / 5000) * 100}%` }} />
            </div>
            <span className="text-[10px] text-neutral-300 tabular-nums">{message.length}/5000</span>
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5">
            {t('support.attachments_optional')}
          </label>
          <DropZone onFiles={createAtts.addFiles} disabled={createAtts.pending.length >= MAX_FILES} />
          {createAtts.pending.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {createAtts.pending.map(f => <AttachChip key={f.localId} att={f} onRemove={() => createAtts.remove(f.localId)} />)}
            </div>
          )}
        </div>

        {createErr && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-[12px] text-red-600">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />{createErr}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={creating || createSuccess || createAtts.uploading}
            className="flex items-center gap-2 h-10 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[13px] font-medium transition-all disabled:opacity-50">
            {creating || createAtts.uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {creating ? t('common.sending') : createAtts.uploading ? t('support.uploading_files') : t('support.send_ticket_btn')}
          </button>
          <button type="button" onClick={() => setView('list')} className="text-[13px] text-neutral-400 hover:text-neutral-600 transition-colors">{t('common.cancel')}</button>
        </div>
      </form>
    </div>
  )

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    const cat = CATEGORY[selected.category] || CATEGORY.general
    const CatIcon = cat.icon

    return (
      <div className="max-w-2xl space-y-5">
        <button onClick={() => { setView('list'); setSelected(null) }}
          className="flex items-center gap-1.5 text-[13px] text-neutral-400 hover:text-neutral-700 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />{t('support.back_to_tickets')}
        </button>

        {/* Ticket header */}
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h1 className="text-[16px] font-semibold text-neutral-900 leading-snug">{selected.subject}</h1>
            <StatusBadge status={selected.status} />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-neutral-400">
            <span className="flex items-center gap-1 bg-neutral-100 px-2 py-0.5 rounded-md text-neutral-500 font-medium">
              <CatIcon className="h-3 w-3" />{cat.label}
            </span>
            <span title={formatFull(selected.created_at)}>{formatFull(selected.created_at)}</span>
          </div>
        </div>

        {/* Conversation */}
        <div className="space-y-3">
          {/* Original message */}
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-neutral-200 flex items-center justify-center text-[11px] font-semibold text-neutral-600 shrink-0">{t('support.you')}</div>
            <div className="flex-1 bg-white border border-neutral-200 rounded-xl p-4 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-neutral-700">{t('support.you')}</span>
                <span className="text-[11px] text-neutral-400" title={formatFull(selected.created_at)}>{timeAgo(selected.created_at)}</span>
              </div>
              <p className="text-[13px] text-neutral-700 whitespace-pre-wrap leading-relaxed">{selected.message}</p>
              {(selected as any).attachments?.length > 0 && <AttachGallery attachments={(selected as any).attachments} />}
            </div>
          </div>

          {/* Replies */}
          {replies.map(reply => (
            <motion.div key={reply.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0
                ${reply.is_admin ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                {reply.is_admin ? 'H' : t('support.you')}
              </div>
              <div className={`flex-1 border rounded-xl p-4 min-w-0 ${reply.is_admin ? 'bg-neutral-50 border-neutral-200' : 'bg-white border-neutral-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-semibold text-neutral-700">
                    {reply.is_admin ? t('support.hontrio_team') : t('support.you')}
                  </span>
                  <span className="text-[11px] text-neutral-400" title={formatFull(reply.created_at)}>{timeAgo(reply.created_at)}</span>
                </div>
                <p className="text-[13px] text-neutral-700 whitespace-pre-wrap leading-relaxed">{reply.message}</p>
                {(reply.attachments?.length ?? 0) > 0 && <AttachGallery attachments={reply.attachments!} />}
              </div>
            </motion.div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Reply box */}
        {selected.status !== 'closed' ? (
          <div className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
            <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
              placeholder={t('support.write_reply')}
              className="w-full h-28 px-3.5 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-[13px] text-neutral-900 placeholder:text-neutral-300 resize-none focus:outline-none focus:border-neutral-300 focus:bg-white transition-all leading-relaxed"
              maxLength={5000}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendReply() }} />

            <DropZone onFiles={replyAtts.addFiles} disabled={replyAtts.pending.length >= MAX_FILES} />
            {replyAtts.pending.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {replyAtts.pending.map(f => <AttachChip key={f.localId} att={f} onRemove={() => replyAtts.remove(f.localId)} />)}
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-neutral-400">{t('support.ctrl_enter')}</span>
              <div className="flex items-center gap-2">
                {sendErr && <span className="text-[12px] text-red-500">{sendErr}</span>}
                <button onClick={sendReply}
                  disabled={sending || (!replyText.trim() && replyAtts.ready.length === 0) || replyAtts.uploading}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[12px] font-medium transition-all disabled:opacity-50">
                  {sending || replyAtts.uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {t('support.send_btn')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-[13px] text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-xl">
            {t('support.ticket_is_closed')}
          </div>
        )}
      </div>
    )
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight">
            {t('support.title')}
            {unread > 0 && (
              <span className="ml-2 text-[11px] font-semibold bg-neutral-900 text-white px-1.5 py-0.5 rounded-md align-middle">{unread} {t('support.new_badge')}</span>
            )}
          </h1>
          <p className="text-[13px] text-neutral-400 mt-0.5">{tickets.length === 1 ? t('support.ticket_count_one').replace('{count}', String(tickets.length)) : t('support.ticket_count_other').replace('{count}', String(tickets.length))}</p>
        </div>
        <button onClick={() => setView('create')}
          className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[13px] font-medium transition-all">
          <Plus className="h-3.5 w-3.5" />{t('support.new_ticket_btn')}
        </button>
      </div>

      {/* Support info banner */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border border-neutral-200 rounded-xl">
        <div className="h-9 w-9 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
          <Headphones className="h-4 w-4 text-neutral-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-neutral-800">{t('support.response_time')}</p>
          <p className="text-[11px] text-neutral-400">{t('support.work_hours')}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] text-emerald-600 font-medium">{t('support.online')}</span>
        </div>
      </div>

      {tickets.length > 0 && (
        <div className="flex items-center gap-1">
          {[
            { value: 'all', label: t('common.all'),     count: tickets.length },
            { value: 'open',        label: t('support.filter_open'),  count: tickets.filter(t => t.status === 'open').length },
            { value: 'in_progress', label: t('support.filter_in_progress'),  count: tickets.filter(t => t.status === 'in_progress').length },
            { value: 'resolved',    label: t('support.filter_resolved'), count: tickets.filter(t => t.status === 'resolved').length },
            { value: 'closed',      label: t('support.filter_closed'),   count: tickets.filter(t => t.status === 'closed').length },
          ].map(opt => (
            <button key={opt.value} onClick={() => setTabFilter(opt.value)}
              className={`flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-medium transition-all
                ${tabFilter === opt.value ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'}`}>
              {opt.label}
              {opt.count > 0 && (
                <span className={`text-[10px] tabular-nums ${tabFilter === opt.value ? 'text-neutral-400' : 'text-neutral-400'}`}>
                  {opt.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Tickets list */}
      {tickets.length === 0 ? (
        <div className="space-y-5">
          <div className="bg-white border border-neutral-200 rounded-xl text-center py-16">
            <div className="h-14 w-14 rounded-xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="h-6 w-6 text-neutral-300" />
            </div>
            <p className="text-[15px] font-semibold text-neutral-700 mb-1">{t('support.no_tickets')}</p>
            <p className="text-[13px] text-neutral-400 mb-5">{t('support.help_desc')}</p>
            <button onClick={() => setView('create')}
              className="h-9 px-5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[13px] font-medium transition-all">
              {t('support.open_ticket_btn')}
            </button>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-3">{t('support.faq')}</p>
            <div className="space-y-2">{FAQ.map((item, i) => <FaqItem key={i} q={item.q} a={item.a} />)}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-8 w-8 text-neutral-200 mx-auto mb-3" />
                <p className="text-[13px] text-neutral-400">{t('support.no_tickets')}</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-50">
                {filtered.map((ticket, i) => {
                  const cat = CATEGORY[ticket.category] || CATEGORY.general
                  const CatIcon = cat.icon
                  return (
                    <motion.div key={ticket.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      onClick={() => openTicket(ticket)}
                      className={`group flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-50 transition-colors cursor-pointer
                        ${ticket.has_unread ? 'bg-neutral-50/70' : ''}`}>
                      <div className="h-9 w-9 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
                        <CatIcon className="h-4 w-4 text-neutral-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[13px] font-medium text-neutral-900 truncate">{ticket.subject}</p>
                          {ticket.has_unread && (
                            <span className="text-[9px] font-bold bg-neutral-900 text-white px-1.5 py-0.5 rounded-md shrink-0">NOI</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={ticket.status} />
                          {ticket.replies_count > 0 && (
                            <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />{ticket.replies_count}
                            </span>
                          )}
                          <span className="text-[11px] text-neutral-400" title={formatFull(ticket.updated_at)}>
                            {timeAgo(ticket.updated_at)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0" />
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-3">{t('support.faq')}</p>
            <div className="space-y-2">{FAQ.map((item, i) => <FaqItem key={i} q={item.q} a={item.a} />)}</div>
          </div>
        </div>
      )}
    </div>
  )
}