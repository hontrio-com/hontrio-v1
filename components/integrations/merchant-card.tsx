'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, ShoppingBag } from 'lucide-react'

// =============================================
// Merchant Center-ul magazinului activ: contul folosit (din Edinio, legat de
// contul Google Ads, sau ales), trimiterea costurilor (pentru profitul brut
// din Google Ads) și o sincronizare la cerere.
// =============================================

type MerchantState = {
  merchant_center_id: string | null
  chosen: string | null
  edinio: string | null
  linked: string[]
  synced_at: string | null
  error: string | null
  send_costs_to_google: boolean
  matched: number
  costs_sent: number
}

export default function MerchantCard() {
  const { t, intlLocale } = useT()
  const [state, setState] = useState<MerchantState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'sync' | 'costs' | 'choose' | null>(null)
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

  async function patch(body: Record<string, unknown>, kind: 'costs' | 'choose') {
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
        ? { ok: true, text: t('settings.merchant_synced', { matched: String(res.matched ?? 0), products: String(res.products ?? 0), pushed: String(res.pushed ?? 0) }) }
        : { ok: false, text: res.error || t('settings.merchant_sync_failed') })
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="h-28 rounded-xl bg-neutral-100 animate-pulse" />
  if (!state) return null

  const options = [...new Set([state.edinio, ...state.linked, state.chosen].filter((x): x is string => !!x))]
  const syncedAt = state.synced_at ? new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(state.synced_at)) : null

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100"><ShoppingBag className="h-4 w-4 text-neutral-600" /></div>
          <div>
            <p className="text-[14px] font-semibold text-neutral-900">{t('settings.merchant_title')}</p>
            <p className="text-[12px] text-neutral-400 mt-0.5 leading-relaxed">{t('settings.merchant_desc')}</p>
          </div>
        </div>
        {state.merchant_center_id && (
          <button onClick={sync} disabled={!!busy}
            className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-neutral-200 text-[12px] font-medium text-neutral-700 hover:border-neutral-300 disabled:opacity-50">
            {busy === 'sync' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {t('settings.merchant_sync')}
          </button>
        )}
      </div>

      <div className="mt-4 space-y-3 text-[12px]">
        {state.merchant_center_id ? (
          <p className="text-neutral-700">
            {t('settings.merchant_account', { id: state.merchant_center_id })}{' '}
            <span className="text-neutral-400">
              {state.chosen ? t('settings.merchant_from_chosen') : state.edinio ? t('settings.merchant_from_edinio') : t('settings.merchant_from_ads')}
            </span>
          </p>
        ) : (
          <p className="text-neutral-500">{t('settings.merchant_none')}</p>
        )}

        {/* Alt cont: dintre cele știute, sau scris de mână */}
        <div className="flex flex-wrap items-center gap-2">
          {options.length > 1 && (
            <select value={state.merchant_center_id ?? ''} disabled={!!busy}
              onChange={e => patch({ merchant_center_id: e.target.value || null }, 'choose')}
              className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-[12px]">
              {options.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          )}
          <input value={manual} onChange={e => setManual(e.target.value.replace(/\D/g, ''))} inputMode="numeric"
            placeholder={t('settings.merchant_manual_placeholder')} aria-label={t('settings.merchant_manual_placeholder')}
            className="h-8 w-44 rounded-lg border border-neutral-200 px-2 text-[12px] tabular-nums placeholder:text-neutral-300" />
          <button onClick={() => { if (manual) patch({ merchant_center_id: manual }, 'choose').then(() => setManual('')) }} disabled={!manual || !!busy}
            className="h-8 px-3 rounded-lg bg-neutral-900 text-white text-[12px] font-medium disabled:opacity-40">
            {busy === 'choose' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('settings.merchant_use')}
          </button>
        </div>

        {/* Costurile trimise la Google */}
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={state.send_costs_to_google} disabled={!!busy}
            onChange={e => patch({ send_costs_to_google: e.target.checked }, 'costs')} className="mt-0.5" />
          <span className="text-neutral-700 leading-relaxed">
            <span className="font-medium">{t('settings.merchant_costs')}</span> — {t('settings.merchant_costs_hint')}
          </span>
        </label>

        {state.merchant_center_id && (
          <p className="text-neutral-400 leading-relaxed">
            {syncedAt
              ? t('settings.merchant_status', { when: syncedAt, matched: String(state.matched), sent: String(state.costs_sent) })
              : t('settings.merchant_never')}
          </p>
        )}
        {state.error && (
          <p className="flex items-start gap-1.5 text-red-600 leading-relaxed"><AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />{translateStored(t, state.error)}</p>
        )}
        {notice && (
          <p className={`flex items-start gap-1.5 leading-relaxed ${notice.ok ? 'text-emerald-700' : 'text-red-600'}`}>
            {notice.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-px" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />}{notice.text}
          </p>
        )}
      </div>
    </div>
  )
}
