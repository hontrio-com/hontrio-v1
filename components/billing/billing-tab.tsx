'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Check, ChevronDown, CreditCard, ExternalLink, FileText, MessageSquareWarning, Search } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Card, CardFooter } from '@/components/app/surface'
import { Badge } from '@/components/app/badge'
import { Button, linkStyles } from '@/components/app/button'
import { Checkbox, Input, Select, Textarea } from '@/components/app/input'
import { Callout, EmptyState, Skeleton } from '@/components/app/feedback'
import { Modal } from '@/components/app/dialog'
import { Label, Section } from '@/components/settings/layout'

// =============================================
// Setări → Facturare: dacă facturarea a pornit (Termeni, art. 9.5), luna în
// curs pe fiecare magazin, datele firmei pentru factura SmartBill (CUI-ul se
// completează de la ANAF) și facturile, cu comenzile numărate și contestația
// fiecăreia (art. 9.2), trimisă ca tichet de suport.
// =============================================

/** Un rând numărat: o comandă sau, la Gomag, ziua cu conversiile Google Ads (`source`, `conversions`, `reported`). */
type Order = {
  id: string; number: string; placed_at: string; value: number; original?: { value: number; currency: string }
  source?: 'google_ads'; conversions?: number; reported?: number
}
type Source = 'store_orders' | 'google_ads'
type Profile = { name: string; vat_code: string; reg_com: string | null; is_vat_payer: boolean; address: string; city: string; county: string | null; country: string; email: string }
type Statement = {
  id: string; store_name: string; period: string; currency: 'RON' | 'EUR'; sales: number; orders_count: number
  fee: number; adjustment: number; amount: number; status: string; invoice: string | null; invoice_url: string | null
  payment_url: string | null; due_date: string | null; paid_at: string | null; orders: Order[]; source: Source
}
type Preview = {
  store_id: string; store_name: string; period: string; currency: 'RON' | 'EUR'; sales: number; fee: number; orders: Order[]
  source: Source
  /** Gomag fără Termenii care spun regula acceptați: nu se numără nimic. */
  counted: boolean
}
type BillingData = {
  active: boolean; start_date: string | null; notice_sent_at: string | null; profile: Profile | null
  statements: Statement[]; preview: Preview[]; suspended: { store_id: string; store_name: string }[]
}

const COUNTRIES = ['RO', 'MD', 'BG', 'HU', 'AT', 'BE', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'SE', 'SI', 'SK', 'GB', 'CH', 'NO', 'US']
const EMPTY: Profile = { name: '', vat_code: '', reg_com: null, is_vat_payer: false, address: '', city: '', county: null, country: 'RO', email: '' }

const STATUS_TONE: Record<string, 'neutral' | 'green' | 'amber' | 'red'> = {
  free: 'neutral', pending: 'neutral', needs_profile: 'amber', issuing: 'neutral', invoiced: 'amber', paid: 'green', error: 'red', void: 'neutral',
}

export default function BillingTab() {
  const { t, intlLocale } = useT()
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  function load() {
    return fetch('/api/billing')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: BillingData) => { setData(d); setFailed(false) })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const fmt = useMemo(() => ({
    money: (n: number, currency: string) => new Intl.NumberFormat(intlLocale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(n),
    num: (n: number) => new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 }).format(n),
    day: (d: string) => new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d.slice(0, 10)}T00:00:00Z`)),
    month: (p: string) => new Intl.DateTimeFormat(intlLocale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${p}-01T00:00:00Z`)),
  }), [intlLocale])

  if (loading && !data) return <div className="space-y-4 py-8"><Skeleton className="h-28" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>
  if (failed || !data) return <Callout tone="danger" className="my-8">{t('billing.load_failed')}</Callout>

  const status = data.active
    ? t('billing.status_active', { date: fmt.day(data.start_date!) })
    : data.start_date ? t('billing.status_scheduled', { date: fmt.day(data.start_date) }) : t('billing.status_launch')

  return (
    <div>
      {data.suspended.length > 0 && (
        <Callout tone="danger" className="mt-2" title={t('billing.suspended_title')}>
          {t('billing.suspended_body', { stores: data.suspended.map(s => s.store_name).join(', ') })}
        </Callout>
      )}

      <Section title={t('billing.status_title')} description={t('billing.status_desc')}>
        <Card>
          <div className="space-y-3 p-5 text-[13px] leading-relaxed text-neutral-600">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={data.active ? 'green' : 'neutral'} dot>{data.active ? t('billing.badge_active') : data.start_date ? t('billing.badge_scheduled') : t('billing.badge_launch')}</Badge>
            </div>
            <p className="text-neutral-800">{status}</p>
            <p>{t('billing.grid_ron')}</p>
            <p>{t('billing.grid_eur')}</p>
            <p>{t('billing.how_counted')} <Link href="/legal/terms#tarife" className={linkStyles}>{t('billing.terms_link')}</Link></p>
            {data.preview.some(p => p.source === 'google_ads') && <p>{t('billing.how_counted_gomag')}</p>}
          </div>
        </Card>
      </Section>

      <Section title={t('billing.month_title')} description={t('billing.month_desc')}>
        {data.preview.length === 0
          ? <Card><EmptyState icon={<FileText />} title={t('billing.month_no_store')} description={t('billing.month_no_store_desc')} /></Card>
          : data.preview.map(p => <PreviewCard key={p.store_id} p={p} active={data.active} fmt={fmt} />)}
      </Section>

      <Section title={t('billing.details_title')} description={t('billing.details_desc')}>
        <ProfileForm initial={data.profile} onSaved={profile => setData(d => (d ? { ...d, profile } : d))} />
      </Section>

      <Section title={t('billing.invoices_title')} description={t('billing.invoices_desc')}>
        {data.statements.length === 0
          ? <Card><EmptyState icon={<FileText />} title={t('billing.invoices_empty')} description={data.active ? t('billing.invoices_empty_active') : t('billing.invoices_empty_launch')} /></Card>
          : data.statements.map(s => <StatementCard key={s.id} s={s} fmt={fmt} />)}
      </Section>
    </div>
  )
}

type Fmt = { money: (n: number, c: string) => string; num: (n: number) => string; day: (d: string) => string; month: (p: string) => string }

function PreviewCard({ p, active, fmt }: { p: Preview; active: boolean; fmt: Fmt }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-neutral-900">{p.store_name}</p>
          <p className="mt-0.5 text-[12px] text-neutral-500">{t('billing.month_until_today', { month: fmt.month(p.period) })}</p>
        </div>
        <div className="text-right">
          <p className="text-[18px] font-semibold tabular-nums tracking-[-0.02em] text-neutral-950">{fmt.money(p.fee, p.currency)}</p>
          <p className="text-[12px] text-neutral-500">{p.fee > 0 ? (active ? t('billing.month_fee_active') : t('billing.month_fee_launch')) : t('billing.month_free')}</p>
        </div>
      </div>
      <div className="border-t border-neutral-100 px-5 py-3 text-[13px] text-neutral-600">
        {p.source === 'google_ads' && !p.counted ? <p>{t('billing.not_counted_terms')}</p> : (
          <>
            <button type="button" onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-1.5 font-medium text-neutral-900 hover:text-neutral-600">
              <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
              {p.source === 'google_ads'
                ? t('billing.month_conversions', { sales: fmt.money(p.sales, p.currency) })
                : t('billing.month_orders', { count: p.orders.length, sales: fmt.money(p.sales, p.currency) })}
            </button>
            {open && <OrdersTable orders={p.orders} currency={p.currency} source={p.source} fmt={fmt} />}
          </>
        )}
      </div>
    </Card>
  )
}

function OrdersTable({ orders, currency, source, fmt, onDispute }: { orders: Order[]; currency: string; source: Source; fmt: Fmt; onDispute?: (o: Order) => void }) {
  const { t } = useT()
  const days = source === 'google_ads'
  if (!orders.length) return <p className="mt-3 text-[12px] text-neutral-500">{t(days ? 'billing.days_none' : 'billing.orders_none')}</p>
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-[12.5px]">
        <thead>
          <tr className="text-neutral-500">
            <th className="py-1.5 pr-3 font-medium">{t(days ? 'billing.col_day_conversions' : 'billing.col_order')}</th>
            <th className="py-1.5 pr-3 font-medium">{t('billing.col_date')}</th>
            <th className="py-1.5 pr-3 text-right font-medium">{t('billing.col_value')}</th>
            {onDispute && <th className="py-1.5" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {orders.map(o => (
            <tr key={o.id}>
              <td className="py-2 pr-3 font-medium text-neutral-900">
                {o.source === 'google_ads' ? t('billing.row_conversions', { n: fmt.num(o.conversions ?? 0) }) : `#${o.number}`}
              </td>
              <td className="py-2 pr-3 text-neutral-600">{fmt.day(o.placed_at)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-neutral-900">
                {fmt.money(o.value, currency)}
                {o.original && <span className="block text-[11px] text-neutral-500">{fmt.money(o.original.value, o.original.currency)}</span>}
                {o.source === 'google_ads' && o.reported !== undefined && (
                  <span className="block text-[11px] text-neutral-500">{t('billing.reported_note', { value: fmt.money(o.reported, o.original?.currency ?? currency) })}</span>
                )}
              </td>
              {onDispute && (
                <td className="py-2 text-right">
                  <button type="button" onClick={() => onDispute(o)} className="text-[12px] font-medium text-neutral-500 hover:text-neutral-900">{t('billing.dispute')}</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatementCard({ s, fmt }: { s: Statement; fmt: Fmt }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [dispute, setDispute] = useState<Order | null>(null)
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-neutral-900">{fmt.month(s.period)} · {s.store_name}</p>
          <p className="mt-0.5 text-[12px] text-neutral-500">
            {s.invoice ? t('billing.invoice_number', { number: s.invoice }) : t('billing.no_invoice')}
            {s.due_date && s.status === 'invoiced' ? ` · ${t('billing.due_on', { date: fmt.day(s.due_date) })}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={STATUS_TONE[s.status] ?? 'neutral'}>{t(`billing.st_${s.status}`)}</Badge>
          <p className="text-[18px] font-semibold tabular-nums tracking-[-0.02em] text-neutral-950">{fmt.money(s.amount, s.currency)}</p>
        </div>
      </div>
      <div className="space-y-1 border-t border-neutral-100 px-5 py-3 text-[12.5px] text-neutral-600">
        <p>{s.source === 'google_ads'
          ? t('billing.statement_conversions', { sales: fmt.money(s.sales, s.currency), fee: fmt.money(s.fee, s.currency) })
          : t('billing.statement_sales', { count: s.orders_count, sales: fmt.money(s.sales, s.currency), fee: fmt.money(s.fee, s.currency) })}</p>
        {s.adjustment < 0 && <p>{t('billing.statement_credit', { amount: fmt.money(-s.adjustment, s.currency) })}</p>}
        <button type="button" onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-1.5 pt-1 font-medium text-neutral-900 hover:text-neutral-600">
          <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
          {t(s.source === 'google_ads' ? 'billing.statement_days' : 'billing.statement_orders')}
        </button>
        {open && <OrdersTable orders={s.orders} currency={s.currency} source={s.source} fmt={fmt} onDispute={setDispute} />}
      </div>
      {(s.invoice_url || s.payment_url) && (
        <CardFooter>
          <span />
          <div className="flex flex-wrap gap-2">
            {s.invoice_url && <Button asChild variant="secondary" size="sm"><a href={s.invoice_url} target="_blank" rel="noopener noreferrer"><ExternalLink />{t('billing.view_invoice')}</a></Button>}
            {s.payment_url && <Button asChild variant="primary" size="sm"><a href={s.payment_url} target="_blank" rel="noopener noreferrer"><CreditCard />{t('billing.pay_card')}</a></Button>}
          </div>
        </CardFooter>
      )}
      <DisputeModal order={dispute} statement={s} fmt={fmt} onClose={() => setDispute(null)} />
    </Card>
  )
}

function DisputeModal({ order, statement, fmt, onClose }: { order: Order | null; statement: Statement; fmt: Fmt; onClose: () => void }) {
  const { t } = useT()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  // La Gomag se contestă ziua cu conversiile ei, nu o comandă
  const day = order?.source === 'google_ads'
  async function send() {
    if (!order || message.trim().length < 5) return
    setSending(true)
    try {
      const month = fmt.month(statement.period)
      const value = fmt.money(order.value, statement.currency)
      const r = await fetch('/api/tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'billing',
          subject: (day
            ? t('billing.dispute_subject_day', { date: fmt.day(order.placed_at), month, store: statement.store_name })
            : t('billing.dispute_subject', { number: order.number, month, store: statement.store_name })).slice(0, 200),
          message: `${day
            ? t('billing.dispute_context_day', { date: fmt.day(order.placed_at), invoice: statement.invoice ?? '—', value })
            : t('billing.dispute_context', { number: order.number, invoice: statement.invoice ?? '—', value })}\n\n${message.trim()}`.slice(0, 5000),
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(d.error || t('billing.dispute_failed')); return }
      toast.success(t('billing.dispute_sent'))
      setMessage('')
      onClose()
    } catch {
      toast.error(t('billing.dispute_failed'))
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open={!!order} onOpenChange={o => { if (!o) onClose() }} icon={<MessageSquareWarning />}
      title={day && order ? t('billing.dispute_title_day', { date: fmt.day(order.placed_at) }) : t('billing.dispute_title', { number: order?.number ?? '' })} description={t('billing.dispute_desc')}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('billing.cancel')}</Button>
        <Button variant="primary" loading={sending} disabled={message.trim().length < 5} onClick={send}>{t('billing.dispute_send')}</Button>
      </>}
    >
      <Textarea rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder={t('billing.dispute_placeholder')} />
    </Modal>
  )
}

function ProfileForm({ initial, onSaved }: { initial: Profile | null; onSaved: (p: Profile) => void }) {
  const { t, intlLocale } = useT()
  const [p, setP] = useState<Profile>(initial ?? EMPTY)
  const [saving, setSaving] = useState(false)
  const [looking, setLooking] = useState(false)
  const [error, setError] = useState<{ field: string; text: string } | null>(null)
  const names = useMemo(() => { try { return new Intl.DisplayNames([intlLocale], { type: 'region' }) } catch { return null } }, [intlLocale])
  const ro = p.country === 'RO'
  const set = (k: keyof Profile, v: string | boolean | null) => setP(x => ({ ...x, [k]: v }))

  async function lookup() {
    setLooking(true)
    setError(null)
    try {
      const r = await fetch(`/api/billing/company?cui=${encodeURIComponent(p.vat_code)}`)
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError({ field: 'vat_code', text: d.error || t('billing.anaf_unavailable') }); return }
      const c = d.company as { name: string; vat_code: string; reg_com: string | null; is_vat_payer: boolean; address: string; city: string; county: string | null }
      setP(x => ({ ...x, name: c.name, vat_code: c.vat_code, reg_com: c.reg_com, is_vat_payer: c.is_vat_payer, address: c.address, city: c.city, county: c.county }))
      toast.success(t('billing.anaf_filled'))
    } catch {
      setError({ field: 'vat_code', text: t('billing.anaf_unavailable') })
    } finally {
      setLooking(false)
    }
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const r = await fetch('/api/billing/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError({ field: d.field || '', text: d.error || t('billing.save_failed') }); return }
      setP(d.profile)
      onSaved(d.profile)
      toast.success(t('billing.saved'))
    } catch {
      setError({ field: '', text: t('billing.save_failed') })
    } finally {
      setSaving(false)
    }
  }

  const invalid = (f: string) => (error?.field === f ? true : undefined)
  return (
    <Card>
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Label text={t('billing.f_country')}>
            <Select value={p.country} onChange={e => set('country', e.target.value)} aria-invalid={invalid('country')}>
              {COUNTRIES.map(c => <option key={c} value={c}>{names?.of(c) ?? c}</option>)}
            </Select>
          </Label>
          <Label text={ro ? t('billing.f_cui') : t('billing.f_vat')} hint={ro ? t('billing.f_cui_hint') : undefined}>
            <div className="flex gap-2">
              <Input value={p.vat_code} onChange={e => set('vat_code', e.target.value)} aria-invalid={invalid('vat_code')} placeholder={ro ? '43474393' : 'DE123456789'} />
              {ro && <Button variant="secondary" loading={looking} disabled={!p.vat_code.trim()} onClick={lookup}>{!looking && <Search />}{t('billing.anaf_lookup')}</Button>}
            </div>
          </Label>
        </div>
        <Label text={t('billing.f_name')}><Input value={p.name} onChange={e => set('name', e.target.value)} aria-invalid={invalid('name')} /></Label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Label text={t('billing.f_reg_com')}><Input value={p.reg_com ?? ''} onChange={e => set('reg_com', e.target.value || null)} placeholder="J40/1234/2020" /></Label>
          <Label text={t('billing.f_email')} hint={t('billing.f_email_hint')}><Input type="email" value={p.email} onChange={e => set('email', e.target.value)} aria-invalid={invalid('email')} /></Label>
        </div>
        <Label text={t('billing.f_address')}><Input value={p.address} onChange={e => set('address', e.target.value)} aria-invalid={invalid('address')} /></Label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Label text={t('billing.f_city')} hint={ro ? t('billing.f_city_hint') : undefined}><Input value={p.city} onChange={e => set('city', e.target.value)} aria-invalid={invalid('city')} /></Label>
          <Label text={ro ? t('billing.f_county') : t('billing.f_region')}><Input value={p.county ?? ''} onChange={e => set('county', e.target.value || null)} aria-invalid={invalid('county')} /></Label>
        </div>
        <Checkbox checked={p.is_vat_payer} onChange={v => set('is_vat_payer', v)}>{t('billing.f_vat_payer')}</Checkbox>
        {error && <Callout tone="danger">{error.text}</Callout>}
      </div>
      <CardFooter>
        <p className="text-[12px] text-neutral-500">{t('billing.details_footer')}</p>
        <Button variant="primary" loading={saving} onClick={save}>{!saving && <Check />}{t('billing.save')}</Button>
      </CardFooter>
    </Card>
  )
}
