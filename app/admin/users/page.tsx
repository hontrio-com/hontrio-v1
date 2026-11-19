'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, Bell, ChevronRight, Receipt, Search, ShoppingBag, Store, Users } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { PageHeader } from '@/components/app/page-header'
import { Card } from '@/components/app/surface'
import { StatCard } from '@/components/app/kpi'
import { Badge, StatusDot } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { Input, Select } from '@/components/app/input'
import { Table, Td, Th, Tr } from '@/components/app/table'
import { EmptyState } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { useFormats } from '@/components/app/formats'
import { useTimeAgo } from '@/components/app/time'
import { useAdminData } from '@/components/admin/use-admin-data'
import { LoadError, PageSkeleton, RefreshButton, UserAvatar } from '@/components/admin/parts'
import { NotifyModal, sendNotification } from '@/components/admin/notify-modal'
import { useMoney } from '@/components/admin/money'
import { platformName } from '@/lib/commerce/platforms'
import { addMoney } from '@/lib/admin/money'
import type { AccountRow, AccountsList, Money } from '@/lib/admin/accounts'
import type { Balance } from '@/lib/admin/billing'

// =============================================
// Conturile: totalurile, căutarea, filtrele și tabelul cu fiecare cont
// (magazinul, campaniile pornite, comenzile aduse de campaniile Hontrio în
// ultimele 30 de zile, ce are de plată, ultima activitate). Fără datele Google
// ale clienților (lib/admin/accounts.ts). Un rând deschide pagina contului.
// =============================================

type Filter = 'all' | 'campaigns' | 'no_store' | 'due' | 'admins'
type Sort = 'newest' | 'seen' | 'hontrio' | 'due'
type Data = AccountsList & { balances?: Record<string, Balance> }

/** Suma pentru sortare: monedele adunate ca numere (doar ordinea contează). */
const total = (m: Money) => Object.values(m).reduce((s, v) => s + v, 0)

export default function AdminUsersPage() {
  const { t } = useT()
  const router = useRouter()
  const f = useFormats('RON')
  const money = useMoney()
  const ago = useTimeAgo()
  const { data, loading, refresh } = useAdminData<Data>('/api/admin/accounts')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('newest')
  const [globalOpen, setGlobalOpen] = useState(false)

  const shown = useMemo(() => {
    const due = (a: AccountRow) => total(data?.balances?.[a.id]?.due ?? {})
    const q = search.trim().toLowerCase()
    const rows = (data?.accounts ?? []).filter(a =>
      (!q || a.email.toLowerCase().includes(q) || (a.name ?? '').toLowerCase().includes(q) || a.stores.some(s => s.name.toLowerCase().includes(q)))
      && (filter === 'all'
        || (filter === 'campaigns' && a.campaigns.active > 0)
        || (filter === 'no_store' && a.stores.length === 0)
        || (filter === 'due' && due(a) > 0)
        || (filter === 'admins' && a.role === 'admin')))
    const key = (a: AccountRow): number | string => sort === 'seen' ? a.last_seen_at ?? ''
      : sort === 'hontrio' ? total(a.d30.sales) : sort === 'due' ? due(a) : a.created_at
    return [...rows].sort((a, b) => { const x = key(a); const y = key(b); return x < y ? 1 : x > y ? -1 : 0 })
  }, [data, search, filter, sort])

  if (loading && !data) return <PageSkeleton tiles={5} />
  if (!data?.accounts) return <LoadError />
  const totals = data.totals
  // De încasat, de la toate conturile
  const due: Money = {}
  let overdue = 0
  for (const b of Object.values(data.balances ?? {})) {
    for (const [c, v] of Object.entries(b.due)) addMoney(due, c, v)
    overdue += b.overdue_count
  }

  return (
    <FadeIn className="space-y-6">
      <PageHeader title={t('admin.nav_users')} description={t('admin.accounts_description')}
        actions={<>
          <RefreshButton loading={loading} onClick={refresh} />
          <Button variant="primary" onClick={() => setGlobalOpen(true)}><Bell />{t('admin.users_global_notification')}</Button>
        </>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label={t('admin.accounts_total')} value={f.int.format(totals.accounts)} icon={<Users />}
          footnote={t('admin.accounts_new_this_month', { count: totals.new_this_month })} />
        <StatCard label={t('admin.accounts_active_7d')} value={f.int.format(totals.active_7d)} icon={<Activity />} footnote={t('admin.accounts_active_7d_hint')} />
        <StatCard label={t('admin.accounts_stores')} value={f.int.format(totals.stores)} icon={<Store />}
          footnote={t('admin.accounts_campaigns_active', { count: totals.campaigns_active })} />
        <StatCard label={t('admin.accounts_hontrio_sales_30')} value={money.many(totals.d30.sales)} icon={<ShoppingBag />}
          footnote={t('admin.accounts_orders', { count: totals.d30.orders })} />
        <StatCard label={t('admin.accounts_due')} value={money.many(due)} icon={<Receipt />}
          footnote={overdue ? t('admin.bill_overdue_count', { count: overdue }) : t('admin.bill_overdue_none')} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input icon={<Search />} wrapperClassName="flex-1" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('admin.accounts_search')} />
        <Select value={filter} onChange={e => setFilter(e.target.value as Filter)} wrapperClassName="sm:w-52" aria-label={t('admin.accounts_filter')}>
          {(['all', 'campaigns', 'no_store', 'due', 'admins'] as const).map(v => <option key={v} value={v}>{t(`admin.accounts_filter_${v}`)}</option>)}
        </Select>
        <Select value={sort} onChange={e => setSort(e.target.value as Sort)} wrapperClassName="sm:w-52" aria-label={t('admin.accounts_sort')}>
          {(['newest', 'seen', 'hontrio', 'due'] as const).map(v => <option key={v} value={v}>{t(`admin.accounts_sort_${v}`)}</option>)}
        </Select>
      </div>

      <Card className="overflow-hidden">
        {shown.length === 0 ? (
          <EmptyState icon={<Users />} title={t('admin.users_empty')} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="min-w-[220px]">{t('admin.col_account')}</Th>
                <Th className="hidden md:table-cell">{t('admin.col_store')}</Th>
                <Th className="hidden lg:table-cell">{t('admin.col_campaigns')}</Th>
                <Th align="right">{t('admin.col_hontrio_sales_30')}</Th>
                <Th align="right" className="hidden sm:table-cell">{t('admin.col_due')}</Th>
                <Th className="hidden lg:table-cell">{t('admin.col_last_seen')}</Th>
                <Th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {shown.map(a => {
                const open = () => router.push(`/admin/users/${a.id}`)
                const balance = data.balances?.[a.id]
                return (
                  <Tr key={a.id} clickable tabIndex={0} onClick={open} onKeyDown={e => { if (e.key === 'Enter') open() }}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <UserAvatar name={a.name} email={a.email} admin={a.role === 'admin'} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-medium text-neutral-900">
                            <span className="truncate">{a.name || t('admin.users_no_name')}</span>
                            {a.role === 'admin' && <Badge tone="brand" className="h-[18px] px-1 text-[10px]">{t('admin.users_role_admin')}</Badge>}
                            {!a.email_verified && <Badge tone="amber" className="h-[18px] px-1 text-[10px]">{t('admin.badge_unverified')}</Badge>}
                          </p>
                          <p className="truncate text-[12px] text-neutral-500">{a.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="hidden md:table-cell">
                      {a.stores.length ? (
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate text-neutral-800">
                            <StatusDot tone={a.stores[0].status === 'active' ? 'green' : 'amber'} />
                            <span className="truncate">{a.stores[0].name}</span>
                            {a.stores.length > 1 && <span className="text-neutral-400">+{a.stores.length - 1}</span>}
                          </p>
                          <p className="text-[12px] text-neutral-500">{platformName(a.stores[0].platform)}</p>
                        </div>
                      ) : <span className="text-neutral-300">{t('admin.no_store')}</span>}
                    </Td>
                    <Td className="hidden lg:table-cell">
                      {a.campaigns.total ? <span className="text-neutral-700">{t('admin.accounts_campaigns_active', { count: a.campaigns.active })}</span> : <span className="text-neutral-300">—</span>}
                    </Td>
                    <Td align="right" className="tabular-nums text-neutral-900">
                      {money.many(a.d30.sales, '—')}
                      {a.d30.orders > 0 && <span className="block text-[12px] text-neutral-400">{t('admin.accounts_orders', { count: a.d30.orders })}</span>}
                    </Td>
                    <Td align="right" className="hidden tabular-nums sm:table-cell">
                      {balance && total(balance.due) > 0
                        ? <span className={balance.overdue_count ? 'font-medium text-red-600' : 'text-neutral-900'}>{money.many(balance.due)}</span>
                        : <span className="text-neutral-300">—</span>}
                    </Td>
                    <Td className="hidden whitespace-nowrap text-neutral-500 lg:table-cell">{a.last_seen_at ? ago(a.last_seen_at) : '—'}</Td>
                    <Td><ChevronRight className="size-4 text-neutral-300" /></Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {globalOpen && (
        <NotifyModal onClose={() => setGlobalOpen(false)} title={t('admin.users_global_notification')}
          description={<>{t('admin.users_global_desc_before')} <span className="font-medium text-neutral-700">{t('admin.users_global_desc_all')}</span> {t('admin.users_global_desc_after')}</>}
          icon={<Bell />} titlePlaceholder={t('admin.users_global_title_placeholder')} messagePlaceholder={t('admin.users_global_message_placeholder')}
          submitLabel={t('admin.users_send_to_all')}
          onSend={n => sendNotification(t, { ...n, is_global: true }, t('admin.users_global_sent'))} />
      )}
    </FadeIn>
  )
}
