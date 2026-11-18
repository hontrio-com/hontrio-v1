'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CalendarClock, ExternalLink, Play, Receipt, RotateCcw, Square } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { Card, CardHeader } from '@/components/app/surface'
import { Badge } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { Input } from '@/components/app/input'
import { Callout } from '@/components/app/feedback'
import { ConfirmDialog, Modal } from '@/components/app/dialog'
import { useAdminData } from '@/components/admin/use-admin-data'

// =============================================
// Administrarea facturării (pagina Financiar): pornirea, cu anunțul de 30 de
// zile (Termeni, art. 9.5), legătura SmartBill, magazinele cu pilotul oprit
// pentru neplată și situațiile tuturor, cu acțiunile lor (reîncercarea,
// factura cu rezultat necunoscut, anularea, scoaterea unei comenzi contestate).
// =============================================

type Order = { id: string; number: string; placed_at: string; value: number }
type Row = {
  id: string; email: string | null; store_name: string; period: string; currency: string; sales: number; fee: number
  adjustment: number; amount: number; status: string; invoice_series: string | null; invoice_number: string | null
  invoice_url: string | null; due_date: string | null; error: string | null; orders: Order[]
}
type AdminBilling = {
  today: string; active: boolean; start_date: string | null; notice_sent_at: string | null; earliest_start: string
  smartbill: { configured: boolean; series_ok: boolean | null; card_link: boolean; error: string | null }
  statements: Row[]; suspended: { store_id: string; store_name: string; since: string }[]
}

const TONE: Record<string, 'neutral' | 'green' | 'amber' | 'red'> = {
  free: 'neutral', pending: 'neutral', needs_profile: 'amber', issuing: 'red', invoiced: 'amber', paid: 'green', error: 'red', void: 'neutral',
}

async function act(body: Record<string, unknown>): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const r = await fetch('/api/admin/billing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { ok: r.ok, data: await r.json().catch(() => ({})) }
}

export default function BillingAdmin() {
  const { t, intlLocale } = useT()
  const { data, loading, refresh } = useAdminData<AdminBilling>('/api/admin/billing')
  const [start, setStart] = useState('')
  const [confirmStart, setConfirmStart] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [resolve, setResolve] = useState<Row | null>(null)
  const [series, setSeries] = useState('')
  const [number, setNumber] = useState('')
  const [exclude, setExclude] = useState<{ row: Row; order: Order } | null>(null)
  const [reason, setReason] = useState('')

  const fmt = useMemo(() => ({
    money: (n: number, c: string) => new Intl.NumberFormat(intlLocale, { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(n),
    day: (d: string) => new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d.slice(0, 10)}T00:00:00Z`)),
  }), [intlLocale])

  async function run(key: string, body: Record<string, unknown>, success: string) {
    setBusy(key)
    const r = await act(body)
    setBusy(null)
    if (!r.ok) { toast.error(String(r.data.error || t('billing.admin_failed'))); return false }
    toast.success(success)
    refresh()
    return true
  }

  if (loading && !data) return null
  if (!data) return <Callout tone="danger">{t('billing.load_failed')}</Callout>

  const sb = data.smartbill
  const revenue = data.statements.filter(s => s.status === 'paid').reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.currency]: (acc[s.currency] ?? 0) + s.amount }), {})

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<CalendarClock />} title={t('billing.admin_start_title')} description={
            data.active ? t('billing.status_active', { date: fmt.day(data.start_date!) })
              : data.start_date ? t('billing.status_scheduled', { date: fmt.day(data.start_date) }) : t('billing.admin_start_off')
          } />
          <div className="space-y-3 px-5 pb-5 text-[13px] text-neutral-600">
            {!data.active && !data.start_date && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="text-[12px] font-medium text-neutral-700">{t('billing.admin_start_date', { date: fmt.day(data.earliest_start) })}</span>
                  <Input type="date" min={data.earliest_start} value={start} onChange={e => setStart(e.target.value)} wrapperClassName="mt-1.5 w-48" />
                </label>
                <Button variant="primary" disabled={!start || start < data.earliest_start} onClick={() => setConfirmStart(true)}><Play />{t('billing.admin_start_btn')}</Button>
              </div>
            )}
            {!data.active && data.start_date && (
              <Button variant="secondary" loading={busy === 'stop'} onClick={() => run('stop', { action: 'stop' }, t('billing.admin_stopped'))}><Square />{t('billing.admin_stop_btn')}</Button>
            )}
            {data.notice_sent_at && <p>{t('billing.admin_notice_sent', { date: fmt.day(data.notice_sent_at) })}</p>}
            <p>{t('billing.admin_revenue', { ron: fmt.money(revenue.RON ?? 0, 'RON'), eur: fmt.money(revenue.EUR ?? 0, 'EUR') })}</p>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Receipt />} title={t('billing.admin_smartbill_title')} description={sb.configured ? t('billing.admin_smartbill_on') : t('billing.admin_smartbill_off')} />
          <div className="space-y-2 px-5 pb-5 text-[13px] text-neutral-600">
            <p className="flex items-center gap-2"><Badge tone={sb.configured ? 'green' : 'red'} dot>{sb.configured ? t('billing.admin_yes') : t('billing.admin_no')}</Badge>{t('billing.admin_smartbill_keys')}</p>
            {sb.configured && <p className="flex items-center gap-2"><Badge tone={sb.series_ok ? 'green' : 'red'} dot>{sb.series_ok ? t('billing.admin_yes') : t('billing.admin_no')}</Badge>{t('billing.admin_smartbill_series')}</p>}
            {sb.configured && <p className="flex items-center gap-2"><Badge tone={sb.card_link ? 'green' : 'neutral'} dot>{sb.card_link ? t('billing.admin_yes') : t('billing.admin_no')}</Badge>{t('billing.admin_smartbill_card')}</p>}
            {sb.error && <Callout tone="danger">{sb.error}</Callout>}
          </div>
        </Card>
      </div>

      {data.suspended.length > 0 && (
        <Card>
          <CardHeader title={t('billing.admin_suspended_title')} />
          <ul className="divide-y divide-neutral-100 px-5 pb-3 text-[13px]">
            {data.suspended.map(s => (
              <li key={s.store_id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-neutral-800">{s.store_name} · {fmt.day(s.since)}</span>
                <Button size="sm" variant="secondary" loading={busy === s.store_id} onClick={() => run(s.store_id, { action: 'unsuspend', store_id: s.store_id }, t('billing.admin_unsuspended'))}>{t('billing.admin_unsuspend')}</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader title={t('billing.admin_statements_title')} description={t('billing.admin_statements_desc')} />
        {data.statements.length === 0 ? <p className="px-5 pb-5 text-[13px] text-neutral-500">{t('billing.invoices_empty')}</p> : (
          <div className="overflow-x-auto px-5 pb-4">
            <table className="w-full min-w-[860px] text-left text-[12.5px]">
              <thead className="text-neutral-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">{t('billing.admin_col_month')}</th>
                  <th className="py-2 pr-3 font-medium">{t('billing.admin_col_client')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('billing.admin_col_sales')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('billing.admin_col_amount')}</th>
                  <th className="py-2 pr-3 font-medium">{t('billing.admin_col_status')}</th>
                  <th className="py-2 pr-3 font-medium">{t('billing.admin_col_invoice')}</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 align-top">
                {data.statements.map(s => (
                  <tr key={s.id}>
                    <td className="py-2.5 pr-3 font-medium text-neutral-900">{s.period}</td>
                    <td className="py-2.5 pr-3 text-neutral-700">{s.store_name}<span className="block text-[11.5px] text-neutral-500">{s.email ?? '—'}</span></td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{fmt.money(s.sales, s.currency)}<span className="block text-[11.5px] text-neutral-500">{s.orders.length} · {fmt.money(s.fee, s.currency)}</span></td>
                    <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-neutral-900">{fmt.money(s.amount, s.currency)}</td>
                    <td className="py-2.5 pr-3"><Badge tone={TONE[s.status] ?? 'neutral'}>{t(`billing.st_${s.status}`)}</Badge>{s.error && <span className="mt-1 block max-w-[220px] text-[11.5px] text-red-600">{s.error.startsWith('billing.') ? t(s.error) : s.error}</span>}</td>
                    <td className="py-2.5 pr-3 text-neutral-700">
                      {s.invoice_number ? <>{s.invoice_series} {s.invoice_number}{s.invoice_url && <a href={s.invoice_url} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex align-middle text-neutral-500 hover:text-neutral-900"><ExternalLink className="size-3.5" /></a>}</> : '—'}
                      {s.due_date && <span className="block text-[11.5px] text-neutral-500">{fmt.day(s.due_date)}</span>}
                    </td>
                    <td className="space-x-1 py-2.5 text-right whitespace-nowrap">
                      {['error', 'needs_profile', 'pending'].includes(s.status) && <Button size="xs" variant="secondary" loading={busy === s.id} onClick={() => run(s.id, { action: 'retry', statement_id: s.id }, t('billing.admin_retried'))}><RotateCcw />{t('billing.admin_retry')}</Button>}
                      {s.status === 'issuing' && <Button size="xs" variant="secondary" onClick={() => { setResolve(s); setSeries(''); setNumber('') }}>{t('billing.admin_resolve')}</Button>}
                      {s.status === 'invoiced' && <Button size="xs" variant="secondary" loading={busy === `v${s.id}`} onClick={() => run(`v${s.id}`, { action: 'void', statement_id: s.id }, t('billing.admin_voided'))}>{t('billing.admin_void')}</Button>}
                      {s.orders.length > 0 && (
                        <select className="h-7 rounded-lg border border-line bg-white px-1.5 text-[12px]" value="" onChange={e => { const o = s.orders.find(x => x.id === e.target.value); if (o) { setExclude({ row: s, order: o }); setReason('') } }}>
                          <option value="">{t('billing.admin_exclude')}</option>
                          {s.orders.map(o => <option key={o.id} value={o.id}>#{o.number} · {fmt.money(o.value, s.currency)}</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog open={confirmStart} onOpenChange={setConfirmStart} tone="primary"
        title={t('billing.admin_start_confirm_title', { date: start ? fmt.day(start) : '' })}
        description={t('billing.admin_start_confirm_desc')} confirmLabel={t('billing.admin_start_btn')} loading={busy === 'start'}
        onConfirm={async () => { if (await run('start', { action: 'start', start_date: start }, t('billing.admin_started'))) setConfirmStart(false) }} />

      <Modal open={!!resolve} onOpenChange={o => { if (!o) setResolve(null) }} title={t('billing.admin_resolve_title')} description={t('billing.admin_resolve_desc')}
        footer={<>
          <Button variant="secondary" loading={busy === 'none'} onClick={async () => { if (resolve && await run('none', { action: 'resolve', statement_id: resolve.id }, t('billing.admin_resolved'))) setResolve(null) }}>{t('billing.admin_resolve_missing')}</Button>
          <Button variant="primary" disabled={!series || !number} loading={busy === 'found'} onClick={async () => { if (resolve && await run('found', { action: 'resolve', statement_id: resolve.id, series, number }, t('billing.admin_resolved'))) setResolve(null) }}>{t('billing.admin_resolve_found')}</Button>
        </>}>
        <div className="grid grid-cols-2 gap-3">
          <Input value={series} onChange={e => setSeries(e.target.value)} placeholder={t('billing.admin_series')} />
          <Input value={number} onChange={e => setNumber(e.target.value)} placeholder={t('billing.admin_number')} />
        </div>
      </Modal>

      <Modal open={!!exclude} onOpenChange={o => { if (!o) setExclude(null) }} title={t('billing.admin_exclude_title', { number: exclude?.order.number ?? '' })} description={t('billing.admin_exclude_desc')}
        footer={<>
          <Button variant="secondary" onClick={() => setExclude(null)}>{t('billing.cancel')}</Button>
          <Button variant="primary" disabled={reason.trim().length < 3} loading={busy === 'exclude'} onClick={async () => { if (exclude && await run('exclude', { action: 'exclude', order_id: exclude.order.id, reason }, t('billing.admin_excluded'))) setExclude(null) }}>{t('billing.admin_exclude_btn')}</Button>
        </>}>
        <Input value={reason} onChange={e => setReason(e.target.value)} placeholder={t('billing.admin_exclude_reason')} />
      </Modal>
    </div>
  )
}
