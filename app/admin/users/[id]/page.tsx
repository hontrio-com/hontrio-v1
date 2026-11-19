'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Bell, History, LayoutGrid, Megaphone, ShoppingBag, Store, Trash2, UserCheck } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useT } from '@/lib/i18n/context'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardHeader } from '@/components/app/surface'
import { StatCard } from '@/components/app/kpi'
import { Badge } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { ChoiceCard, Input } from '@/components/app/input'
import { PageTabs, Segmented } from '@/components/app/tabs'
import { ConfirmDialog } from '@/components/app/dialog'
import { Callout } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { useFormats } from '@/components/app/formats'
import { useAdminData } from '@/components/admin/use-admin-data'
import { LoadError, PageSkeleton, RefreshButton, UserAvatar } from '@/components/admin/parts'
import { NotifyModal, sendNotification } from '@/components/admin/notify-modal'
import { useMoney } from '@/components/admin/money'
import { AccountActivity, AccountCampaigns, AccountOverview, AccountStores } from '@/components/admin/account-sections'
import type { AccountDetail, Period } from '@/lib/admin/accounts'

// =============================================
// Un cont, pe larg: cine e, comenzile aduse de campaniile Hontrio (luna
// aceasta, 30 de zile, de la început), magazinele, campaniile și
// activitatea. Fără datele Google ale clientului
// (politica de confidențialitate, lib/admin/accounts.ts). Rolul și ștergerea
// contului sunt jos, în prezentare.
// =============================================

type Tab = 'overview' | 'stores' | 'campaigns' | 'activity'
const ROLES = ['user', 'admin'] as const

const post = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export default function AccountPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { t } = useT()
  const { data: session } = useSession()
  const f = useFormats('RON')
  const money = useMoney()
  const { data, loading, refresh } = useAdminData<AccountDetail>(`/api/admin/accounts/${id}`)
  const [period, setPeriod] = useState<Period>('d30')
  const [tab, setTab] = useState<Tab>('overview')
  const [notify, setNotify] = useState(false)
  const [busy, setBusy] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  if (loading && !data) return <PageSkeleton tiles={3} />
  if (!data?.user) return <LoadError />
  const u = data.user
  const sales = data.sales[period]
  const self = u.id === session?.user?.id
  const roleLabel = (role: string) => t.has(`admin.users_role_${role}`) ? t(`admin.users_role_${role}`) : role
  const connected = data.stores.filter(s => s.connection_status === 'active').length
  const live = data.campaigns.filter(c => c.status === 'active').length

  async function changeRole(role: string) {
    setBusy(`role-${role}`)
    try {
      const res = await post('/api/admin/users/role', { user_id: u.id, role })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(body.error || t('admin.users_change_role_error')); return }
      toast.success(t('admin.users_role_changed', { role: roleLabel(role) }))
      refresh()
    } catch { toast.error(t('admin.users_change_role_error')) } finally { setBusy('') }
  }

  async function remove() {
    if (deleteConfirm !== u.email) return
    setDeleting(true)
    try {
      const res = await post('/api/admin/users/delete', { user_id: u.id })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(body.error || t('admin.users_delete_error')); return }
      toast.success(body.message || t('admin.users_deleted'))
      router.push('/admin/users')
    } catch { toast.error(t('admin.users_delete_error')) } finally { setDeleting(false) }
  }

  return (
    <FadeIn className="space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500 transition-colors hover:text-neutral-900">
        <ArrowLeft className="size-3.5" />{t('admin.nav_users')}
      </Link>

      <PageHeader
        title={<span className="flex items-center gap-3"><UserAvatar name={u.name} email={u.email} admin={u.role === 'admin'} className="size-10 text-[15px]" />{u.name || t('admin.users_no_name')}</span>}
        description={u.email}
        meta={<div className="flex flex-wrap gap-1.5">
          {u.role === 'admin' && <Badge tone="brand">{t('admin.users_role_admin')}</Badge>}
          {!u.email_verified_at && <Badge tone="amber">{t('admin.badge_unverified')}</Badge>}
          {!u.terms_accepted_at && <Badge tone="amber">{t('admin.acc_terms_missing')}</Badge>}
          {live > 0 && <Badge tone="green" dot live>{t('admin.badge_campaigns_live')}</Badge>}
        </div>}
        actions={<>
          <RefreshButton loading={loading} onClick={refresh} />
          <Button variant="primary" onClick={() => setNotify(true)}><Bell />{t('admin.send_notification')}</Button>
        </>} />

      <Segmented id="acc-period" value={period} onChange={setPeriod} items={(['month', 'd30', 'all'] as const).map(p => ({ value: p, label: t(`admin.period_${p}`) }))} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label={t('admin.kpi_hontrio_sales')} value={money.many(sales.sales)} icon={<ShoppingBag />}
          footnote={t('admin.accounts_orders', { count: sales.orders })} />
        <StatCard label={t('admin.kpi_stores')} value={f.int.format(data.stores.length)} icon={<Store />}
          footnote={t('admin.kpi_stores_connected', { count: connected })} />
        <StatCard label={t('admin.kpi_campaigns')} value={f.int.format(live)} icon={<Megaphone />}
          footnote={data.proposals_open ? t('admin.camp_proposals', { count: data.proposals_open }) : t('admin.kpi_campaigns_total', { count: data.campaigns.length })} />
      </div>

      <PageTabs id="account-tabs" value={tab} onChange={setTab} items={[
        { value: 'overview', label: t('admin.tab_overview'), icon: <LayoutGrid /> },
        { value: 'stores', label: t('admin.tab_stores'), icon: <Store />, count: data.stores.length },
        { value: 'campaigns', label: t('admin.tab_campaigns'), icon: <Megaphone />, count: data.campaigns.length },
        { value: 'activity', label: t('admin.tab_activity'), icon: <History /> },
      ]} />

      {tab === 'overview' && <AccountOverview data={data} f={f} />}
      {tab === 'stores' && <AccountStores data={data} period={period} f={f} />}
      {tab === 'campaigns' && <AccountCampaigns data={data} f={f} />}
      {tab === 'activity' && <AccountActivity data={data} />}

      {tab === 'overview' && (
        <Card>
          <CardHeader title={t('admin.acc_manage_title')} />
          <div className="space-y-5 px-5 pb-5 pt-3">
            <div>
              <p className="mb-2 text-[13px] font-medium text-neutral-700">{t('admin.users_change_role')}</p>
              <div className="grid max-w-md grid-cols-2 gap-2">
                {ROLES.map(role => (
                  <ChoiceCard key={role} active={u.role === role} disabled={busy === `role-${role}` || self}
                    onClick={() => { if (u.role !== role) changeRole(role) }} title={roleLabel(role)} />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
              <div>
                <p className="text-[13px] font-medium text-neutral-900">{t('admin.users_delete_title')}</p>
                <p className="text-[12px] text-neutral-500">{t('admin.users_delete_permanent')}</p>
              </div>
              <Button variant="danger" disabled={self} onClick={() => { setDeleteConfirm(''); setDeleteOpen(true) }}><Trash2 />{t('admin.users_delete_title')}</Button>
            </div>
          </div>
        </Card>
      )}

      {notify && (
        <NotifyModal onClose={() => setNotify(false)} title={t('admin.send_notification')}
          description={<>{t('admin.users_to')} <span className="font-medium text-neutral-700">{u.name || u.email}</span></>}
          icon={<UserCheck />} titlePlaceholder={t('admin.users_notification_title_placeholder')} messagePlaceholder={t('admin.users_notification_message_placeholder')}
          submitLabel={t('admin.send_notification')}
          onSend={n => sendNotification(t, { ...n, user_id: u.id, is_global: false }, t('admin.users_notification_sent', { name: u.name || u.email }))} />
      )}

      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title={t('admin.users_delete_title')} description={t('admin.users_delete_permanent')}
        confirmLabel={t('admin.delete_permanently')} loading={deleting} disabled={deleteConfirm !== u.email} onConfirm={remove}>
        <Callout tone="danger" title={t('admin.users_delete_list_title')}>
          <ul className="list-inside list-disc">
            <li>{t('admin.users_delete_item_account')}</li>
            <li>{t('admin.users_delete_item_products')}</li>
            <li>{t('admin.users_delete_item_stores')}</li>
            <li>{t('admin.users_delete_item_notifications')}</li>
          </ul>
        </Callout>
        <label htmlFor="delete-confirm" className="mb-1.5 mt-4 block text-[13px] text-neutral-600">
          {t('admin.users_delete_confirm_prompt')} <span className="font-medium text-neutral-900">{u.email}</span>
        </label>
        <Input id="delete-confirm" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder={u.email} autoComplete="off" />
      </ConfirmDialog>
    </FadeIn>
  )
}
