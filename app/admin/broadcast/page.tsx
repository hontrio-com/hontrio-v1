'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardFooter, CardHeader } from '@/components/app/surface'
import { Button } from '@/components/app/button'
import { ChoiceCard, Input, Textarea } from '@/components/app/input'
import { ConfirmDialog } from '@/components/app/dialog'
import { FadeIn } from '@/components/app/motion'

// =============================================
// Anunțuri: o notificare în aplicație către toți oamenii. În dreapta se vede
// cum arată; trimiterea cere o confirmare, fiindcă nu se mai poate lua înapoi.
// =============================================

const TYPES = ['info', 'success', 'warning', 'error']

export default function BroadcastPage() {
  const { t } = useT()
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [type, setType] = useState('info')
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const ready = !!title.trim() && !!message.trim()

  const send = async () => {
    setSending(true)
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, type }),
      })
      const data = await res.json()
      if (data.sent) {
        toast.success(t('admin.broadcast_sent', { count: Number(data.sent) }))
        setTitle('')
        setMessage('')
      } else {
        toast.error(data.error || t('admin.notification_send_error'))
      }
    } catch {
      toast.error(t('common.error_connection'))
    } finally {
      setSending(false)
      setConfirming(false)
    }
  }

  return (
    <FadeIn className="space-y-6">
      <PageHeader title={t('admin.broadcast_title')} description={t('admin.broadcast_subtitle')} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <div className="space-y-5 p-5">
            <div>
              <p className="mb-2 text-[13px] font-medium text-neutral-700">{t('admin.broadcast_message_type')}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {TYPES.map(v => (
                  <ChoiceCard key={v} active={type === v} onClick={() => setType(v)} title={t(`admin.notif_type_${v}`)} description={t(`admin.broadcast_type_${v}_desc`)} />
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="broadcast-title" className="mb-1.5 block text-[13px] font-medium text-neutral-700">{t('admin.field_title')}</label>
              <Input id="broadcast-title" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('admin.broadcast_title_placeholder')} maxLength={80} />
            </div>

            <div>
              <label htmlFor="broadcast-message" className="mb-1.5 block text-[13px] font-medium text-neutral-700">{t('admin.field_message')}</label>
              <Textarea id="broadcast-message" value={message} onChange={e => setMessage(e.target.value)} placeholder={t('admin.broadcast_message_placeholder')} rows={4} maxLength={500} />
              <p className="mt-1 text-right text-[12px] tabular-nums text-neutral-400">{message.length}/500</p>
            </div>
          </div>
          <CardFooter className="justify-end">
            <Button variant="primary" disabled={!ready} onClick={() => setConfirming(true)}><Send />{t('admin.send_notification')}</Button>
          </CardFooter>
        </Card>

        <Card className="lg:sticky lg:top-20">
          <CardHeader title={t('admin.broadcast_preview')} />
          <div className="p-5 pt-3">
            <div className="rounded-xl bg-neutral-50 p-4 ring-1 ring-neutral-200/70">
              <p className="break-words text-[13px] font-semibold text-neutral-900">{title || '—'}</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-neutral-500">{message || '—'}</p>
            </div>
          </div>
        </Card>
      </div>

      <ConfirmDialog open={confirming} onOpenChange={setConfirming} tone="primary" title={t('admin.send_notification')} description={t('admin.broadcast_confirm')}
        confirmLabel={sending ? t('common.sending') : t('admin.send_notification')} loading={sending} onConfirm={send} />
    </FadeIn>
  )
}
