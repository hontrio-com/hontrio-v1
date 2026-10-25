'use client'

import { useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, RefreshCw, Unplug } from 'lucide-react'

// =============================================
// Edinio — cardul din Setări → Integrări
// Neconectat: pornește conectarea (aprobarea se face în panoul Edinio).
// Conectat: starea sincronizării, ce are magazinul legat la Google, butoanele.
// =============================================

export type EdinioStore = {
  id: string
  store_url: string
  store_name: string | null
  products_count: number | null
  orders_count?: number | null
  last_sync_at: string | null
  sync_status?: string | null
  connection_status?: string | null
  last_error?: string | null
  platform_data?: {
    google_merchant?: { cont_id: string | null; nume_cont: string | null } | null
    google_ads?: { conversie_id: string | null } | null
  } | null
}

function EdinioLogo() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/integrations/edinio.png" alt="" className="h-5 w-5 object-contain" />
}

export function EdinioConnectCard() {
  const { t } = useT()
  const [going, setGoing] = useState(false)

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-xl bg-[#07c527]/10 flex items-center justify-center"><EdinioLogo /></div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-neutral-900">Edinio</p>
          <p className="text-[11px] text-neutral-400 truncate">{t('edinio.subtitle')}</p>
        </div>
        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">{t('edinio.recommended')}</span>
      </div>
      <div className="space-y-3">
        <p className="text-[12px] text-neutral-500 leading-relaxed p-3 bg-neutral-50 rounded-xl">{t('edinio.connect_desc')}</p>
        <a href="/api/integrations/edinio/connect" onClick={() => setGoing(true)}
          className="inline-flex w-full items-center justify-center gap-1.5 h-9 px-4 rounded-xl text-[13px] font-medium bg-neutral-900 hover:bg-neutral-800 text-white transition-all">
          {going ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EdinioLogo />}
          {going ? t('edinio.connecting') : t('edinio.connect')}
        </a>
        <p className="text-[11px] text-neutral-400 leading-relaxed text-center">{t('edinio.connect_note')}</p>
      </div>
    </div>
  )
}

export function EdinioStoreCard({ store, onChanged, onDisconnected }: {
  store: EdinioStore
  onChanged: () => void
  onDisconnected: () => void
}) {
  const { t, intlLocale } = useT()
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  const revoked = store.connection_status === 'revoked'
  // Prima sincronizare pornește după conectare, în fundal: până se termină
  // (sau cade, cu `sync_status = 'error'`), cardul o urmărește
  const running = store.sync_status === 'syncing'
    || (!store.last_sync_at && !revoked && store.sync_status !== 'error')

  const onChangedRef = useRef(onChanged)
  useEffect(() => { onChangedRef.current = onChanged })
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => onChangedRef.current(), 5000)
    return () => clearInterval(id)
  }, [running])

  async function handleSync() {
    setSyncing(true); setNotice(null)
    try {
      const r = await fetch(`/api/stores/${store.id}/sync`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) setNotice({ ok: false, text: d.error || t('edinio.error_generic') })
      else setNotice({ ok: true, text: t('edinio.sync_done', { offers: t('common.offers_count', { count: Number(d.synced ?? 0) }), orders: t('common.orders_count', { count: Number(d.orders ?? 0) }) }) })
      onChanged()
    } catch { setNotice({ ok: false, text: t('edinio.error_generic') }) }
    finally { setSyncing(false) }
  }

  async function handleDisconnect() {
    if (!confirm(t('edinio.disconnect_confirm'))) return
    setDisconnecting(true)
    try {
      const r = await fetch(`/api/stores/${store.id}`, { method: 'DELETE' })
      if (r.ok) onDisconnected()
      else setNotice({ ok: false, text: t('settings.error_disconnect') })
    } catch { setNotice({ ok: false, text: t('settings.error_disconnect') }) }
    finally { setDisconnecting(false) }
  }

  const gmc = store.platform_data?.google_merchant
  const conversion = store.platform_data?.google_ads?.conversie_id
  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: t('settings.store_url_label'),
      value: (
        <a href={store.store_url} target="_blank" rel="noopener" className="text-[13px] text-neutral-600 flex items-center gap-1 hover:text-neutral-900 truncate">
          {store.store_url.replace(/^https?:\/\//, '')}<ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ),
    },
    { label: t('edinio.offers_synced'), value: <span className="text-[13px] font-semibold text-neutral-900">{store.products_count ?? 0}</span> },
    { label: t('edinio.orders_synced'), value: <span className="text-[13px] font-semibold text-neutral-900">{store.orders_count ?? 0}</span> },
    {
      label: t('settings.last_sync'),
      value: (
        <span className="text-[13px] text-neutral-600">
          {running ? t('edinio.syncing') : store.last_sync_at ? new Date(store.last_sync_at).toLocaleString(intlLocale) : t('settings.never_synced')}
        </span>
      ),
    },
    {
      label: t('edinio.merchant_center'),
      value: <span className="text-[13px] text-neutral-600">{gmc ? t('edinio.merchant_connected', { id: gmc.cont_id || '?' }) : t('edinio.merchant_not_connected')}</span>,
    },
    {
      label: t('edinio.purchase_conversion'),
      value: <span className="text-[13px] text-neutral-600 font-mono">{conversion || t('edinio.conversion_missing')}</span>,
    },
  ]

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-xl bg-[#07c527]/10 flex items-center justify-center"><EdinioLogo /></div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-neutral-900 truncate">{store.store_name || 'Edinio'}</p>
          <p className="text-[11px] text-neutral-400">{t('edinio.platform_label')}</p>
        </div>
        {revoked ? (
          <span className="text-[11px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-md">{t('edinio.revoked')}</span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{t('settings.connected')}
          </span>
        )}
      </div>

      {notice && (
        <div className={`flex items-start gap-2 px-3 py-2.5 mb-3 rounded-xl text-[12px] leading-relaxed ${notice.ok ? 'bg-neutral-900 text-white' : 'bg-amber-50 border border-amber-100 text-amber-800'}`}>
          {notice.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-px" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-px" />}
          <span className="flex-1">{notice.text}</span>
          <button onClick={() => setNotice(null)} className="opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {revoked ? (
        <div className="space-y-3 mb-4">
          <p className="text-[12px] text-amber-800 leading-relaxed p-3 bg-amber-50 border border-amber-100 rounded-xl">{t('edinio.revoked_desc')}</p>
          <a href="/api/integrations/edinio/connect"
            className="inline-flex w-full items-center justify-center gap-1.5 h-9 px-4 rounded-xl text-[13px] font-medium bg-neutral-900 hover:bg-neutral-800 text-white transition-all">
            <EdinioLogo />{t('edinio.reconnect')}
          </a>
        </div>
      ) : (
        <>
          {!store.last_sync_at && running && (
            <p className="text-[12px] text-neutral-500 leading-relaxed p-3 mb-3 bg-neutral-50 rounded-xl flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />{t('edinio.first_sync')}
            </p>
          )}
          {store.last_error && !running && (
            <p className="text-[12px] text-amber-800 leading-relaxed p-3 mb-3 bg-amber-50 border border-amber-100 rounded-xl">
              {/* Mesajul salvat e o propoziție întreagă, în limba omului */}
              {translateStored(t, store.last_error)}
            </p>
          )}
        </>
      )}

      <div className="space-y-2 mb-4">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-neutral-50 rounded-xl">
            <span className="text-[13px] text-neutral-500 shrink-0">{row.label}</span>
            <span className="min-w-0 text-right">{row.value}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {!revoked && (
          <button onClick={handleSync} disabled={syncing || running}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-[13px] font-medium border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-all disabled:opacity-50">
            {syncing || running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {t('settings.sync_now')}
          </button>
        )}
        <button onClick={handleDisconnect} disabled={disconnecting}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-[13px] font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-all disabled:opacity-50">
          {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
          {t('google_ads.disconnect')}
        </button>
      </div>
    </div>
  )
}
