'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowRight, CalendarClock, FileText, Play, Receipt, Square } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { Card, CardHeader } from '@/components/app/surface'
import { Badge } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { Input } from '@/components/app/input'
import { Callout } from '@/components/app/feedback'
import { ConfirmDialog } from '@/components/app/dialog'
import { useAdminData } from '@/components/admin/use-admin-data'

// =============================================
// Administrarea facturării (pagina Financiar): pornirea, cu anunțul de 30 de
// zile (Termeni, art. 9.5), legătura SmartBill și magazinele cu pilotul oprit
// pentru neplată. Facturile, cu acțiunile lor (reîncercarea, factura cu
// rezultat necunoscut, anularea, scoaterea unei comenzi contestate), sunt în
// pagina Facturi (app/admin/invoices).
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
        <CardHeader icon={<FileText />} title={t('admin.inv_link_title')} description={t('admin.inv_link_desc', { count: data.statements.length })}
          action={<Button asChild size="sm"><Link href="/admin/invoices">{t('admin.nav_invoices')}<ArrowRight /></Link></Button>} />
        <div className="pb-2" />
      </Card>

      <ConfirmDialog open={confirmStart} onOpenChange={setConfirmStart} tone="primary"
        title={t('billing.admin_start_confirm_title', { date: start ? fmt.day(start) : '' })}
        description={t('billing.admin_start_confirm_desc')} confirmLabel={t('billing.admin_start_btn')} loading={busy === 'start'}
        onConfirm={async () => { if (await run('start', { action: 'start', start_date: start }, t('billing.admin_started'))) setConfirmStart(false) }} />
    </div>
  )
}
