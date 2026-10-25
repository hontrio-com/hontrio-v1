'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n/context'
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Unplug, ExternalLink } from 'lucide-react'

type Connection = { id: string; google_email: string | null; status: 'active' | 'revoked' | 'error'; last_error: string | null }
type AdsAccount = {
  customer_id: string; login_customer_id: string | null; descriptive_name: string | null
  currency_code: string | null; time_zone: string | null
  is_manager: boolean; is_test_account: boolean; is_selected: boolean; status: string | null
}

const KNOWN_ERRORS = ['access_denied', 'missing_scope', 'no_refresh_token', 'state', 'rate_limited', 'not_configured']

function formatCustomerId(id: string) {
  return id.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3')
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
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

  async function handleSelect(customerId: string) {
    setSelecting(customerId)
    try {
      const r = await fetch('/api/integrations/google/accounts', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: customerId }),
      })
      const d = await r.json()
      if (!r.ok) setNotice({ ok: false, text: d.error || t('google_ads.error_generic') })
      else setAccounts(a => a.map(x => ({ ...x, is_selected: x.customer_id === customerId })))
    } catch { setNotice({ ok: false, text: t('google_ads.error_generic') }) }
    finally { setSelecting(null) }
  }

  async function handleDisconnect() {
    if (!confirm(t('google_ads.disconnect_confirm'))) return
    setDisconnecting(true)
    try {
      await fetch('/api/integrations/google', { method: 'DELETE' })
      setConnection(null); setAccounts([]); setNotice(null)
    } catch { setNotice({ ok: false, text: t('google_ads.error_generic') }) }
    finally { setDisconnecting(false) }
  }

  const advertisers = accounts.filter(a => !a.is_manager)
  const revoked = connection?.status === 'revoked'

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-xl bg-neutral-100 flex items-center justify-center"><GoogleLogo /></div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-neutral-900">Google Ads</p>
          <p className="text-[11px] text-neutral-400 truncate">
            {connection?.google_email || t('google_ads.subtitle')}
          </p>
        </div>
        {connection && !revoked && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{t('settings.connected')}
          </span>
        )}
        {revoked && (
          <span className="text-[11px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-md">{t('google_ads.revoked')}</span>
        )}
      </div>

      {notice && (
        <div className={`flex items-start gap-2 px-3 py-2.5 mb-3 rounded-xl text-[12px] leading-relaxed ${notice.ok ? 'bg-neutral-900 text-white' : 'bg-amber-50 border border-amber-100 text-amber-800'}`}>
          {notice.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-px" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-px" />}
          <span className="flex-1">{notice.text}</span>
          <button onClick={() => setNotice(null)} className="opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {loading ? (
        <div className="h-16 bg-neutral-50 rounded-xl animate-pulse" />
      ) : !connection || revoked ? (
        <div className="space-y-3">
          <p className="text-[12px] text-neutral-500 leading-relaxed p-3 bg-neutral-50 rounded-xl">
            {revoked ? t('google_ads.revoked_desc') : t('google_ads.connect_desc')}
          </p>
          <a href="/api/integrations/google/connect"
            className="inline-flex w-full items-center justify-center gap-1.5 h-9 px-4 rounded-xl text-[13px] font-medium bg-neutral-900 hover:bg-neutral-800 text-white transition-all">
            <GoogleLogo />{revoked ? t('google_ads.reconnect') : t('google_ads.connect')}
          </a>
          <a href="https://ads.google.com/home/" target="_blank" rel="noopener"
            className="flex items-center justify-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-600">
            {t('google_ads.no_account')}<ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {advertisers.length === 0 ? (
            <p className="text-[12px] text-neutral-500 leading-relaxed p-3 bg-neutral-50 rounded-xl">{t('google_ads.no_accounts')}</p>
          ) : (
            <div>
              <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5">{t('google_ads.choose_account')}</p>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {advertisers.map(a => (
                  <button key={a.customer_id} onClick={() => !a.is_selected && handleSelect(a.customer_id)} disabled={!!selecting}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all
                      ${a.is_selected ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'}`}>
                    <span className={`h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${a.is_selected ? 'border-neutral-900' : 'border-neutral-300'}`}>
                      {a.is_selected && <span className="h-2 w-2 rounded-full bg-neutral-900" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="text-[13px] font-medium text-neutral-900 truncate">{a.descriptive_name || formatCustomerId(a.customer_id)}</span>
                        {a.is_test_account && <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md">TEST</span>}
                      </span>
                      <span className="block text-[11px] text-neutral-400">
                        {formatCustomerId(a.customer_id)}{a.currency_code ? ` · ${a.currency_code}` : ''}{a.time_zone ? ` · ${a.time_zone}` : ''}
                      </span>
                    </span>
                    {selecting === a.customer_id && <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleRefresh} disabled={refreshing}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-[13px] font-medium border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-all disabled:opacity-50">
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {t('google_ads.refresh')}
            </button>
            <button onClick={handleDisconnect} disabled={disconnecting}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-[13px] font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-all disabled:opacity-50">
              {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
              {t('google_ads.disconnect')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
