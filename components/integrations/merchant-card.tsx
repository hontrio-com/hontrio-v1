'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, ShoppingBag } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import { Card, CardHeader } from '@/components/app/surface'
import { Button } from '@/components/app/button'
import { Input, Select } from '@/components/app/input'
import { Callout, Skeleton } from '@/components/app/feedback'

// =============================================
// Merchant Center-ul magazinului activ: contul folosit (din Edinio, legat de
// contul Google Ads, sau ales) și o sincronizare la cerere.
// =============================================

type MerchantState = {
  merchant_center_id: string | null
  chosen: string | null
  edinio: string | null
  linked: string[]
  synced_at: string | null
  error: string | null
  matched: number
}

export default function MerchantCard() {
  const { t, intlLocale } = useT()
  const fmtInt = new Intl.NumberFormat(intlLocale)
  const [state, setState] = useState<MerchantState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'sync' | 'choose' | null>(null)
  const [manual, setManual] = useState('')
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    try {
      const r = await fetch('/api/integrations/google/merchant')
      const body = await r.json()
      setState(body.store ?? null)
    } catch {
      setState(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function patch(body: Record<string, unknown>, kind: 'choose') {
    setBusy(kind)
    setNotice(null)
    try {
      const r = await fetch('/api/integrations/google/merchant', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const res = await r.json().catch(() => ({}))
      if (!r.ok) setNotice({ ok: false, text: res.error || t('settings.merchant_save_failed') })
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function sync() {
    setBusy('sync')
    setNotice(null)
    try {
      const r = await fetch('/api/merchant/sync', { method: 'POST' })
      const res = await r.json().catch(() => ({}))
      setNotice(r.ok
        ? { ok: true, text: t('settings.merchant_synced', { matched: fmtInt.format(res.matched ?? 0), products: fmtInt.format(res.products ?? 0), pushed: fmtInt.format(res.pushed ?? 0) }) }
        : { ok: false, text: res.error || t('settings.merchant_sync_failed') })
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <Skeleton className="h-36 rounded-xl" />
  if (!state) return null

  const options = [...new Set([state.edinio, ...state.linked, state.chosen].filter((x): x is string => !!x))]
  const syncedAt = state.synced_at ? new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(state.synced_at)) : null

  return (
    <Card>
      <CardHeader icon={<ShoppingBag />} title={t('settings.merchant_title')} description={t('settings.merchant_desc')}
        action={state.merchant_center_id && (
          <Button size="sm" loading={busy === 'sync'} disabled={!!busy} onClick={sync}>{busy !== 'sync' && <RefreshCw />}{t('settings.merchant_sync')}</Button>
        )} />

      <div className="space-y-4 px-5 pb-5 pt-4 text-[13px]">
        {state.merchant_center_id ? (
          <p className="text-neutral-800">
            {t('settings.merchant_account', { id: state.merchant_center_id })}{' '}
            <span className="text-neutral-500">
              {state.chosen ? t('settings.merchant_from_chosen') : state.edinio ? t('settings.merchant_from_edinio') : t('settings.merchant_from_ads')}
            </span>
          </p>
        ) : (
          <p className="text-neutral-500">{t('settings.merchant_none')}</p>
        )}

        {/* Alt cont: dintre cele știute, sau scris de mână */}
        <div className="flex flex-wrap items-center gap-2">
          {options.length > 1 && (
            <Select value={state.merchant_center_id ?? ''} disabled={!!busy} wrapperClassName="w-48"
              onChange={e => patch({ merchant_center_id: e.target.value || null }, 'choose')}>
              {options.map(id => <option key={id} value={id}>{id}</option>)}
            </Select>
          )}
          <Input value={manual} onChange={e => setManual(e.target.value.replace(/\D/g, ''))} inputMode="numeric" wrapperClassName="w-48" className="tabular-nums"
            placeholder={t('settings.merchant_manual_placeholder')} aria-label={t('settings.merchant_manual_placeholder')} />
          <Button variant="dark" loading={busy === 'choose'} disabled={!manual || !!busy}
            onClick={() => { if (manual) patch({ merchant_center_id: manual }, 'choose').then(() => setManual('')) }}>
            {t('settings.merchant_use')}
          </Button>
        </div>

        {state.merchant_center_id && (
          <p className="text-[12px] leading-relaxed text-neutral-500">
            {syncedAt
              ? t('settings.merchant_status', { when: syncedAt, matched: fmtInt.format(state.matched) })
              : t('settings.merchant_never')}
          </p>
        )}
        {state.error && <Callout tone="danger">{translateStored(t, state.error)}</Callout>}
        {notice && <Callout tone={notice.ok ? 'success' : 'danger'} onClose={() => setNotice(null)}>{notice.text}</Callout>}
      </div>
    </Card>
  )
}
