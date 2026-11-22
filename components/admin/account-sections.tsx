'use client'

import { useState } from 'react'
import { AlertTriangle, ChartLine, ExternalLink, Megaphone, Store } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import { Card, CardHeader } from '@/components/app/surface'
import { DataRow } from '@/components/app/kpi'
import { Badge, type Tone } from '@/components/app/badge'
import { Segmented } from '@/components/app/tabs'
import { Table, Td, Th, Tr } from '@/components/app/table'
import { TrendChart } from '@/components/app/charts'
import { EmptyState } from '@/components/app/feedback'
import { day, type Formats } from '@/components/app/formats'
import { useNow, useTimeAgo } from '@/components/app/time'
import { useMoney } from '@/components/admin/money'
import { platformName } from '@/lib/commerce/platforms'
import type { AccountDetail, Period, StoreDetail } from '@/lib/admin/accounts'

// =============================================
// Filele paginii unui cont, în panoul de administrare: prezentarea (comenzile
// din campaniile Hontrio pe 30 de zile, contul, legătura cu Google),
// magazinele (conexiunea, catalogul, pilotul), campaniile lansate de Hontrio
// (cu ce a făcut pilotul) și activitatea (tichetele, notificările).
// Fără datele Google ale clientului (lib/admin/accounts.ts).
// =============================================

function Rows({ children }: { children: React.ReactNode }) {
  return <dl className="divide-y divide-neutral-100">{children}</dl>
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-1 mt-4 text-[12px] font-semibold uppercase tracking-[0.04em] text-neutral-400 first:mt-0">{children}</h4>
}

const STATUS_TONE: Record<string, Tone> = { active: 'green', paused: 'amber', ended: 'neutral', removed: 'neutral', error: 'red', revoked: 'red' }

/** O dată și o oră, sau o liniuță. */
function useWhen(f: Formats) {
  return (iso: string | null | undefined) => (iso ? f.dateTime.format(new Date(iso)) : '—')
}

function YesNo({ on }: { on: boolean }) {
  const { t } = useT()
  return <Badge tone={on ? 'green' : 'amber'} dot>{t(on ? 'admin.yes' : 'admin.no')}</Badge>
}

// ─── Prezentarea ────────────────────────────────────────────────────────────

export function AccountOverview({ data, f }: { data: AccountDetail; f: Formats }) {
  const { t } = useT()
  const money = useMoney()
  const when = useWhen(f)
  const ago = useTimeAgo()
  const [storeId, setStoreId] = useState(data.stores[0]?.id ?? '')
  const store = data.stores.find(s => s.id === storeId) ?? data.stores[0] ?? null
  const empty = !store || store.series.every(p => !p.sales)
  const u = data.user

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('admin.acc_trend_title')} description={t('admin.acc_trend_hint')}
          action={data.stores.length > 1 ? (
            <Segmented id="acc-trend-store" size="sm" value={store?.id ?? ''} onChange={setStoreId} items={data.stores.slice(0, 4).map(s => ({ value: s.id, label: s.name }))} />
          ) : undefined} />
        {empty ? (
          <EmptyState icon={<ChartLine />} title={t('admin.acc_trend_empty')} className="py-12" />
        ) : (
          <div className="px-3 pb-4 pt-3">
            <TrendChart height={220} data={store!.series.map(p => ({ label: f.shortDate.format(day(p.date)), value: p.sales }))}
              format={n => money.one(n, store!.currency)} axisFormat={n => f.compact.format(n)} />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('admin.acc_account_title')} />
          <div className="px-5 pb-4 pt-2">
            <Rows>
              <DataRow label={t('admin.acc_id')} value={<code className="text-[12px]">{u.id}</code>} />
              <DataRow label={t('admin.acc_created')} value={when(u.created_at)} />
              <DataRow label={t('admin.acc_last_seen')} value={u.last_seen_at ? ago(u.last_seen_at) : t('admin.acc_never_seen')} />
              <DataRow label={t('admin.acc_email_verified')} value={u.email_verified_at ? when(u.email_verified_at) : <Badge tone="amber">{t('admin.badge_unverified')}</Badge>} />
              <DataRow label={t('admin.acc_terms')} value={u.terms_accepted_at ? `${when(u.terms_accepted_at)}${u.terms_version ? ` · ${u.terms_version}` : ''}` : <Badge tone="amber">{t('admin.acc_terms_missing')}</Badge>} />
              <DataRow label={t('admin.acc_onboarding')} value={u.onboarding_completed ? t('admin.users_onboarding_complete') : <Badge tone="amber">{t('admin.users_onboarding_incomplete')}</Badge>} />
              <DataRow label={t('admin.acc_language')} value={u.ui_locale ? u.ui_locale.toUpperCase() : t('admin.acc_language_auto')} />
              <DataRow label={t('admin.acc_active_store')} value={data.stores.find(s => s.id === u.active_store_id)?.name ?? data.stores[data.stores.length - 1]?.name ?? '—'} />
            </Rows>
          </div>
        </Card>

        <Card>
          <CardHeader title={t('admin.acc_google_title')} description={t('admin.acc_google_hint')} />
          <div className="px-5 pb-4 pt-2">
            {data.google ? (
              <Rows>
                <DataRow label={t('admin.acc_google_status')} value={<Badge tone={data.google.status === 'active' ? 'green' : 'red'} dot>{t(data.google.status === 'active' ? 'admin.status_connected' : 'admin.status_disconnected')}</Badge>} />
                <DataRow label={t('admin.acc_google_since')} value={when(data.google.connected_at)} />
                {data.google.last_error && <DataRow label={t('admin.acc_error')} value={<span className="text-red-600">{translateStored(t, data.google.last_error)}</span>} />}
              </Rows>
            ) : <p className="py-2 text-[13px] text-neutral-500">{t('admin.acc_google_none')}</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── Magazinele ─────────────────────────────────────────────────────────────

function StoreCard({ store: s, period, f }: { store: StoreDetail; period: Period; f: Formats }) {
  const { t } = useT()
  const money = useMoney()
  const when = useWhen(f)
  const ago = useTimeAgo()
  const sales = s.sales[period]
  const statusKey = s.connection_status === 'active' ? 'admin.status_connected' : s.connection_status === 'revoked' ? 'admin.status_revoked' : 'admin.status_problem'

  return (
    <Card>
      <CardHeader icon={<Store />} title={s.name}
        description={<>{platformName(s.platform)}{s.url && <> · <a href={s.url.startsWith('http') ? s.url : `https://${s.url}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-900">{s.url.replace(/^https?:\/\//, '')}<ExternalLink className="size-3" /></a></>}</>}
        action={<div className="flex flex-wrap justify-end gap-1.5">
          <Badge tone={STATUS_TONE[s.connection_status ?? ''] ?? 'amber'} dot>{t(statusKey)}</Badge>
          {s.pilot.suspended_at && <Badge tone="red">{t('admin.store_suspended')}</Badge>}
        </div>} />
      <div className="grid grid-cols-1 gap-x-8 px-5 pb-5 pt-2 md:grid-cols-2">
        <div>
          <Heading>{t('admin.store_section_store')}</Heading>
          <Rows>
            <DataRow label={t('admin.store_offers')} value={f.int.format(s.offers)} />
            <DataRow label={t('admin.store_orders_synced')} value={f.int.format(s.orders_count)} />
            <DataRow label={t('admin.store_currency')} value={[s.currency, s.timezone, s.country].filter(Boolean).join(' · ') || '—'} />
            <DataRow label={t('admin.store_connected_at')} value={when(s.created_at)} />
            <DataRow label={t('admin.store_last_sync')} value={s.last_sync_at ? ago(s.last_sync_at) : '—'} />
            {s.last_error && <DataRow label={t('admin.acc_error')} value={<span className="text-red-600">{translateStored(t, s.last_error)}</span>} />}
          </Rows>

          <Heading>{t('admin.store_section_setup')}</Heading>
          <Rows>
            <DataRow label={t('admin.store_setup_ads')} value={<YesNo on={s.setup.ads_account} />} />
            <DataRow label={t('admin.store_setup_merchant')} value={<YesNo on={s.setup.merchant} />} />
          </Rows>
        </div>

        <div>
          <Heading>{t(`admin.period_${period}`)}</Heading>
          {/* Gomag nu dă sursa comenzii: vânzările din campanii vin din Google Ads, care nu se arată aici */}
          {s.platform === 'gomag' ? (
            <p className="py-2 text-[13px] leading-relaxed text-neutral-500">{t('admin.store_fig_from_google')}</p>
          ) : (
            <Rows>
              <DataRow label={t('admin.store_fig_hontrio')} value={money.one(sales.sales, s.currency)} strong />
              <DataRow label={t('admin.store_fig_hontrio_orders')} value={f.int.format(sales.orders)} />
            </Rows>
          )}

          <Heading>{t('admin.store_section_pilot')}</Heading>
          <Rows>
            <DataRow label={t('admin.store_pilot_mode')} value={s.pilot.mode ? t(`campaigns.mode_${s.pilot.mode}`) : '—'} />
            <DataRow label={t('admin.store_pilot_pass')} value={s.pilot.synced_at ? ago(s.pilot.synced_at) : t('admin.store_pilot_never')} />
            <DataRow label={t('admin.store_pilot_today')} value={s.pilot.today_at ? ago(s.pilot.today_at) : '—'} />
            {s.pilot.error && <DataRow label={t('admin.acc_error')} value={<span className="text-red-600">{translateStored(t, s.pilot.error)}</span>} />}
            {s.pilot.suspended_at && <DataRow label={t('admin.store_suspended')} value={when(s.pilot.suspended_at)} />}
          </Rows>
        </div>
      </div>
    </Card>
  )
}

export function AccountStores({ data, period, f }: { data: AccountDetail; period: Period; f: Formats }) {
  const { t } = useT()
  if (!data.stores.length) return <Card><EmptyState icon={<Store />} title={t('admin.acc_no_stores')} className="py-14" /></Card>
  return <div className="space-y-4">{data.stores.map(s => <StoreCard key={s.id} store={s} period={period} f={f} />)}</div>
}

// ─── Campaniile ─────────────────────────────────────────────────────────────

export function AccountCampaigns({ data, f }: { data: AccountDetail; f: Formats }) {
  const { t } = useT()
  const money = useMoney()
  const ago = useTimeAgo()
  const storeName = new Map(data.stores.map(s => [s.id, s.name]))
  const many = data.stores.length > 1

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader title={t('admin.camp_title')} description={t('admin.camp_hint')}
          action={data.proposals_open > 0 ? <Badge tone="brand">{t('admin.camp_proposals', { count: data.proposals_open })}</Badge> : undefined} />
        {data.campaigns.length === 0 ? (
          <EmptyState icon={<Megaphone />} title={t('admin.camp_none')} className="py-12" />
        ) : (
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th className="min-w-[240px]">{t('admin.col_campaign')}</Th>
                  <Th>{t('admin.col_status')}</Th>
                  <Th align="right">{t('admin.col_budget')}</Th>
                  <Th className="hidden md:table-cell">{t('admin.col_launched')}</Th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map(c => (
                  <Tr key={c.id}>
                    <Td>
                      <p className="font-medium text-neutral-900">{c.name || t('admin.camp_unnamed')}</p>
                      <p className="text-[12px] text-neutral-500">
                        {[c.type === 'shopping' ? t('admin.camp_type_shopping') : t('admin.camp_type_pmax'), c.group, many ? storeName.get(c.store_id) : null].filter(Boolean).join(' · ')}
                      </p>
                      {c.last_error && <p className="mt-0.5 flex items-center gap-1 text-[12px] text-red-600"><AlertTriangle className="size-3" />{translateStored(t, c.last_error)}</p>}
                    </Td>
                    <Td><Badge tone={STATUS_TONE[c.status] ?? 'neutral'} dot live={c.status === 'active'}>{t(`admin.camp_status_${c.status}`)}</Badge></Td>
                    <Td align="right" className="tabular-nums">{c.daily_budget !== null ? money.one(c.daily_budget, c.currency) : '—'}</Td>
                    <Td className="hidden whitespace-nowrap text-neutral-500 md:table-cell">{c.launched_at ? f.date.format(new Date(c.launched_at)) : '—'}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title={t('admin.camp_journal_title')} description={t('admin.camp_journal_hint')} />
        <div className="px-5 pb-4 pt-2">
          {data.actions.length === 0 ? (
            <p className="py-2 text-[13px] text-neutral-500">{t('campaigns.journal_empty')}</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.actions.map(a => (
                <li key={a.id} className="flex items-start gap-3 py-2.5">
                  <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${a.status === 'applied' ? 'bg-emerald-500' : a.status === 'failed' ? 'bg-red-500' : 'bg-neutral-300'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-neutral-800">{t.has(`campaigns.kind_action_${a.kind}`) ? t(`campaigns.kind_action_${a.kind}`) : a.kind}</span>
                    <span className="block text-[12px] text-neutral-400">
                      {[a.campaign, t(a.source === 'user' ? 'admin.camp_by_client' : 'campaigns.by_pilot'), t(`admin.action_status_${a.status}`), ago(a.created_at)].filter(Boolean).join(' · ')}
                    </span>
                    {a.error && <span className="block text-[12px] text-red-600">{translateStored(t, a.error)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}

// ─── Activitatea ────────────────────────────────────────────────────────────

export function AccountActivity({ data, f }: { data: AccountDetail; f: Formats }) {
  const { t } = useT()
  const ago = useTimeAgo()
  const when = useWhen(f)
  const now = useNow()

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Intrările echipei în acest cont („Conectare”); clientul le vede și el, în Setări */}
      <Card className="overflow-hidden lg:col-span-2">
        <CardHeader title={t('admin.imp_title')} description={t('admin.imp_hint')} />
        {data.impersonations.length === 0 ? (
          <p className="px-5 pb-5 pt-3 text-[13px] text-neutral-500">{t('admin.imp_none')}</p>
        ) : (
          <div className="mt-3">
            <Table>
              <thead>
                <tr>
                  <Th>{t('admin.imp_col_admin')}</Th>
                  <Th>{t('admin.imp_col_started')}</Th>
                  <Th>{t('admin.imp_col_ended')}</Th>
                </tr>
              </thead>
              <tbody>
                {data.impersonations.map(i => {
                  const open = !i.ended_at && (!now || Date.parse(i.expires_at) > now)
                  return (
                    <Tr key={i.id}>
                      <Td className="text-neutral-800">{i.admin_email}</Td>
                      <Td className="whitespace-nowrap text-neutral-600">{when(i.started_at)}</Td>
                      <Td className="whitespace-nowrap">
                        {open ? <Badge tone="brand" dot live>{t('admin.imp_open')}</Badge>
                          : <span className="text-neutral-600">{when(i.ended_at ?? i.expires_at)}<span className="text-neutral-400"> · {t(`admin.imp_ended_${i.ended_by ?? 'expired'}`)}</span></span>}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title={t('admin.acc_tickets_title')} />
        <div className="px-5 pb-4 pt-2">
          {data.tickets.length === 0 ? <p className="py-2 text-[13px] text-neutral-500">{t('admin.acc_tickets_none')}</p> : (
            <ul className="divide-y divide-neutral-100">
              {data.tickets.map(tk => (
                <li key={tk.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-neutral-800">{tk.subject}</span>
                    <span className="block text-[12px] text-neutral-400">{ago(tk.created_at)}</span>
                  </span>
                  <Badge tone={tk.status === 'open' ? 'amber' : tk.status === 'in_progress' ? 'brand' : 'neutral'}>
                    {t.has(`admin.tickets_status_${tk.status}`) ? t(`admin.tickets_status_${tk.status}`) : tk.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title={t('admin.acc_notifications_title')} />
        <div className="px-5 pb-4 pt-2">
          {data.notifications.length === 0 ? <p className="py-2 text-[13px] text-neutral-500">{t('admin.acc_notifications_none')}</p> : (
            <ul className="divide-y divide-neutral-100">
              {data.notifications.map(n => (
                <li key={n.id} className="flex items-start gap-3 py-2.5">
                  <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${n.is_read ? 'bg-neutral-200' : 'bg-neutral-900'}`} />
                  <span className="min-w-0">
                    <span className="block text-[13px] text-neutral-800">{translateStored(t, n.title)}</span>
                    <span className="block text-[12px] text-neutral-400">{ago(n.created_at)} · {t(n.is_read ? 'admin.notif_read' : 'admin.notif_unread')}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}
