'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/context'
import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown, ExternalLink, ImageIcon, Lightbulb, Store } from 'lucide-react'

// =============================================
// Recomandări — ce merită făcut acum, în ordinea importanței, calculat din
// datele magazinului (lib/recommendations/engine.ts).
// =============================================

type Severity = 'critical' | 'high' | 'medium' | 'low'
type Text = { key: string; params?: Record<string, string | number>; money?: string[] }
type RecItem = { offer_id: string; title: string; variant_title: string | null; image_url: string | null; note: Text | null }
type Recommendation = {
  id: string; severity: Severity; title: Text; body: Text | Text[]
  impact_revenue: number | null; items: RecItem[]; total_items: number
  action: { href: string; external: boolean; label_key: string } | null
}
type Data = {
  store: { platform: string; supported: boolean; store_name?: string | null; currency?: string; has_recent_sales?: boolean } | null
  recommendations: Recommendation[]
}

// Clase CSS, nu text  i18n-ignore-start
const SEVERITY_STYLE: Record<Severity, { dot: string; badge: string }> = {
  critical: { dot: 'bg-red-500', badge: 'bg-red-50 text-red-600' },
  high: { dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700' },
  medium: { dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700' },
  low: { dot: 'bg-neutral-300', badge: 'bg-neutral-100 text-neutral-500' },
}
// i18n-ignore-end
const COLLAPSED_ITEMS = 3

function RecCard({ rec, render, fmt }: { rec: Recommendation; render: (t: Text) => string; fmt: Intl.NumberFormat }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const style = SEVERITY_STYLE[rec.severity]
  const shown = open ? rec.items : rec.items.slice(0, COLLAPSED_ITEMS)
  const hiddenInList = rec.total_items - rec.items.length

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md ${style.badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />{t(`recs.severity_${rec.severity}`)}
            </span>
            {rec.impact_revenue !== null && rec.impact_revenue > 0 && (
              <span className="text-[11px] text-neutral-400">{t('recs.impact', { revenue: fmt.format(rec.impact_revenue) })}</span>
            )}
          </div>
          <p className="mt-2 text-[15px] font-semibold text-neutral-900 leading-snug">{render(rec.title)}</p>
          <p className="mt-1 text-[13px] text-neutral-500 leading-relaxed">
            {(Array.isArray(rec.body) ? rec.body : [rec.body]).map(render).join(' ')}
          </p>
        </div>
        {rec.action && (
          rec.action.external ? (
            <a href={rec.action.href} target="_blank" rel="noopener"
              className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[12px] font-medium transition-all self-start">
              {t(t.has(rec.action.label_key) ? rec.action.label_key : 'recs.action_open')}<ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <Link href={rec.action.href}
              className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[12px] font-medium transition-all self-start">
              {t(t.has(rec.action.label_key) ? rec.action.label_key : 'recs.action_open')}<ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )
        )}
      </div>

      {rec.items.length > 0 && (
        <div className="mt-4 rounded-lg border border-neutral-100 divide-y divide-neutral-50">
          {shown.map(it => (
            <div key={it.offer_id} className="flex items-center gap-3 px-3 py-2">
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-neutral-100 bg-neutral-50 flex items-center justify-center">
                {it.image_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={it.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  : <ImageIcon className="h-3.5 w-3.5 text-neutral-300" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-neutral-800 truncate">
                  {it.title}{it.variant_title && <span className="text-neutral-400"> · {it.variant_title}</span>}
                </p>
              </div>
              {it.note && <span className="shrink-0 text-[11px] text-neutral-500 tabular-nums">{render(it.note)}</span>}
            </div>
          ))}
          {(rec.items.length > COLLAPSED_ITEMS || hiddenInList > 0) && (
            <div className="flex items-center justify-between px-3 py-2">
              {rec.items.length > COLLAPSED_ITEMS ? (
                <button onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-1 text-[12px] text-neutral-500 hover:text-neutral-800">
                  {open ? t('recs.show_less') : t('recs.show_more', { count: String(rec.items.length - COLLAPSED_ITEMS) })}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
              ) : <span />}
              {hiddenInList > 0 && (open || rec.items.length <= COLLAPSED_ITEMS) && (
                <span className="text-[11px] text-neutral-400">{t('recs.and_more', { count: String(hiddenInList) })}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function RecommendationsPage() {
  const { t, intlLocale: numberLocale } = useT()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const r = await fetch('/api/recommendations')
      if (!r.ok) throw new Error()
      setData(await r.json())
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const currency = data?.store?.currency || 'RON'
  const fmt = useMemo(() => {
    try { return new Intl.NumberFormat(numberLocale, { style: 'currency', currency, maximumFractionDigits: 0 }) }
    catch { return new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 }) }
  }, [numberLocale, currency])
  const fmtNum = useMemo(() => new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }), [numberLocale])

  /** Un text al motorului: sumele de bani în moneda magazinului, restul numerelor după limbă. */
  const render = useCallback((txt: Text) => {
    // Cheia vine de la server: una necunoscută nu se arată ca text
    if (!t.has(txt.key)) return ''
    const params: Record<string, string> = {}
    for (const [k, v] of Object.entries(txt.params ?? {})) {
      params[k] = typeof v === 'number' ? (txt.money?.includes(k) ? fmt.format(v) : fmtNum.format(v)) : v
    }
    return t(txt.key, params)
  }, [t, fmt, fmtNum])

  const recs = useMemo(() => data?.recommendations ?? [], [data])
  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const r of recs) c[r.severity]++
    return c
  }, [recs])

  const header = (
    <div>
      <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight">{t('recs.title')}</h1>
      <p className="text-[13px] text-neutral-400 mt-0.5">{t('recs.subtitle')}</p>
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-5">
        {header}
        {[0, 1, 2].map(i => <div key={i} className="h-36 rounded-xl bg-neutral-100 animate-pulse" />)}
      </div>
    )
  }

  if (failed && !data) {
    return (
      <div className="space-y-5">
        {header}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white py-16 text-center">
          <AlertCircle className="h-6 w-6 text-neutral-400" />
          <p className="mt-3 text-[14px] font-medium text-neutral-900">{t('recs.load_error')}</p>
          <button onClick={load} className="mt-4 h-9 px-4 rounded-xl bg-neutral-900 text-white text-[13px] font-medium hover:bg-neutral-800">{t('catalog.retry')}</button>
        </div>
      </div>
    )
  }

  if (!data?.store || !data.store.supported) {
    return (
      <div className="space-y-5">
        {header}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white py-16 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100"><Store className="h-6 w-6 text-neutral-500" /></div>
          <p className="mt-4 text-[15px] font-semibold text-neutral-900">{data?.store ? t('catalog.unsupported_title') : t('recs.no_store_title')}</p>
          <p className="mt-1 max-w-md text-[13px] text-neutral-400 leading-relaxed">{data?.store ? t('catalog.unsupported_desc') : t('recs.no_store_desc')}</p>
          {!data?.store && (
            <Link href="/settings?tab=integrations" className="mt-5 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-neutral-900 text-white text-[13px] font-medium hover:bg-neutral-800">
              {t('catalog.connect_store')}
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {header}

      {recs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {(['critical', 'high', 'medium', 'low'] as Severity[]).filter(s => counts[s] > 0).map(s => (
            <span key={s} className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-lg ${SEVERITY_STYLE[s].badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_STYLE[s].dot}`} />
              {t(`recs.count_${s}`, { count: String(counts[s]) })}
            </span>
          ))}
          {!data.store.has_recent_sales && <span className="text-[12px] text-neutral-400">{t('recs.no_recent_sales')}</span>}
        </div>
      )}

      {recs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white py-16 text-center">
          <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          <p className="mt-3 text-[15px] font-semibold text-neutral-900">{t('recs.all_good_title')}</p>
          <p className="mt-1 max-w-md text-[13px] text-neutral-400">{t('recs.all_good_desc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recs.map(r => <RecCard key={r.id} rec={r} render={render} fmt={fmt} />)}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-neutral-400 leading-relaxed">
        <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-px" />{t('recs.footer')}
      </p>
    </div>
  )
}
