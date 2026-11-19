'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import type { TFunction } from '@/lib/i18n/translate'
import { Button } from '@/components/app/button'
import { Input, Textarea } from '@/components/app/input'
import { Segmented } from '@/components/app/tabs'
import { Modal } from '@/components/app/dialog'

// =============================================
// Fereastra unei notificări de la administrator, către un om sau către toți.
// Se deschide de fiecare dată goală; trimiterea merge prin /api/notifications.
// =============================================

export function NotifyModal({ onClose, title, description, icon, titlePlaceholder, messagePlaceholder, submitLabel, onSend }: {
  onClose: () => void
  title: string
  description: React.ReactNode
  icon?: React.ReactNode
  titlePlaceholder: string
  messagePlaceholder: string
  submitLabel: string
  onSend: (n: { title: string; message: string; type: string }) => Promise<boolean>
}) {
  const { t } = useT()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [type, setType] = useState('info')
  const [sending, setSending] = useState(false)

  const send = async () => {
    setSending(true)
    const sent = await onSend({ title: subject, message, type })
    setSending(false)
    if (sent) onClose()
  }

  return (
    <Modal open onOpenChange={o => { if (!o) onClose() }} title={title} description={description} icon={icon}
      footer={(
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={sending} disabled={!subject || !message} onClick={send}>{!sending && <Send />}{submitLabel}</Button>
        </>
      )}>
      <div className="space-y-4">
        <div>
          <label htmlFor="notify-title" className="mb-1.5 block text-[13px] font-medium text-neutral-700">{t('admin.field_title')}</label>
          <Input id="notify-title" value={subject} onChange={e => setSubject(e.target.value)} placeholder={titlePlaceholder} />
        </div>
        <div>
          <label htmlFor="notify-message" className="mb-1.5 block text-[13px] font-medium text-neutral-700">{t('admin.field_message')}</label>
          <Textarea id="notify-message" value={message} onChange={e => setMessage(e.target.value)} placeholder={messagePlaceholder} rows={4} />
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-neutral-700">{t('admin.field_type')}</p>
          <Segmented id="notify-type" size="sm" value={type} onChange={setType} items={['info', 'success', 'warning', 'error'].map(v => ({ value: v, label: t(`admin.notif_type_${v}`) }))} />
        </div>
      </div>
    </Modal>
  )
}

/** Trimite o notificare (unui om sau tuturor); spune în colț dacă a mers. */
export async function sendNotification(t: TFunction, body: Record<string, unknown>, okMessage: string): Promise<boolean> {
  try {
    const res = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data.error || t('admin.notification_send_error')); return false }
    toast.success(okMessage)
    return true
  } catch {
    toast.error(t('admin.notification_send_error'))
    return false
  }
}
