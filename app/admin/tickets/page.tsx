'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, Bug, ChevronRight, CreditCard, HelpCircle, Lightbulb, Link2, Mail, MessageSquare, Search, Send, Shield, User, X, type LucideIcon,
} from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardFooter } from '@/components/app/surface'
import { Badge, type Tone } from '@/components/app/badge'
import { Button, textActionStyles } from '@/components/app/button'
import { Input, Textarea } from '@/components/app/input'
import { PageTabs, Segmented } from '@/components/app/tabs'
import { Table, Td, Th, Tr } from '@/components/app/table'
import { Pagination } from '@/components/app/pagination'
import { Callout, EmptyState, Skeleton } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { useFormats } from '@/components/app/formats'
import { useDebounced, useTimeAgo } from '@/components/app/time'
import { ACCEPTED_FILES, AttachChip, AttachGallery, DropZone, MAX_FILES, useAttachments, type Attachment } from '@/components/app/attachments'
import { UserAvatar } from '@/components/admin/parts'

// =============================================
// Tichetele de suport: lista tuturor, cu filtre după status și căutare, și
// conversația unui tichet, de unde se răspunde și se schimbă statusul.
// =============================================

type Ticket = {
  id: string; subject: string; message: string; status: string; priority: string; category: string
  created_at: string; updated_at: string
  users: { name: string; email: string }
  attachments?: Attachment[]
}
type Reply = {
  id: string; message: string; is_admin: boolean; created_at: string
  users: { name: string; email: string }
  attachments?: Attachment[]
}
type Page = { key: string; tickets: Ticket[]; pages: number; total: number; counts: Record<string, number> }

const STATUSES = ['open', 'in_progress', 'resolved', 'closed']
const STATUS_TONE: Record<string, Tone> = { open: 'outline', in_progress: 'amber', resolved: 'green', closed: 'neutral' }
const PRIORITY_TONE: Record<string, Tone> = { low: 'neutral', normal: 'neutral', high: 'amber', urgent: 'red' }
const CATEGORY_ICON: Record<string, LucideIcon> = { general: HelpCircle, bug: Bug, feature: Lightbulb, billing: CreditCard, integration: Link2 }
// Administratorul poate trimite și documente Word
const ACCEPTED = `${ACCEPTED_FILES},application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword`

export default function AdminTicketsPage() {
  const { t } = useT()
  const f = useFormats('USD')
  const ago = useTimeAgo()
  const when = (iso: string) => f.dateTime.format(new Date(iso))

  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounced(searchInput, 400)

  // O pagină de tichete, cu filtrele ei: cât nu vine pagina cerută, se încarcă
  const key = JSON.stringify({ status, page, search })
  const [list, setList] = useState<Page | null>(null)
  const loading = list?.key !== key

  useEffect(() => {
    let alive = true
    const params = new URLSearchParams({ page: String(page) })
    if (status !== 'all') params.set('status', status)
    if (search) params.set('search', search)
    fetch(`/api/admin/tickets?${params}`)
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(d => {
        if (alive) setList({ key, tickets: d?.tickets ?? [], pages: d?.total_pages ?? 0, total: d?.total ?? 0, counts: d?.status_counts ?? {} })
      })
    return () => { alive = false }
  }, [key, page, status, search])

  const tickets = list?.tickets ?? []
  const counts = list?.counts ?? {}

  const [selected, setSelected] = useState<Ticket | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const replyAtts = useAttachments()

  useEffect(() => {
    if (replies.length > 0) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [replies])

  const setTicketStatus = (id: string, from: string, to: string) => {
    setSelected(s => (s?.id === id ? { ...s, status: to } : s))
    setList(l => l && {
      ...l,
      tickets: l.tickets.map(x => (x.id === id ? { ...x, status: to } : x)),
      counts: { ...l.counts, [from]: Math.max(0, (l.counts[from] ?? 0) - 1), [to]: (l.counts[to] ?? 0) + 1 },
    })
  }

  async function openTicket(ticket: Ticket) {
    setSelected(ticket)
    setReplies([])
    setSendError('')
    try {
      const res = await fetch(`/api/admin/tickets/${ticket.id}`)
      const data = await res.json()
      setReplies(data.replies ?? [])
    } catch {}
  }

  async function updateStatus(next: string) {
    if (!selected || updatingStatus || selected.status === next) return
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/admin/tickets/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (res.ok) setTicketStatus(selected.id, selected.status, next)
    } catch {} finally { setUpdatingStatus(false) }
  }

  async function sendReply() {
    if ((!replyText.trim() && replyAtts.ready.length === 0) || !selected || sending || replyAtts.uploading) return
    setSending(true)
    setSendError('')
    try {
      const res = await fetch(`/api/admin/tickets/${selected.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText, attachments: replyAtts.ready }),
      })
      const data = await res.json()
      if (res.ok) {
        setReplies(prev => [...prev, { ...data.reply, users: { name: t('admin.users_role_admin'), email: '' } }])
        setReplyText('')
        replyAtts.clear()
        // La primul răspuns, serverul trece tichetul „În lucru"
        if (selected.status === 'open') setTicketStatus(selected.id, 'open', 'in_progress')
      } else {
        setSendError(data.error || t('admin.tickets_send_error'))
      }
    } catch { setSendError(t('common.error_connection')) } finally { setSending(false) }
  }

  const statusLabel = (s: string) => t(`admin.tickets_status_${s in STATUS_TONE ? s : 'open'}`)
  const statusBadge = (value: string) => <Badge tone={STATUS_TONE[value] ?? 'outline'} dot>{statusLabel(value)}</Badge>
  const priorityBadge = (value: string) => <Badge tone={PRIORITY_TONE[value] ?? 'neutral'}>{t(`admin.tickets_priority_${value in PRIORITY_TONE ? value : 'normal'}`)}</Badge>

  // ── Conversația unui tichet ────────────────────────────────────────────────
  if (selected) {
    const Cat = CATEGORY_ICON[selected.category] ?? HelpCircle
    const thread: Reply[] = [
      { id: 'first', message: selected.message, is_admin: false, created_at: selected.created_at, users: selected.users, attachments: selected.attachments },
      ...replies,
    ]
    return (
      <FadeIn className="mx-auto max-w-3xl space-y-5">
        <button onClick={() => { setSelected(null); setReplies([]) }} className={cn(textActionStyles, 'text-[13px]')}>
          <ArrowLeft />{t('admin.tickets_all')}
        </button>

        <Card>
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-[18px] font-semibold leading-snug tracking-[-0.015em] text-neutral-950">{selected.subject}</h1>
              {statusBadge(selected.status)}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-neutral-500">
              <span className="flex items-center gap-1.5 font-medium text-neutral-700"><User className="size-3.5 text-neutral-400" />{selected.users?.name || t('admin.users_role_user')}</span>
              <span className="flex items-center gap-1.5"><Mail className="size-3.5 text-neutral-400" />{selected.users?.email}</span>
              <Badge><Cat className="size-3" />{t(`admin.tickets_category_${selected.category in CATEGORY_ICON ? selected.category : 'general'}`)}</Badge>
              {priorityBadge(selected.priority)}
              <span title={when(selected.created_at)}>{ago(selected.created_at)}</span>
            </div>
          </div>
          <CardFooter className="flex-wrap">
            <span className="text-[13px] text-neutral-600">{t('admin.tickets_change_status')}</span>
            <Segmented id="ticket-status" size="sm" value={selected.status} onChange={updateStatus} items={STATUSES.map(s => ({ value: s, label: statusLabel(s) }))} />
          </CardFooter>
        </Card>

        <ol className="space-y-3">
          {thread.map(entry => (
            <li key={entry.id} className="flex gap-3">
              {entry.is_admin
                ? <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white"><Shield className="size-3.5" /></span>
                : <UserAvatar name={entry.users?.name ?? null} email={entry.users?.email} />}
              <div className={cn('min-w-0 flex-1 rounded-xl p-4 ring-1', entry.is_admin ? 'bg-neutral-50 ring-neutral-200' : 'bg-white ring-neutral-200/80')}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-neutral-800">{entry.users?.name || t(entry.is_admin ? 'admin.users_role_admin' : 'admin.users_role_user')}</span>
                  <time className="text-[12px] text-neutral-400" dateTime={entry.created_at} title={when(entry.created_at)}>{ago(entry.created_at)}</time>
                </div>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-700">{entry.message}</p>
                {(entry.attachments?.length ?? 0) > 0 && <AttachGallery attachments={entry.attachments!} />}
              </div>
            </li>
          ))}
          <div ref={bottomRef} />
        </ol>

        <Card>
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold text-neutral-800">{t('admin.tickets_reply_as_admin')}</p>
              {selected.status === 'open' && <Badge tone="amber">{t('admin.tickets_will_become', { status: statusLabel('in_progress') })}</Badge>}
            </div>
            <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder={t('admin.tickets_reply_placeholder')} maxLength={5000} className="min-h-28"
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendReply() }} />
            <DropZone onFiles={replyAtts.addFiles} disabled={replyAtts.pending.length >= MAX_FILES} accept={ACCEPTED} hint={t('admin.tickets_dropzone_hint', { max: MAX_FILES })} />
            {replyAtts.pending.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {replyAtts.pending.map(file => <AttachChip key={file.localId} att={file} onRemove={() => replyAtts.remove(file.localId)} />)}
              </div>
            )}
            {sendError && <Callout tone="danger">{sendError}</Callout>}
          </div>
          <CardFooter>
            <span className="text-[12px] text-neutral-500">{t('admin.tickets_reply_counter', { length: replyText.length })}</span>
            <Button variant="primary" loading={sending || replyAtts.uploading} onClick={sendReply} disabled={!replyText.trim() && replyAtts.ready.length === 0}>
              {!(sending || replyAtts.uploading) && <Send />}{t('admin.tickets_send')}
            </Button>
          </CardFooter>
        </Card>
      </FadeIn>
    )
  }

  // ── Lista ──────────────────────────────────────────────────────────────────
  return (
    <FadeIn className="space-y-6">
      <PageHeader title={t('admin.tickets_title')} description={t('admin.tickets_total', { count: list?.total ?? 0 })}
        actions={(counts.open ?? 0) > 0 ? <Badge tone="brand" live>{t('admin.tickets_open_count', { count: counts.open })}</Badge> : undefined}>
        <PageTabs id="ticket-filter" value={status} onChange={v => { setStatus(v); setPage(1) }} items={[
          { value: 'all', label: t('common.all'), count: counts.all },
          { value: 'open', label: t('admin.tickets_filter_open'), count: counts.open, attention: true },
          { value: 'in_progress', label: t('admin.tickets_status_in_progress'), count: counts.in_progress },
          { value: 'resolved', label: t('admin.tickets_filter_resolved'), count: counts.resolved },
          { value: 'closed', label: t('admin.tickets_filter_closed'), count: counts.closed },
        ]} />
      </PageHeader>

      <div className="relative max-w-sm">
        <Input icon={<Search />} value={searchInput} onChange={e => { setSearchInput(e.target.value); setPage(1) }} placeholder={t('admin.tickets_search_placeholder')} className="pr-9" />
        {searchInput && (
          <button onClick={() => setSearchInput('')} aria-label={t('common.close')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700">
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <Card className="overflow-hidden">
        {loading && !list ? (
          <div className="space-y-3 p-5">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10" />)}</div>
        ) : tickets.length === 0 ? (
          <EmptyState icon={<MessageSquare />} title={t('admin.tickets_empty')} description={search ? t('admin.tickets_empty_search', { query: search }) : undefined} />
        ) : (
          <>
            <Table className={cn(loading && 'opacity-60')}>
              <thead>
                <tr>
                  <Th>{t('admin.tickets_col_subject')}</Th>
                  <Th className="hidden md:table-cell">{t('admin.users_role_user')}</Th>
                  <Th className="hidden sm:table-cell">{t('common.priority')}</Th>
                  <Th>{t('admin.status')}</Th>
                  <Th className="hidden sm:table-cell" align="right">{t('admin.date')}</Th>
                  <Th><span className="sr-only">{t('admin.actions')}</span></Th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(ticket => {
                  const Cat = CATEGORY_ICON[ticket.category] ?? HelpCircle
                  return (
                    <Tr key={ticket.id} clickable onClick={() => openTicket(ticket)}>
                      <Td className="max-w-[320px]">
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500"><Cat className="size-3.5" /></span>
                          <p className="truncate font-medium text-neutral-900">{ticket.subject}</p>
                        </div>
                      </Td>
                      <Td className="hidden max-w-[220px] md:table-cell">
                        <p className="truncate text-neutral-800">{ticket.users?.name || '—'}</p>
                        <p className="truncate text-[12px] text-neutral-500">{ticket.users?.email}</p>
                      </Td>
                      <Td className="hidden sm:table-cell">{priorityBadge(ticket.priority)}</Td>
                      <Td>{statusBadge(ticket.status)}</Td>
                      <Td className="hidden whitespace-nowrap text-neutral-500 sm:table-cell" align="right"><span title={when(ticket.updated_at)}>{ago(ticket.updated_at)}</span></Td>
                      <Td align="right"><ChevronRight className="ml-auto size-4 text-neutral-300 transition-colors group-hover:text-neutral-600" /></Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
            <Pagination page={page} pages={list?.pages ?? 0} onChange={setPage} />
          </>
        )}
      </Card>
    </FadeIn>
  )
}
