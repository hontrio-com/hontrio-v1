'use client'

import { useEffect, useMemo, useState } from 'react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Segmented } from '@/components/app/tabs'
import { Delta } from '@/components/app/kpi'
import { TrendChart, CHART } from '@/components/app/charts'
import { Callout, Skeleton } from '@/components/app/feedback'
import { day, type Formats } from '@/components/app/formats'
import { useTimeAgo } from '@/components/app/time'
import { change, derive, STATS_PERIODS, type StatsPeriod, type Totals } from '@/lib/campaigns/stats'
import type { Plan } from '@/lib/campaigns/plan'

// =============================================
// Cifrele din fișa unei campanii: perioada (7, 30 sau 90 de zile), cele zece
// cifre care contează (cu schimbarea față de perioada de dinainte), evoluția
// pe zi, produsele cu cele mai multe clicuri și ce au căutat oamenii.
// Citite din /api/campaigns/stats, pentru campaniile Google din spatele ei.
// =============================================

type StatsData = {
  days: number; from: string; to: string; live_at: string | null; currency: string | null
  totals: Totals; previous: Totals
  daily: (Totals & { date: string })[]
  products: { total: number; top: (Totals & { item_id: string })[] }
  terms: { total: number; from: string | null; to: string | null; top: (Totals & { term: string })[] }
  /** Conversiile și valoarea au luat comenzile din magazin acolo unde Google a numărat mai puține. */
  store_counted?: boolean
}

type Metric = 'clicks' | 'cost' | 'value' | 'impressions'

/** ID-ul unui produs din Merchant Center, cum îl dă Google în rapoarte (fără litere mari). */
const itemKey = (id: string) => id.trim().toLowerCase()

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-neutral-400">{children}</h3>
}

export function CampaignStats({ ids, plan, f }: { ids: string[]; plan: Plan; f: Formats }) {
  const { t, intlLocale } = useT()
  const ago = useTimeAgo()
  const [days, setDays] = useState<StatsPeriod>(30)
  const [metric, setMetric] = useState<Metric>('clicks')
  const [result, setResult] = useState<{ key: string; data: StatsData | null } | null>(null)
  // Lista de campanii ca text: același set nu pornește o citire nouă la fiecare randare
  const idsKey = ids.join(',')
  const key = `${idsKey}|${days}`

  useEffect(() => {
    let alive = true
    const want = `${idsKey}|${days}`
    fetch(`/api/campaigns/stats?ids=${encodeURIComponent(idsKey)}&days=${days}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setResult({ key: want, data: d }) })
      .catch(() => { if (alive) setResult({ key: want, data: null }) })
    return () => { alive = false }
  }, [idsKey, days])

  const pct = useMemo(() => new Intl.NumberFormat(intlLocale, { style: 'percent', maximumFractionDigits: 2 }), [intlLocale])
  // Produsele, cu numele și poza din magazin (ID-ul din Merchant Center, fără litere mari)
  const offers = useMemo(() => new Map(plan.offers.filter(o => o.item_id).map(o => [itemKey(o.item_id!), o])), [plan.offers])

  const data = result?.key === key ? result.data : null
  const loading = result?.key !== key
  if (loading && !data) return <div className="space-y-3"><Skeleton className="h-8 w-64" /><Skeleton className="h-40" /><Skeleton className="h-52" /></div>
  if (!data) return <Callout tone="danger">{t('campaigns.st_error')}</Callout>

  const now = derive(data.totals)
  const before = derive(data.previous)
  const money2 = (n: number) => f.money2.format(n)
  const tiles: { label: string; value: string; delta: number | null; good?: 'up' | 'down'; bad?: boolean }[] = [
    { label: t('campaigns.st_spend'), value: f.money.format(data.totals.cost), delta: change(data.totals.cost, data.previous.cost) },
    { label: t('campaigns.st_clicks'), value: f.int.format(data.totals.clicks), delta: change(data.totals.clicks, data.previous.clicks) },
    { label: t('campaigns.st_impressions'), value: f.int.format(data.totals.impressions), delta: change(data.totals.impressions, data.previous.impressions) },
    { label: t('campaigns.st_ctr'), value: now.ctr === null ? '—' : pct.format(now.ctr), delta: change(now.ctr, before.ctr) },
    { label: t('campaigns.st_cpc'), value: now.cpc === null ? '—' : money2(now.cpc), delta: change(now.cpc, before.cpc), good: 'down' },
    { label: t('campaigns.st_conversions'), value: f.num.format(data.totals.conversions), delta: change(data.totals.conversions, data.previous.conversions) },
    { label: t('campaigns.st_conv_rate'), value: now.conv_rate === null ? '—' : pct.format(now.conv_rate), delta: change(now.conv_rate, before.conv_rate) },
    { label: t('campaigns.st_cost_per_conv'), value: now.cost_per_conv === null ? '—' : money2(now.cost_per_conv), delta: change(now.cost_per_conv, before.cost_per_conv), good: 'down' },
    { label: t('campaigns.st_value'), value: f.money.format(data.totals.value), delta: change(data.totals.value, data.previous.value) },
    // Sub 1, reclamele au costat mai mult decât au adus vânzările
    { label: t('campaigns.st_roas'), value: now.roas === null ? '—' : f.num.format(now.roas), delta: change(now.roas, before.roas), bad: now.roas !== null && now.roas < 1 },
  ]
  const formatOf = (m: Metric) => (m === 'clicks' || m === 'impressions' ? (n: number) => f.int.format(n) : (n: number) => f.money.format(n))
  const empty = data.daily.every(p => !p.impressions && !p.cost)

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionTitle>{t('campaigns.st_title')}</SectionTitle>
          <p className="mt-1 text-[12px] text-neutral-400">
            {t('campaigns.st_range', { from: f.shortDate.format(day(data.from)), to: f.shortDate.format(day(data.to)) })}
            {data.live_at ? ` · ${t('campaigns.st_updated', { ago: ago(data.live_at) })}` : ''}
          </p>
        </div>
        <Segmented id="campaign-stats-days" size="sm" value={String(days)} onChange={v => setDays(Number(v) as StatsPeriod)}
          items={STATS_PERIODS.map(d => ({ value: String(d), label: t('campaigns.st_days', { count: d }) }))} />
      </div>

      <div>
        <dl className={cn('grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-neutral-200/70 ring-1 ring-neutral-200/70 sm:grid-cols-5', loading && 'opacity-60')}>
          {tiles.map(k => (
            <div key={k.label} className="bg-white px-3.5 py-3">
              <dt className="text-[12px] text-neutral-500">{k.label}</dt>
              <dd className={cn('mt-1 text-[17px] font-semibold tabular-nums tracking-[-0.015em]', k.bad ? 'text-red-600' : 'text-neutral-950')}>{k.value}</dd>
              <Delta value={k.delta} good={k.good} className="mt-1 -ml-1" />
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[12px] text-neutral-400">{t('campaigns.st_compare', { count: data.days })}</p>
        {data.store_counted && <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">{t('common.store_counted_note')}</p>}
      </div>

      {!empty && (
        <div className="rounded-xl border border-neutral-200/80 px-2 pb-2 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-2">
            <p className="text-[12px] font-medium text-neutral-500">{t('campaigns.st_per_day')}</p>
            <Segmented id="campaign-stats-metric" size="sm" value={metric} onChange={setMetric}
              items={(['clicks', 'cost', 'value', 'impressions'] as const).map(m => ({ value: m, label: t(`campaigns.st_metric_${m}`) }))} />
          </div>
          <TrendChart height={160} color={metric === 'cost' ? CHART.neutral : CHART.brand} format={formatOf(metric)} axisFormat={n => f.compact.format(n)}
            data={data.daily.map(p => ({ label: f.shortDate.format(day(p.date)), value: p[metric] }))} />
        </div>
      )}

      <div>
        <SectionTitle>{t('campaigns.st_products_title')}</SectionTitle>
        {data.products.top.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-neutral-200 px-4 py-5 text-center text-[13px] text-neutral-500">{t('campaigns.st_products_none')}</p>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200/80">
              <table className="w-full min-w-[520px] text-left text-[13px]">
                <thead className="text-[12px] text-neutral-500">
                  <tr className="border-b border-neutral-100">
                    <th className="px-3 py-2 font-medium">{t('campaigns.st_col_product')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('campaigns.st_clicks')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('campaigns.st_spend')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('campaigns.st_cpc')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('campaigns.st_conversions')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('campaigns.st_value')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {data.products.top.map(p => {
                    const o = offers.get(itemKey(p.item_id))
                    const cpc = derive(p).cpc
                    return (
                      <tr key={p.item_id}>
                        <td className="px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            {o?.image_url
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={o.image_url} alt="" className="size-8 shrink-0 rounded-md object-cover ring-1 ring-neutral-200/70" />
                              : <span className="size-8 shrink-0 rounded-md bg-neutral-100" />}
                            <span className="min-w-0">
                              <span className="block max-w-[220px] truncate text-neutral-900">{o ? o.title : p.item_id}</span>
                              {o?.variant_title && <span className="block max-w-[220px] truncate text-[12px] text-neutral-400">{o.variant_title}</span>}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{f.int.format(p.clicks)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{f.money.format(p.cost)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{cpc === null ? '—' : money2(cpc)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{f.num.format(p.conversions)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{f.money.format(p.value)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[12px] text-neutral-400">{t('campaigns.st_products_hint', { count: data.products.total })}</p>
          </>
        )}
      </div>

      <div>
        <SectionTitle>{t('campaigns.st_terms_title')}</SectionTitle>
        {data.terms.top.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-neutral-200 px-4 py-5 text-center text-[13px] text-neutral-500">{t('campaigns.st_terms_none')}</p>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200/80">
              <table className="w-full min-w-[440px] text-left text-[13px]">
                <thead className="text-[12px] text-neutral-500">
                  <tr className="border-b border-neutral-100">
                    <th className="px-3 py-2 font-medium">{t('campaigns.st_col_term')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('campaigns.st_clicks')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('campaigns.st_spend')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('campaigns.st_conversions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {data.terms.top.map(s => (
                    <tr key={s.term}>
                      <td className="max-w-[260px] truncate px-3 py-2 text-neutral-900">{s.term}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{f.int.format(s.clicks)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{f.money.format(s.cost)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{f.num.format(s.conversions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.terms.to && (
              <p className="mt-2 text-[12px] text-neutral-400">{t('campaigns.st_terms_hint', { count: data.terms.total, to: f.shortDate.format(day(data.terms.to)) })}</p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
