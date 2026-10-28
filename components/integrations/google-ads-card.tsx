'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Loader2, RefreshCw, Unplug } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Card, CardHeader } from '@/components/app/surface'
import { Badge } from '@/components/app/badge'
import { Button, linkStyles } from '@/components/app/button'
import { ChoiceCard, Select } from '@/components/app/input'
import { Callout, Skeleton } from '@/components/app/feedback'

// =============================================
// Google Ads în Setări → Integrări: legarea contului Google (o dată pe om) și
// contul Google Ads în care rulează campaniile fiecărui magazin.
// =============================================

type Connection = { id: string; google_email: string | null; status: 'active' | 'revoked' | 'error'; last_error: string | null }
type AdsAccount = {
  customer_id: string; login_customer_id: string | null; descriptive_name: string | null
  currency_code: string | null; time_zone: string | null
  is_manager: boolean; is_test_account: boolean; status: string | null
}
/** Magazinele omului, fiecare cu contul Google Ads pe care îi rulează campaniile */
type StoreRef = { id: string; platform: string; store_name: string | null; store_url: string; currency: string | null; google_ads_customer_id: string | null }

const KNOWN_ERRORS = ['access_denied', 'missing_scope', 'no_refresh_token', 'state', 'rate_limited', 'not_configured']

function formatCustomerId(id: string) {
  return id.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3')
}

const storeName = (s: StoreRef) => s.store_name || s.store_url.replace(/^https?:\/\//, '').replace(/\/+$/, '')

export function GoogleLogo({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9z" />
    </svg>
  )
}

export default function GoogleAdsCard() {
  const { t } = useT()
  const [loading, setLoading] = useState(true)
  const [connection, setConnection] = useState<Connection | null>(null)
  const [accounts, setAccounts] = useState<AdsAccount[]>([])
  const [stores, setStores] = useState<StoreRef[]>([])
  // Magazinul căruia i se alege contul (implicit, cel activ)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    load()
    // Rezultatul redirect-ului din fluxul OAuth
    const params = new URLSearchParams(window.location.search)
    const error = params.get('google_error')
    const warning = params.get('google_warning')
    if (error) setNotice({ ok: false, text: t(`google_ads.error_${KNOWN_ERRORS.includes(error) ? error : 'generic'}`) })
    else if (warning) setNotice({ ok: false, text: warningText(warning) })
    else if (params.get('google') === 'connected') setNotice({ ok: true, text: t('google_ads.connected_success') })
    if (error || warning || params.get('google')) {
      ['google', 'google_error', 'google_warning'].forEach(k => params.delete(k))
      const qs = params.toString()
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function warningText(code: string) {
    if (code.endsWith('DEVELOPER_TOKEN_NOT_APPROVED')) return t('google_ads.warning_test_token')
    if (code === 'discovery_failed') return t('google_ads.warning_discovery_failed')
    return t('google_ads.warning_generic', { code })
  }

  async function load() {
    try {
      const r = await fetch('/api/integrations/google')
      const d = await r.json()
      setConnection(d.connection || null)
      setAccounts(d.accounts || [])
      setStores(d.stores || [])
      setStoreId(id => id ?? d.active_store_id ?? null)
    } catch {} finally { setLoading(false) }
  }

  async function handleRefresh() {
    setRefreshing(true); setNotice(null)
    try {
      const r = await fetch('/api/integrations/google/accounts', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) setNotice({ ok: false, text: d.error || t('google_ads.error_generic') })
      else if (d.count === 0 && d.errorCode) setNotice({ ok: false, text: warningText(d.errorCode) })
      await load()
    } catch { setNotice({ ok: false, text: t('google_ads.error_generic') }) }
    finally { setRefreshing(false) }
  }

  async function handleSelect(customerId: string | null) {
    if (!store) return
    setSelecting(customerId ?? 'none')
    try {
      const r = await fetch('/api/integrations/google/accounts', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: customerId, store_id: store.id }),
      })
      const d = await r.json()
      if (!r.ok) setNotice({ ok: false, text: d.error || t('google_ads.error_generic') })
      else setStores(list => list.map(s => (s.id === store.id ? { ...s, google_ads_customer_id: customerId } : s)))
    } catch { setNotice({ ok: false, text: t('google_ads.error_generic') }) }
    finally { setSelecting(null) }
  }

  async function handleDisconnect() {
    if (!confirm(t('google_ads.disconnect_confirm'))) return
    setDisconnecting(true)
    try {
      await fetch('/api/integrations/google', { method: 'DELETE' })
      setConnection(null); setAccounts([]); setNotice(null)
      setStores(list => list.map(s => ({ ...s, google_ads_customer_id: null })))
    } catch { setNotice({ ok: false, text: t('google_ads.error_generic') }) }
    finally { setDisconnecting(false) }
  }

  const advertisers = accounts.filter(a => !a.is_manager)
  const revoked = connection?.status === 'revoked'
  const store = stores.find(s => s.id === storeId) ?? stores[stores.length - 1] ?? null
  const chosen = store?.google_ads_customer_id ?? null

  return (
    <Card>
      <CardHeader icon={<GoogleLogo />} title="Google Ads" description={connection?.google_email || t('google_ads.subtitle')}
        action={connection && !revoked ? <Badge tone="green" dot>{t('settings.connected')}</Badge> : revoked ? <Badge tone="red" dot>{t('google_ads.revoked')}</Badge> : undefined} />

      <div className="space-y-4 px-5 pb-5 pt-4">
        {notice && <Callout tone={notice.ok ? 'success' : 'warning'} onClose={() => setNotice(null)}>{notice.text}</Callout>}

        {loading ? (
          <Skeleton className="h-16 rounded-xl" />
        ) : !connection || revoked ? (
          <div className="space-y-3">
            <p className="text-[13px] leading-relaxed text-neutral-500">{revoked ? t('google_ads.revoked_desc') : t('google_ads.connect_desc')}</p>
            <Button asChild variant="primary" className="w-full">
              <a href="/api/integrations/google/connect"><GoogleLogo />{revoked ? t('google_ads.reconnect') : t('google_ads.connect')}</a>
            </Button>
            <a href="https://ads.google.com/home/" target="_blank" rel="noopener"
              className="flex items-center justify-center gap-1 text-[12px] text-neutral-500 hover:text-neutral-800">
              {t('google_ads.no_account')}<ExternalLink className="size-3" />
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {advertisers.length === 0 ? (
              <Callout tone="info">{t('google_ads.no_accounts')}</Callout>
            ) : !store ? (
              <Callout tone="info">{t('google_ads.no_store')}</Callout>
            ) : (
              <div className="space-y-3">
                {stores.length > 1 && (
                  <label className="block">
                    <span className="text-[12px] font-medium text-neutral-600">{t('google_ads.store_label')}</span>
                    <Select value={store.id} onChange={e => setStoreId(e.target.value)} wrapperClassName="mt-1.5">
                      {stores.map(s => <option key={s.id} value={s.id}>{storeName(s)}</option>)}
                    </Select>
                    <span className="mt-1.5 block text-[12px] text-neutral-500">{t('google_ads.per_store_hint')}</span>
                  </label>
                )}
                <p className="text-[12px] font-medium text-neutral-600">{t('google_ads.account_for_store', { store: storeName(store) })}</p>
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {advertisers.map(a => {
                    const selected = a.customer_id === chosen
                    const others = stores.filter(s => s.id !== store.id && s.google_ads_customer_id === a.customer_id)
                    const currencyDiffers = !!a.currency_code && !!store.currency && a.currency_code !== store.currency
                    return (
                      <ChoiceCard key={a.customer_id} active={selected} disabled={!!selecting} onClick={() => !selected && handleSelect(a.customer_id)}
                        title={<span className="flex items-center gap-1.5">{a.descriptive_name || formatCustomerId(a.customer_id)}{a.is_test_account && <Badge tone="amber" className="h-[18px] px-1 text-[10px]">TEST</Badge>}</span>}
                        aside={selecting === a.customer_id ? <Loader2 className="size-3.5 animate-spin text-neutral-400" /> : undefined}
                        description={<>
                          <span className="block tabular-nums">{formatCustomerId(a.customer_id)}{a.currency_code ? ` · ${a.currency_code}` : ''}{a.time_zone ? ` · ${a.time_zone}` : ''}</span>
                          {currencyDiffers && <span className="block text-amber-700">{t('google_ads.currency_mismatch', { account: a.currency_code!, store: store.currency! })}</span>}
                          {others.length > 0 && <span className="block">{t('google_ads.used_by_other_store', { store: others.map(storeName).join(', ') })}</span>}
                        </>} />
                    )
                  })}
                </div>
                {chosen && (
                  <button onClick={() => handleSelect(null)} disabled={!!selecting} className={cn(linkStyles, 'text-[12px] font-normal text-neutral-500 disabled:opacity-50')}>
                    {selecting === 'none' ? <Loader2 className="inline size-3 animate-spin" /> : t('google_ads.clear_account')}
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
              <Button loading={refreshing} onClick={handleRefresh}>{!refreshing && <RefreshCw />}{t('google_ads.refresh')}</Button>
              <Button variant="danger" loading={disconnecting} onClick={handleDisconnect}>{!disconnecting && <Unplug />}{t('google_ads.disconnect')}</Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
