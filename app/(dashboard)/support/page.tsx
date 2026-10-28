'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft, Bug, ChevronDown, ChevronRight, CreditCard, Download, FileText, Headphones, HelpCircle, Lightbulb, Link2,
  Loader2, MessageCircle, MessageSquare, Plus, Send, Upload, X, type LucideIcon,
} from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import type { TFunction } from '@/lib/i18n/translate'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardFooter } from '@/components/app/surface'
import { Badge, StatusDot, type Tone } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { Input, Textarea } from '@/components/app/input'
import { Segmented } from '@/components/app/tabs'
import { Callout, EmptyState, Skeleton } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { useNow } from '@/components/app/time'

// =============================================
// Suport — tichetele omului (cu răspunsurile echipei), un tichet nou (cu
// atașamente) și întrebările frecvente. Trei vederi pe aceeași pagină:
// lista, tichetul nou și conversația unui tichet.
// =============================================

type Attachment = { url: string; name: string; size: number; type: string }
type Ticket = {
  id: string; subject: string; message: string; status: string
  priority: string; category: string; created_at: string; updated_at: string
  replies_count: number; admin_replies_count: number; has_unread: boolean
  attachments?: Attachment[]
}
type Reply = {
  id: string; message: string; is_admin: boolean; created_at: string
  attachments?: Attachment[]
}
type Filter = 'all' | 'open' | 'in_progress' | 'resolved' | 'closed'

const STATUS_TONE: Record<string, Tone> = { open: 'outline', in_progress: 'amber', resolved: 'green', closed: 'neutral' }
const CATEGORIES: { id: string; icon: LucideIcon; label: string }[] = [
  { id: 'general', icon: HelpCircle, label: 'support.general' },
  { id: 'bug', icon: Bug, label: 'support.category_bug' },
  { id: 'feature', icon: Lightbulb, label: 'support.feature' },
  { id: 'billing', icon: CreditCard, label: 'support.billing' },
  { id: 'integration', icon: Link2, label: 'settings.tab_integrations' },
]
const FAQ = ['connect', 'credits', 'sync', 'image', 'publish', 'cms']

const MAX_FILES = 5
const MAX_SIZE = 10 * 1024 * 1024
const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain'

const categoryOf = (id: string) => CATEGORIES.find(c => c.id === id) ?? CATEGORIES[0]

/** „acum", „acum 5 minute", „ieri"; după o săptămână, data. */
function timeAgo(iso: string, t: TFunction, intlLocale: string, now: number) {
  const diff = now - new Date(iso).getTime()
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000)
  if (m < 2) return t('common.time_just_now')
  if (m < 60) return t('common.time_minutes_ago', { count: m })
  if (h < 24) return t('common.time_hours_ago', { count: h })
  if (d === 1) return t('common.time_yesterday')
  if (d < 7) return t('common.time_days_ago', { count: d })
  return new Date(iso).toLocaleDateString(intlLocale, { day: 'numeric', month: 'short' })
}

function formatFull(iso: string, intlLocale: string) {
  return new Date(iso).toLocaleDateString(intlLocale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const isImage = (type: string) => type.startsWith('image/')

// ─── Atașamentele ─────────────────────────────────────────────────────────────

type PendingFile = Attachment & { uploading: boolean; error?: string; localId: string }

function useAttachments() {
  const { t } = useT()
  const [pending, setPending] = useState<PendingFile[]>([])

  async function addFiles(files: FileList) {
    const toAdd = Array.from(files).slice(0, MAX_FILES - pending.length)
    for (const file of toAdd) {
      if (file.size > MAX_SIZE) { toast.error(t('support.file_too_large', { name: file.name })); continue }
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
  const { t } = useT()
  return (
    <div className={cn('flex max-w-[220px] items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] ring-1 ring-inset', att.error ? 'bg-red-50 ring-red-200' : 'bg-white ring-neutral-200')}>
      {isImage(att.type)
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={att.url} alt="" className="size-5 shrink-0 rounded object-cover" />
        : <FileText className="size-3.5 shrink-0 text-neutral-400" />}
      <span className="truncate font-medium text-neutral-700">{att.name}</span>
      {att.uploading ? <Loader2 className="size-3 shrink-0 animate-spin text-neutral-400" />
        : att.error ? <span className="shrink-0 text-[11px] font-semibold text-red-600" title={att.error}>!</span>
        : onRemove ? <button type="button" onClick={onRemove} aria-label={t('common.delete')} className="shrink-0 text-neutral-400 transition-colors hover:text-red-600"><X className="size-3" /></button>
        : att.url && <a href={att.url} target="_blank" rel="noopener" className="shrink-0 text-neutral-400 hover:text-neutral-700"><Download className="size-3" /></a>}
    </div>
  )
}

function AttachGallery({ attachments }: { attachments: Attachment[] }) {
  if (!attachments?.length) return null
  const imgs = attachments.filter(a => isImage(a.type))
  const files = attachments.filter(a => !isImage(a.type))
  return (
    <div className="mt-3 space-y-2">
      {imgs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imgs.map(a => (
            <a key={a.url} href={a.url} target="_blank" rel="noopener">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.name} className="size-20 rounded-lg object-cover ring-1 ring-neutral-200 transition-opacity hover:opacity-90" />
            </a>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((a, i) => <AttachChip key={a.url} att={{ ...a, uploading: false, localId: String(i) }} />)}
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
      className={cn('flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 transition-colors',
        drag ? 'border-neutral-500 bg-neutral-100' : 'border-neutral-300 bg-neutral-50/60 hover:border-neutral-400', disabled && 'pointer-events-none opacity-40')}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-neutral-500 ring-1 ring-neutral-200"><Upload className="size-3.5" /></span>
      <div>
        <p className="text-[13px] font-medium text-neutral-700">{t('common.add_files')} <span className="text-neutral-900 underline underline-offset-2">{t('common.or_drag')}</span></p>
        <p className="mt-0.5 text-[12px] text-neutral-500">{t('support.dropzone_hint', { count: MAX_FILES })}</p>
      </div>
      <input ref={ref} type="file" multiple accept={ACCEPTED} className="hidden" onChange={e => e.target.files && onFiles(e.target.files)} />
    </div>
  )
}

// ─── Întrebările frecvente ────────────────────────────────────────────────────

function Faq() {
  const { t } = useT()
  const [open, setOpen] = useState<string | null>(null)
  return (
    <section>
      <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em] text-neutral-900">{t('support.faq')}</h2>
      <Card className="divide-y divide-neutral-100 overflow-hidden">
        {FAQ.map(k => {
          const on = open === k
          return (
            <div key={k}>
              <button onClick={() => setOpen(on ? null : k)} aria-expanded={on}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-neutral-50/70">
                <span className="text-[14px] font-medium text-neutral-900">{t(`support.faq_${k}_q`)}</span>
                <ChevronDown className={cn('size-4 shrink-0 text-neutral-400 transition-transform duration-200', on && 'rotate-180')} />
              </button>
              <AnimatePresence initial={false}>
                {on && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <p className="px-5 pb-4 text-[13px] leading-relaxed text-neutral-600">{t(`support.faq_${k}_a`)}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </Card>
    </section>
  )
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useT()
  const known = status in STATUS_TONE
  return <Badge tone={STATUS_TONE[status] ?? 'outline'} dot>{t(`support.status_${known ? status : 'open'}`)}</Badge>
}

// ─── Pagina ───────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const { t, intlLocale } = useT()
  const now = useNow()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list')
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [filter, setFilter] = useState<Filter>('all')

  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [category, setCategory] = useState('general')
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState('')

  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendErr, setSendErr] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const createAtts = useAttachments()
  const replyAtts = useAttachments()

  useEffect(() => { fetchTickets() }, [])
  // Un răspuns nou: conversația coboară la el
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
        toast.success(t('support.ticket_sent'))
        await fetchTickets()
        setView('list')
      } else { setCreateErr(data.error || t('common.error_generic')) }
    } catch { setCreateErr(t('common.error_connection')) }
    finally { setCreating(false) }
  }

  async function openTicket(ticket: Ticket) {
    setSelected(ticket); setView('detail'); setReplies([]); setSendErr('')
    try {
      const r = await fetch('/api/tickets/' + ticket.id)
      const d = await r.json()
      setReplies(d.replies || [])
      setTickets(prev => prev.map(x => x.id === ticket.id ? { ...x, has_unread: false } : x))
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

  const ago = (iso: string) => timeAgo(iso, t, intlLocale, now || Date.parse(iso))
  const filtered = filter === 'all' ? tickets : tickets.filter(x => x.status === filter)
  const unread = tickets.filter(x => x.has_unread).length
  const back = (
    <Button variant="ghost" size="sm" className="-ml-2.5" onClick={() => { setView('list'); setSelected(null) }}>
      <ArrowLeft />{t('support.back_to_tickets')}
    </Button>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2"><Skeleton className="h-8 w-32" /><Skeleton className="h-4 w-48" /></div>
        <Skeleton className="h-16 rounded-xl" />
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    )
  }

  // ── Tichet nou ───────────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <FadeIn className="mx-auto max-w-2xl space-y-5">
        {back}
        <PageHeader title={t('support.new_ticket')} description={t('support.reply_24h')} />
        <form onSubmit={createTicket}>
          <Card>
            <div className="space-y-5 p-5">
              <label className="block">
                <span className="text-[13px] font-medium text-neutral-700">{t('support.subject')} <span className="text-red-500">*</span></span>
                <Input value={subject} onChange={e => setSubject(e.target.value)} required maxLength={200} placeholder={t('support.describe_short')} className="mt-1.5 h-10" />
                <span className="mt-1 block text-right text-[11px] tabular-nums text-neutral-400">{subject.length}/200</span>
              </label>

              <div>
                <p className="text-[13px] font-medium text-neutral-700">{t('products.category')}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {CATEGORIES.map(c => (
                    <button key={c.id} type="button" onClick={() => setCategory(c.id)} aria-pressed={category === c.id}
                      className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium ring-1 ring-inset transition-all',
                        category === c.id ? 'bg-neutral-900 text-white ring-neutral-900' : 'bg-white text-neutral-600 ring-neutral-200 hover:bg-neutral-50 hover:ring-neutral-300')}>
                      <c.icon className="size-3.5" />{t(c.label)}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-[13px] font-medium text-neutral-700">{t('support.message')} <span className="text-red-500">*</span></span>
                <Textarea value={message} onChange={e => setMessage(e.target.value)} required maxLength={5000} placeholder={t('support.describe_detailed')} className="mt-1.5 min-h-40" />
                <span className="mt-1 flex items-center gap-2">
                  <span className="h-0.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <span className={cn('block h-full rounded-full transition-all', message.length > 4500 ? 'bg-red-500' : message.length > 3000 ? 'bg-amber-500' : 'bg-neutral-300')}
                      style={{ width: `${(message.length / 5000) * 100}%` }} />
                  </span>
                  <span className="text-[11px] tabular-nums text-neutral-400">{message.length}/5000</span>
                </span>
              </label>

              <div>
                <p className="text-[13px] font-medium text-neutral-700">{t('support.attachments_optional')}</p>
                <div className="mt-1.5"><DropZone onFiles={createAtts.addFiles} disabled={createAtts.pending.length >= MAX_FILES} /></div>
                {createAtts.pending.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {createAtts.pending.map(f => <AttachChip key={f.localId} att={f} onRemove={() => createAtts.remove(f.localId)} />)}
                  </div>
                )}
              </div>

              {createErr && <Callout tone="danger">{createErr}</Callout>}
            </div>
            <CardFooter>
              <Button type="button" variant="ghost" onClick={() => setView('list')}>{t('common.cancel')}</Button>
              <Button type="submit" variant="primary" loading={creating || createAtts.uploading}>
                {!(creating || createAtts.uploading) && <Send />}
                {creating ? t('common.sending') : createAtts.uploading ? t('support.uploading_files') : t('support.send_ticket_btn')}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </FadeIn>
    )
  }

  // ── Conversația unui tichet ──────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    const cat = categoryOf(selected.category)
    const thread = [
      { id: 'first', message: selected.message, is_admin: false, created_at: selected.created_at, attachments: selected.attachments },
      ...replies,
    ]
    return (
      <FadeIn className="mx-auto max-w-2xl space-y-5">
        {back}
        <Card>
          <div className="flex items-start justify-between gap-3 p-5">
            <div className="min-w-0">
              <h1 className="text-[18px] font-semibold leading-snug tracking-[-0.015em] text-neutral-950">{selected.subject}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-neutral-500">
                <Badge><cat.icon className="size-3" />{t(cat.label)}</Badge>
                <span>{formatFull(selected.created_at, intlLocale)}</span>
              </div>
            </div>
            <StatusBadge status={selected.status} />
          </div>
        </Card>

        <ol className="space-y-3">
          {thread.map(entry => (
            <li key={entry.id} className="flex gap-3">
              <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                entry.is_admin ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200')}>
                {entry.is_admin ? 'H' : t('support.you')}
              </span>
              <div className={cn('min-w-0 flex-1 rounded-xl p-4 ring-1', entry.is_admin ? 'bg-neutral-50 ring-neutral-200' : 'bg-white ring-neutral-200/80')}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-neutral-800">{entry.is_admin ? t('support.hontrio_team') : t('support.you')}</span>
                  <time className="text-[12px] text-neutral-400" dateTime={entry.created_at} title={formatFull(entry.created_at, intlLocale)}>{ago(entry.created_at)}</time>
                </div>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-700">{entry.message}</p>
                {(entry.attachments?.length ?? 0) > 0 && <AttachGallery attachments={entry.attachments!} />}
              </div>
            </li>
          ))}
          <div ref={bottomRef} />
        </ol>

        {selected.status !== 'closed' ? (
          <Card>
            <div className="space-y-3 p-4">
              <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder={t('support.write_reply')} maxLength={5000} className="min-h-28"
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendReply() }} />
              <DropZone onFiles={replyAtts.addFiles} disabled={replyAtts.pending.length >= MAX_FILES} />
              {replyAtts.pending.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {replyAtts.pending.map(f => <AttachChip key={f.localId} att={f} onRemove={() => replyAtts.remove(f.localId)} />)}
                </div>
              )}
              {sendErr && <Callout tone="danger">{sendErr}</Callout>}
            </div>
            <CardFooter>
              <span className="text-[12px] text-neutral-500">{t('support.ctrl_enter')}</span>
              <Button variant="primary" loading={sending || replyAtts.uploading} onClick={sendReply}
                disabled={(!replyText.trim() && replyAtts.ready.length === 0)}>
                {!(sending || replyAtts.uploading) && <Send />}{t('support.send_btn')}
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Callout tone="info">{t('support.ticket_is_closed')}</Callout>
        )}
      </FadeIn>
    )
  }

  // ── Lista ─────────────────────────────────────────────────────────────────────
  const counts: Record<Filter, number> = {
    all: tickets.length,
    open: tickets.filter(x => x.status === 'open').length,
    in_progress: tickets.filter(x => x.status === 'in_progress').length,
    resolved: tickets.filter(x => x.status === 'resolved').length,
    closed: tickets.filter(x => x.status === 'closed').length,
  }
  return (
    <div className="space-y-6">
      <PageHeader title={t('support.title')} description={t('support.ticket_count', { count: tickets.length })}
        meta={unread > 0 ? <Badge tone="brand">{t('support.unread_count', { count: unread })}</Badge> : undefined}
        actions={<Button variant="primary" onClick={() => setView('create')}><Plus />{t('support.new_ticket_btn')}</Button>} />

      {/* Cine răspunde și când */}
      <FadeIn>
        <Card>
          <div className="flex items-center gap-3 px-5 py-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white"><Headphones className="size-[18px]" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-neutral-900">{t('support.response_time')}</p>
              <p className="text-[13px] text-neutral-500">{t('support.work_hours')}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-emerald-700"><StatusDot tone="green" live />{t('support.online')}</span>
          </div>
        </Card>
      </FadeIn>

      {tickets.length === 0 ? (
        <FadeIn delay={0.04}>
          <Card>
            <EmptyState icon={<MessageCircle />} title={t('support.no_tickets')} description={t('support.help_desc')}
              action={<Button variant="primary" onClick={() => setView('create')}><Plus />{t('support.open_ticket_btn')}</Button>} />
          </Card>
        </FadeIn>
      ) : (
        <FadeIn delay={0.04} className="space-y-4">
          <div className="overflow-x-auto [scrollbar-width:none]">
            <Segmented id="support-filter" value={filter} onChange={setFilter} items={([
              ['all', t('common.all')], ['open', t('support.filter_open')], ['in_progress', t('support.filter_in_progress')],
              ['resolved', t('support.filter_resolved')], ['closed', t('support.filter_closed')],
            ] as [Filter, string][]).map(([value, label]) => ({
              value, label: <span className="flex items-center gap-1.5">{label}{counts[value] > 0 && <span className="tabular-nums text-neutral-400">{counts[value]}</span>}</span>,
            }))} />
          </div>
          <Card className="overflow-hidden">
            {filtered.length === 0 ? (
              <p className="px-5 py-12 text-center text-[13px] text-neutral-400">{t('support.no_tickets')}</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {filtered.map(ticket => {
                  const cat = categoryOf(ticket.category)
                  return (
                    <li key={ticket.id}>
                      <button onClick={() => openTicket(ticket)}
                        className={cn('group flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-neutral-50/80', ticket.has_unread && 'bg-neutral-50/60')}>
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-neutral-500 ring-1 ring-inset ring-neutral-200/70"><cat.icon className="size-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className={cn('truncate text-[14px] text-neutral-900', ticket.has_unread ? 'font-semibold' : 'font-medium')}>{ticket.subject}</span>
                            {ticket.has_unread && <Badge tone="brand" className="h-[18px] px-1.5 text-[10px]">{t('support.new_badge')}</Badge>}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-neutral-500">
                            <StatusBadge status={ticket.status} />
                            {ticket.replies_count > 0 && <span className="flex items-center gap-1"><MessageSquare className="size-3" />{ticket.replies_count}</span>}
                            <time dateTime={ticket.updated_at} title={formatFull(ticket.updated_at, intlLocale)}>{ago(ticket.updated_at)}</time>
                          </span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-500" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </FadeIn>
      )}

      <FadeIn delay={0.08}><Faq /></FadeIn>
    </div>
  )
}
