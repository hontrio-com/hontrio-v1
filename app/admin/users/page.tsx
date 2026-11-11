'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Bell, CheckCircle2, Search, Send, Trash2, UserCheck, Users } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { PageHeader } from '@/components/app/page-header'
import { Card } from '@/components/app/surface'
import { DataRow } from '@/components/app/kpi'
import { Badge } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { ChoiceCard, Input, Select, Textarea } from '@/components/app/input'
import { Segmented } from '@/components/app/tabs'
import { Table, Td, Th, Tr } from '@/components/app/table'
import { Sheet, SheetHeader } from '@/components/app/sheet'
import { ConfirmDialog, Modal } from '@/components/app/dialog'
import { Callout, EmptyState, Skeleton } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { useFormats } from '@/components/app/formats'
import { UserAvatar } from '@/components/admin/parts'

// =============================================
// Utilizatorii: lista lor, cu căutare și filtru după rol. Un rând deschide
// panoul omului: rolul, notificările și ștergerea contului.
// =============================================

type User = {
  id: string; email: string; name: string | null; role: string
  onboarding_completed: boolean; created_at: string
}

const ROLES = ['user', 'admin']

const post = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

function Heading({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-2.5 text-[13px] font-semibold text-neutral-900">{children}</h4>
}

/** Fereastra unei notificări (către un om sau către toți). Se deschide de fiecare dată goală. */
function NotifyModal({ onClose, title, description, icon, titlePlaceholder, messagePlaceholder, submitLabel, onSend }: {
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

export default function AdminUsersPage() {
  const { t, intlLocale } = useT()
  const f = useFormats('USD')
  const roleLabel = (role: string) => t.has(`admin.users_role_${role}`) ? t(`admin.users_role_${role}`) : role

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  // Panoul unui om
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const selected = users.find(u => u.id === selectedId) ?? null

  // Ferestrele peste panou
  const [notifyUser, setNotifyUser] = useState<User | null>(null)
  const [globalOpen, setGlobalOpen] = useState(false)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/admin/users')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) setUsers(d.users ?? []) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const shown = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter(u =>
      (!q || u.email.toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q)) &&
      (roleFilter === 'all' || u.role === roleFilter))
  }, [users, search, roleFilter])

  const patchUser = (id: string, patch: Partial<User>) => setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u))

  const openUser = (user: User) => {
    setSelectedId(user.id)
    setSheetOpen(true)
  }

  const changeRole = async (user: User, role: string) => {
    setBusy(`role-${role}`)
    try {
      const res = await post('/api/admin/users/role', { user_id: user.id, role })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || t('admin.users_change_role_error')); return }
      toast.success(t('admin.users_role_changed', { role: roleLabel(role) }))
      patchUser(user.id, { role })
    } catch { toast.error(t('admin.users_change_role_error')) } finally { setBusy('') }
  }

  const removeUser = async () => {
    if (!deleteUser || deleteConfirm !== deleteUser.email) return
    setDeleting(true)
    try {
      const res = await post('/api/admin/users/delete', { user_id: deleteUser.id })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || t('admin.users_delete_error')); return }
      toast.success(data.message || t('admin.users_deleted'))
      setUsers(prev => prev.filter(u => u.id !== deleteUser.id))
      setDeleteUser(null)
      setSheetOpen(false)
    } catch { toast.error(t('admin.users_delete_error')) } finally { setDeleting(false) }
  }

  const sendNotification = async (body: Record<string, unknown>, okMessage: string) => {
    try {
      const res = await post('/api/notifications', body)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || t('admin.notification_send_error')); return false }
      toast.success(okMessage)
      return true
    } catch {
      toast.error(t('admin.notification_send_error'))
      return false
    }
  }

  return (
    <FadeIn className="space-y-6">
      <PageHeader title={t('admin.nav_users')} description={t('admin.users_registered_count', { count: users.length })}
        actions={<Button variant="primary" onClick={() => setGlobalOpen(true)}><Bell />{t('admin.users_global_notification')}</Button>} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input icon={<Search />} wrapperClassName="flex-1" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('admin.users_search_placeholder')} />
        <Select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} wrapperClassName="sm:w-40" aria-label={t('admin.users_role')}>
          <option value="all">{t('admin.users_role')}: {t('common.all')}</option>
          {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </Select>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10" />)}</div>
        ) : shown.length === 0 ? (
          <EmptyState icon={<Users />} title={t('admin.users_empty')} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t('admin.users_role_user')}</Th>
                <Th className="hidden md:table-cell">{t('admin.users_registered')}</Th>
                <Th><span className="sr-only">{t('admin.actions')}</span></Th>
              </tr>
            </thead>
            <tbody>
              {shown.map(user => (
                <Tr key={user.id} clickable onClick={() => openUser(user)}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <UserAvatar name={user.name} email={user.email} admin={user.role === 'admin'} />
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-medium text-neutral-900">
                          <span className="truncate">{user.name || t('admin.users_no_name')}</span>
                          {user.role === 'admin' && <Badge tone="brand" className="h-[18px] px-1 text-[10px]">{t('admin.users_role_admin')}</Badge>}
                        </p>
                        <p className="truncate text-[12px] text-neutral-500">{user.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="hidden whitespace-nowrap text-neutral-500 md:table-cell">{f.date.format(new Date(user.created_at))}</Td>
                  <Td align="right">
                    <Button size="icon" variant="ghost" title={t('admin.send_notification')} aria-label={t('admin.send_notification')}
                      onClick={e => { e.stopPropagation(); setNotifyUser(user) }}>
                      <Bell />
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Panoul omului */}
      <Sheet open={sheetOpen && !!selected} onOpenChange={setSheetOpen} width={480}>
        {selected && (
          <>
            <SheetHeader title={selected.name || t('admin.users_no_name')} description={selected.email} onClose={() => setSheetOpen(false)}
              icon={<span className="text-[15px] font-semibold">{(selected.name?.[0] ?? selected.email[0]).toUpperCase()}</span>} />
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <section>
                <Heading>{t('admin.users_change_role')}</Heading>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(role => (
                    <ChoiceCard key={role} active={selected.role === role} disabled={busy === `role-${role}`} onClick={() => { if (selected.role !== role) changeRole(selected, role) }} title={roleLabel(role)} />
                  ))}
                </div>
              </section>

              <section>
                <Heading>{t('admin.users_quick_actions')}</Heading>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => setNotifyUser(selected)}><Bell />{t('admin.send_notification')}</Button>
                  <Button variant="danger" aria-label={t('admin.users_delete_title')} title={t('admin.users_delete_title')}
                    onClick={() => { setDeleteUser(selected); setDeleteConfirm('') }}><Trash2 /></Button>
                </div>
              </section>

              <section>
                <Heading>{t('admin.users_details')}</Heading>
                <dl className="divide-y divide-neutral-100">
                  <DataRow label={t('admin.users_id')} value={<code className="text-[12px]">{selected.id.slice(0, 16)}…</code>} />
                  <DataRow label={t('admin.users_registered')} value={new Date(selected.created_at).toLocaleDateString(intlLocale, { day: 'numeric', month: 'long', year: 'numeric' })} />
                  <DataRow label={t('admin.users_onboarding')} value={(
                    selected.onboarding_completed
                      ? <Badge tone="green"><CheckCircle2 className="size-3" />{t('admin.users_onboarding_complete')}</Badge>
                      : <Badge tone="amber">{t('admin.users_onboarding_incomplete')}</Badge>
                  )} />
                </dl>
              </section>
            </div>
          </>
        )}
      </Sheet>

      {notifyUser && (
        <NotifyModal onClose={() => setNotifyUser(null)} title={t('admin.send_notification')}
          description={<>{t('admin.users_to')} <span className="font-medium text-neutral-700">{notifyUser.name || notifyUser.email}</span></>}
          icon={<UserCheck />} titlePlaceholder={t('admin.users_notification_title_placeholder')} messagePlaceholder={t('admin.users_notification_message_placeholder')}
          submitLabel={t('admin.send_notification')}
          onSend={n => sendNotification({ ...n, user_id: notifyUser.id, is_global: false }, t('admin.users_notification_sent', { name: notifyUser.name || notifyUser.email }))} />
      )}

      {globalOpen && (
        <NotifyModal onClose={() => setGlobalOpen(false)} title={t('admin.users_global_notification')}
          description={<>{t('admin.users_global_desc_before')} <span className="font-medium text-neutral-700">{t('admin.users_global_desc_all')}</span> {t('admin.users_global_desc_after')}</>}
          icon={<Bell />} titlePlaceholder={t('admin.users_global_title_placeholder')} messagePlaceholder={t('admin.users_global_message_placeholder')}
          submitLabel={t('admin.users_send_to_all')}
          onSend={n => sendNotification({ ...n, is_global: true }, t('admin.users_global_sent'))} />
      )}

      <ConfirmDialog open={!!deleteUser} onOpenChange={o => { if (!o) setDeleteUser(null) }} title={t('admin.users_delete_title')} description={t('admin.users_delete_permanent')}
        confirmLabel={t('admin.delete_permanently')} loading={deleting} disabled={deleteConfirm !== deleteUser?.email} onConfirm={removeUser}>
        <Callout tone="danger" title={t('admin.users_delete_list_title')}>
          <ul className="list-inside list-disc">
            <li>{t('admin.users_delete_item_account')}</li>
            <li>{t('admin.users_delete_item_products')}</li>
            <li>{t('admin.users_delete_item_stores')}</li>
            <li>{t('admin.users_delete_item_notifications')}</li>
          </ul>
        </Callout>
        <label htmlFor="delete-confirm" className="mb-1.5 mt-4 block text-[13px] text-neutral-600">
          {t('admin.users_delete_confirm_prompt')} <span className="font-medium text-neutral-900">{deleteUser?.email}</span>
        </label>
        <Input id="delete-confirm" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder={deleteUser?.email} autoComplete="off" />
      </ConfirmDialog>
    </FadeIn>
  )
}
