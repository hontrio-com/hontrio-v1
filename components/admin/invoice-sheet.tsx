'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Ban, CreditCard, ExternalLink, FileText, MinusCircle, RotateCcw, UserRound } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { Sheet, SheetHeader } from '@/components/app/sheet'
import { DataRow } from '@/components/app/kpi'
import { Badge } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { Input } from '@/components/app/input'
import { Callout } from '@/components/app/feedback'
import { ConfirmDialog, Modal } from '@/components/app/dialog'
import { day, type Formats } from '@/components/app/formats'
import { useMoney } from '@/components/admin/money'
import { STATEMENT_TONE, useMonth } from '@/components/admin/account-billing'
import type { InvoiceRow } from '@/lib/admin/billing'

// =============================================
// O factură (situația unei luni), în panoul de administrare: sumele, datele
// facturii și ale clientului, comenzile numărate și cele trecute în credit,
// plus acțiunile prin POST /api/admin/billing: emiterea din nou a unei facturi
// refuzate, rezultatul unei emiteri neterminate, anularea și scoaterea unei
// comenzi contestate.
// =============================================

async function act(body: Record<string, unknown>): Promise<{ ok: boolean; error: string | null }> {
  try {
    const r = await fetch('/api/admin/billing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await r.json().catch(() => ({}))
    return { ok: r.ok, error: typeof data.error === 'string' ? data.error : null }
  } catch {
    return { ok: false, error: null }
  }
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-1 mt-6 text-[12px] font-semibold uppercase tracking-[0.04em] text-neutral-400 first:mt-0">{children}</h4>
}

export function InvoiceSheet({ invoice: s, today, f, onClose, onChanged }: {
  invoice: InvoiceRow | null; today: string; f: Formats; onClose: () => void; onChanged: () => void
}) {
  const { t } = useT()
  const money = useMoney()
  const month = useMonth()
  const [busy, setBusy] = useState<string | null>(null)
  const [voiding, setVoiding] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [series, setSeries] = useState('')
  const [number, setNumber] = useState('')
  const [exclude, setExclude] = useState<{ id: string; number: string } | null>(null)
  const [reason, setReason] = useState('')

  async function run(key: string, body: Record<string, unknown>, success: string) {
    setBusy(key)
    const r = await act(body)
    setBusy(null)
    if (!r.ok) { toast.error(r.error || t('billing.admin_failed')); return false }
    toast.success(success)
    onChanged()
    return true
  }

  const dayFmt = (d: string | null) => (d ? f.date.format(day(d)) : '—')
  const when = (iso: string | null) => (iso ? f.dateTime.format(new Date(iso)) : '—')
  const overdue = !!s && s.status === 'invoiced' && !!s.due_date && s.due_date < today

  return (
    <Sheet open={!!s} onOpenChange={o => { if (!o) onClose() }} width={560}>
      {s && (
        <>
          <SheetHeader icon={<FileText />} onClose={onClose}
            title={s.invoice_number ? t('admin.inv_title', { number: `${s.invoice_series ?? ''} ${s.invoice_number}`.trim() }) : t('admin.inv_title_none', { month: month(s.period) })}
            description={`${s.client?.name ?? s.store_name} · ${month(s.period)}`} />
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={overdue ? 'red' : STATEMENT_TONE[s.status] ?? 'neutral'}>{overdue ? t('admin.inv_overdue') : t(`billing.st_${s.status}`)}</Badge>
              {s.reminders > 0 && <Badge>{t('admin.inv_reminders', { count: s.reminders })}</Badge>}
            </div>
            {s.error && <Callout tone="danger" className="mt-4">{s.error.startsWith('billing.') && t.has(s.error) ? t(s.error) : s.error}</Callout>}

            <Heading>{t('admin.inv_section_amounts')}</Heading>
            <dl className="divide-y divide-neutral-100">
              <DataRow label={t('admin.bill_col_counted')} value={`${money.one(s.sales, s.currency)} · ${t('admin.accounts_orders', { count: s.orders_count })}`} />
              <DataRow label={t('admin.bill_col_fee')} value={money.one(s.fee, s.currency)} />
              {s.adjustment !== 0 && <DataRow label={t('admin.inv_credit_used')} value={money.one(s.adjustment, s.currency)} />}
              <DataRow label={t('admin.bill_col_amount')} value={money.one(s.amount, s.currency)} strong />
              {s.credit_carry > 0 && <DataRow label={t('admin.inv_credit_carry')} value={money.one(s.credit_carry, s.currency)} />}
              {s.invoice_total !== null && <DataRow label={t('admin.inv_total')} value={money.one(s.invoice_total, s.currency)} />}
            </dl>

            <Heading>{t('admin.inv_section_invoice')}</Heading>
            <dl className="divide-y divide-neutral-100">
              <DataRow label={t('admin.inv_col_invoice')} value={s.invoice_number ? `${s.invoice_series ?? ''} ${s.invoice_number}`.trim() : '—'} />
              <DataRow label={t('admin.inv_col_issued')} value={when(s.issued_at)} />
              <DataRow label={t('admin.inv_col_due')} value={<span className={overdue ? 'font-medium text-red-600' : undefined}>{dayFmt(s.due_date)}</span>} />
              <DataRow label={t('admin.inv_col_paid')} value={when(s.paid_at)} />
            </dl>
            {(s.invoice_url || s.payment_url) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {s.invoice_url && <Button asChild size="sm"><a href={s.invoice_url} target="_blank" rel="noopener noreferrer"><ExternalLink />{t('admin.inv_open_pdf')}</a></Button>}
                {s.payment_url && <Button asChild size="sm"><a href={s.payment_url} target="_blank" rel="noopener noreferrer"><CreditCard />{t('admin.inv_open_payment')}</a></Button>}
              </div>
            )}

            <Heading>{t('admin.inv_section_client')}</Heading>
            <dl className="divide-y divide-neutral-100">
              <DataRow label={t('admin.bill_company_name')} value={s.client ? `${s.client.name} · ${s.client.vat_code}` : <span className="text-amber-700">{t('admin.bill_company_missing_short')}</span>} />
              <DataRow label={t('admin.col_store')} value={s.store_name} />
              <DataRow label={t('admin.bill_company_email')} value={s.email ?? '—'} />
            </dl>
            {s.user_id && (
              <Button asChild size="sm" variant="ghost" className="mt-2"><Link href={`/admin/users/${s.user_id}`}><UserRound />{t('admin.inv_open_account')}</Link></Button>
            )}

            <Heading>{t('admin.inv_section_orders', { count: s.orders.length })}</Heading>
            {s.orders.length === 0 ? <p className="py-2 text-[13px] text-neutral-500">{t('admin.inv_orders_none')}</p> : (
              <ul className="divide-y divide-neutral-100">
                {s.orders.map(o => (
                  <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                    <span className="min-w-0">
                      <span className="font-medium text-neutral-900">#{o.number}</span>
                      <span className="text-neutral-400"> · {f.date.format(new Date(o.placed_at))}</span>
                      {o.original && <span className="block text-[12px] text-neutral-400">{money.one(o.original.value, o.original.currency)}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums text-neutral-800">{money.one(o.value, s.currency)}</span>
                      {s.status !== 'void' && (
                        <Button size="icon" variant="ghost" title={t('billing.admin_exclude')} aria-label={t('billing.admin_exclude')}
                          onClick={() => { setExclude({ id: o.id, number: o.number }); setReason('') }}><MinusCircle /></Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {s.adjusted_orders.length > 0 && (
              <>
                <Heading>{t('admin.inv_section_adjusted', { count: s.adjusted_orders.length })}</Heading>
                <p className="text-[13px] text-neutral-600">{t('admin.inv_adjusted_hint', { amount: money.one(s.adjusted_orders.reduce((x, o) => x + o.value, 0), s.currency) })}</p>
              </>
            )}

            {(['error', 'needs_profile', 'pending', 'issuing', 'invoiced'] as string[]).includes(s.status) && (
              <>
                <Heading>{t('admin.inv_section_actions')}</Heading>
                <div className="flex flex-wrap gap-2">
                  {['error', 'needs_profile', 'pending'].includes(s.status) && (
                    <Button loading={busy === 'retry'} onClick={() => run('retry', { action: 'retry', statement_id: s.id }, t('billing.admin_retried'))}><RotateCcw />{t('billing.admin_retry')}</Button>
                  )}
                  {s.status === 'issuing' && <Button onClick={() => { setSeries(''); setNumber(''); setResolving(true) }}>{t('billing.admin_resolve')}</Button>}
                  {s.status === 'invoiced' && <Button variant="danger" onClick={() => setVoiding(true)}><Ban />{t('billing.admin_void')}</Button>}
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-neutral-400">{t(`admin.inv_action_hint_${s.status === 'invoiced' ? 'void' : s.status === 'issuing' ? 'resolve' : 'retry'}`)}</p>
              </>
            )}
          </div>

          <ConfirmDialog open={voiding} onOpenChange={setVoiding} title={t('admin.inv_void_title')} description={t('admin.inv_void_desc')}
            confirmLabel={t('billing.admin_void')} loading={busy === 'void'}
            onConfirm={async () => { if (await run('void', { action: 'void', statement_id: s.id }, t('billing.admin_voided'))) setVoiding(false) }} />

          <Modal open={resolving} onOpenChange={setResolving} title={t('billing.admin_resolve_title')} description={t('billing.admin_resolve_desc')}
            footer={<>
              <Button variant="secondary" loading={busy === 'none'} onClick={async () => { if (await run('none', { action: 'resolve', statement_id: s.id }, t('billing.admin_resolved'))) setResolving(false) }}>{t('billing.admin_resolve_missing')}</Button>
              <Button variant="primary" disabled={!series || !number} loading={busy === 'found'} onClick={async () => { if (await run('found', { action: 'resolve', statement_id: s.id, series, number }, t('billing.admin_resolved'))) setResolving(false) }}>{t('billing.admin_resolve_found')}</Button>
            </>}>
            <div className="grid grid-cols-2 gap-3">
              <Input value={series} onChange={e => setSeries(e.target.value)} placeholder={t('billing.admin_series')} />
              <Input value={number} onChange={e => setNumber(e.target.value)} placeholder={t('billing.admin_number')} />
            </div>
          </Modal>

          <Modal open={!!exclude} onOpenChange={o => { if (!o) setExclude(null) }} title={t('billing.admin_exclude_title', { number: exclude?.number ?? '' })} description={t('billing.admin_exclude_desc')}
            footer={<>
              <Button variant="secondary" onClick={() => setExclude(null)}>{t('billing.cancel')}</Button>
              <Button variant="primary" disabled={reason.trim().length < 3} loading={busy === 'exclude'}
                onClick={async () => { if (exclude && await run('exclude', { action: 'exclude', order_id: exclude.id, reason }, t('billing.admin_excluded'))) setExclude(null) }}>{t('billing.admin_exclude_btn')}</Button>
            </>}>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder={t('billing.admin_exclude_reason')} />
          </Modal>
        </>
      )}
    </Sheet>
  )
}
