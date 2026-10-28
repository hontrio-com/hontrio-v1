'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2, RefreshCw, Unplug } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import { Card, CardHeader } from '@/components/app/surface'
import { Badge } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { Callout } from '@/components/app/feedback'

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

export function EdinioLogo({ className = 'size-5' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/integrations/edinio.png" alt="" className={`${className} object-contain`} />
}

export function EdinioConnectCard() {
  const { t } = useT()
  const [going, setGoing] = useState(false)

  return (
    <Card className="flex flex-col">
      <CardHeader icon={<EdinioLogo className="size-4" />} title="Edinio" description={t('edinio.subtitle')}
        action={<Badge tone="brand">{t('edinio.recommended')}</Badge>} />
      <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-4">
        <p className="text-[13px] leading-relaxed text-neutral-500">{t('edinio.connect_desc')}</p>
        <Button asChild variant="primary" className="mt-auto w-full">
          <a href="/api/integrations/edinio/connect" onClick={() => setGoing(true)}>
            {going ? <Loader2 className="animate-spin" /> : <EdinioLogo className="size-4" />}
            {going ? t('edinio.connecting') : t('edinio.connect')}
          </a>
        </Button>
        <p className="text-center text-[12px] leading-relaxed text-neutral-400">{t('edinio.connect_note')}</p>
      </div>
    </Card>
  )
}

export function EdinioStoreCard({ store, onChanged, onDisconnected, header }: {
  store: EdinioStore
  onChanged: () => void
  onDisconnected: () => void
  /** Ce se arată lângă starea conexiunii (ex. „Activ" / „Folosește acest magazin"). */
  header?: React.ReactNode
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
        <a href={store.store_url} target="_blank" rel="noopener" className="flex items-center gap-1 truncate text-neutral-700 hover:text-neutral-950">
          {store.store_url.replace(/^https?:\/\//, '')}<ExternalLink className="size-3 shrink-0" />
        </a>
      ),
    },
    { label: t('edinio.offers_synced'), value: <span className="font-semibold tabular-nums text-neutral-900">{store.products_count ?? 0}</span> },
    { label: t('edinio.orders_synced'), value: <span className="font-semibold tabular-nums text-neutral-900">{store.orders_count ?? 0}</span> },
    {
      label: t('settings.last_sync'),
      value: <span className="text-neutral-700">{running ? t('edinio.syncing') : store.last_sync_at ? new Date(store.last_sync_at).toLocaleString(intlLocale) : t('settings.never_synced')}</span>,
    },
    { label: t('edinio.merchant_center'), value: <span className="text-neutral-700">{gmc ? t('edinio.merchant_connected', { id: gmc.cont_id || '?' }) : t('edinio.merchant_not_connected')}</span> },
    { label: t('edinio.purchase_conversion'), value: <span className="font-mono text-[12px] text-neutral-700">{conversion || t('edinio.conversion_missing')}</span> },
  ]

  return (
    <Card>
      <CardHeader icon={<EdinioLogo className="size-4" />} title={store.store_name || 'Edinio'} description={t('edinio.platform_label')}
        action={<>{header}{revoked ? <Badge tone="red" dot>{t('edinio.revoked')}</Badge> : <Badge tone="green" dot>{t('settings.connected')}</Badge>}</>} />

      <div className="space-y-4 px-5 pb-5 pt-4">
        {notice && <Callout tone={notice.ok ? 'success' : 'warning'} onClose={() => setNotice(null)}>{notice.text}</Callout>}

        {revoked ? (
          <div className="space-y-3">
            <Callout tone="warning">{t('edinio.revoked_desc')}</Callout>
            <Button asChild variant="primary" className="w-full">
              <a href="/api/integrations/edinio/connect"><EdinioLogo className="size-4" />{t('edinio.reconnect')}</a>
            </Button>
          </div>
        ) : (
          <>
            {!store.last_sync_at && running && (
              <Callout tone="info"><span className="flex items-center gap-2"><Loader2 className="size-3.5 animate-spin" />{t('edinio.first_sync')}</span></Callout>
            )}
            {/* Mesajul salvat e o propoziție întreagă, în limba omului */}
            {store.last_error && !running && <Callout tone="warning">{translateStored(t, store.last_error)}</Callout>}
          </>
        )}

        <dl className="divide-y divide-neutral-100 rounded-xl ring-1 ring-inset ring-neutral-200/70">
          {rows.map(row => (
            <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
              <dt className="shrink-0 text-neutral-500">{row.label}</dt>
              <dd className="min-w-0 text-right">{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap gap-2">
          {!revoked && (
            <Button loading={syncing || running} onClick={handleSync}>{!(syncing || running) && <RefreshCw />}{t('settings.sync_now')}</Button>
          )}
          <Button variant="danger" loading={disconnecting} onClick={handleDisconnect}>{!disconnecting && <Unplug />}{t('google_ads.disconnect')}</Button>
        </div>
      </div>
    </Card>
  )
}
