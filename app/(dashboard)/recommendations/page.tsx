'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowRight, ChevronDown, CircleCheck, ExternalLink, ImageIcon, Info, Store } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/app/page-header'
import { Card } from '@/components/app/surface'
import { Badge, type Tone } from '@/components/app/badge'
import { Button, textActionStyles } from '@/components/app/button'
import { Segmented } from '@/components/app/tabs'
import { Callout, EmptyState, Skeleton } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { useFormats, type Formats } from '@/components/app/formats'

// =============================================
// Recomandări — ce merită făcut acum, în ordinea importanței, calculat din
// datele magazinului (lib/recommendations/engine.ts). Fiecare are acțiunea
// ei și, unde e cazul, produsele la care se referă.
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
type Filter = 'all' | Severity

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low']
const TONE: Record<Severity, Tone> = { critical: 'red', high: 'amber', medium: 'neutral', low: 'outline' }
// i18n-ignore-start: clase de stil, nu text
// Semnul din stânga, lângă eticheta de urgență: cât de urgent e
const STRIPE: Record<Severity, string> = { critical: 'bg-red-500', high: 'bg-amber-500', medium: 'bg-neutral-300', low: 'bg-neutral-200' }
// i18n-ignore-end
const COLLAPSED_ITEMS = 3

function RecCard({ rec, render, f }: { rec: Recommendation; render: (t: Text) => string; f: Formats }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const shown = open ? rec.items : rec.items.slice(0, COLLAPSED_ITEMS)
  const hiddenInList = rec.total_items - rec.items.length
  const label = rec.action ? t(t.has(rec.action.label_key) ? rec.action.label_key : 'recs.action_open') : null

  return (
    <Card className="relative overflow-hidden">
      <span aria-hidden className={cn('absolute left-0 top-5 h-6 w-[3px] rounded-r-full', STRIPE[rec.severity])} />
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={TONE[rec.severity]} dot>{t(`recs.severity_${rec.severity}`)}</Badge>
            {rec.impact_revenue !== null && rec.impact_revenue > 0 && (
              <span className="text-[12px] text-neutral-500">{t('recs.impact', { revenue: f.money.format(rec.impact_revenue) })}</span>
            )}
          </div>
          <h3 className="mt-2.5 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-neutral-900">{render(rec.title)}</h3>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-neutral-500">
            {(Array.isArray(rec.body) ? rec.body : [rec.body]).map(render).join(' ')}
          </p>
        </div>
        {rec.action && label && (
          <Button asChild variant={rec.severity === 'critical' ? 'primary' : 'secondary'} className="shrink-0 self-start">
            {rec.action.external
              ? <a href={rec.action.href} target="_blank" rel="noopener">{label}<ExternalLink /></a>
              : <Link href={rec.action.href}>{label}<ArrowRight /></Link>}
          </Button>
        )}
      </div>

      {rec.items.length > 0 && (
        <div className="border-t border-neutral-100">
          <ul className="divide-y divide-neutral-100">
            {shown.map(it => (
              <li key={it.offer_id} className="flex items-center gap-3 px-5 py-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-neutral-50 ring-1 ring-inset ring-neutral-200/70">
                  {it.image_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={it.image_url} alt="" loading="lazy" className="size-full object-cover" />
                    : <ImageIcon className="size-3.5 text-neutral-300" />}
                </div>
                <p className="min-w-0 flex-1 truncate text-[13px] text-neutral-800">
                  {it.title}{it.variant_title && <span className="text-neutral-400"> · {it.variant_title}</span>}
                </p>
                {it.note && <span className="shrink-0 text-[12px] tabular-nums text-neutral-500">{render(it.note)}</span>}
              </li>
            ))}
          </ul>
          {(rec.items.length > COLLAPSED_ITEMS || hiddenInList > 0) && (
            <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-2.5">
              {rec.items.length > COLLAPSED_ITEMS ? (
                <button onClick={() => setOpen(o => !o)} className={cn(textActionStyles, 'text-[12px]')}>
                  {open ? t('recs.show_less') : t('recs.show_more', { count: String(rec.items.length - COLLAPSED_ITEMS) })}
                  <ChevronDown className={cn('transition-transform', open && 'rotate-180')} />
                </button>
              ) : <span />}
              {hiddenInList > 0 && (open || rec.items.length <= COLLAPSED_ITEMS) && (
                <span className="text-[12px] text-neutral-400">{t('recs.and_more', { count: String(hiddenInList) })}</span>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export default function RecommendationsPage() {
  const { t } = useT()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  // Starea se schimbă doar în callback-urile răspunsului, nu în efectul care pornește încărcarea
  const load = useCallback(() =>
    fetch('/api/recommendations')
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<Data> })
      .then(body => { setData(body); setFailed(false) })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false)), [])

  useEffect(() => { load() }, [load])

  const f = useFormats(data?.store?.currency || 'RON')

  /** Un text al motorului: sumele de bani în moneda magazinului, restul numerelor după limbă. */
  const render = useCallback((txt: Text) => {
    // Cheia vine de la server: una necunoscută nu se arată ca text
    if (!t.has(txt.key)) return ''
    const params: Record<string, string> = {}
    for (const [k, v] of Object.entries(txt.params ?? {})) {
      params[k] = typeof v === 'number' ? (txt.money?.includes(k) ? f.money.format(v) : f.num.format(v)) : v
    }
    return t(txt.key, params)
  }, [t, f])

  const recs = useMemo(() => data?.recommendations ?? [], [data])
  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const r of recs) c[r.severity]++
    return c
  }, [recs])
  const shown = filter === 'all' ? recs : recs.filter(r => r.severity === filter)

  const header = <PageHeader title={t('recs.title')} description={t('recs.subtitle')} />

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-[480px] max-w-full" /></div>
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-[148px] rounded-xl" />)}
      </div>
    )
  }

  if (failed && !data) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <EmptyState icon={<AlertCircle />} title={t('recs.load_error')} description={t('campaigns.load_error_hint')}
            action={<Button variant="primary" onClick={load}>{t('catalog.retry')}</Button>} />
        </Card>
      </div>
    )
  }

  if (!data?.store || !data.store.supported) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <EmptyState icon={<Store />}
            title={data?.store ? t('catalog.unsupported_title') : t('recs.no_store_title')}
            description={data?.store ? t('catalog.unsupported_desc') : t('recs.no_store_desc')}
            action={!data?.store && <Button asChild variant="primary"><Link href="/settings?tab=integrations">{t('catalog.connect_store')}</Link></Button>} />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {header}

      {recs.length > 0 && (
        <div className="overflow-x-auto [scrollbar-width:none]">
          <Segmented id="recs-filter" value={filter} onChange={setFilter} items={[
            { value: 'all' as Filter, label: <span className="flex items-center gap-1.5">{t('recs.filter_all')}<span className="tabular-nums text-neutral-400">{recs.length}</span></span> },
            ...SEVERITIES.filter(s => counts[s] > 0).map(s => ({
              value: s as Filter,
              label: <span className="flex items-center gap-1.5"><span className={cn('size-1.5 rounded-full', STRIPE[s])} />{t(`recs.severity_${s}`)}<span className="tabular-nums text-neutral-400">{counts[s]}</span></span>,
            })),
          ]} />
        </div>
      )}

      {!data.store.has_recent_sales && recs.length > 0 && <Callout tone="info">{t('recs.no_recent_sales')}</Callout>}

      {recs.length === 0 ? (
        <Card>
          <EmptyState icon={<CircleCheck />} title={t('recs.all_good_title')} description={t('recs.all_good_desc')} />
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((r, i) => (
            <FadeIn key={r.id} delay={Math.min(i, 6) * 0.03}>
              <RecCard rec={r} render={render} f={f} />
            </FadeIn>
          ))}
        </div>
      )}

      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-neutral-400">
        <Info className="mt-0.5 size-3.5 shrink-0" />{t('recs.footer')}
      </p>
    </div>
  )
}
