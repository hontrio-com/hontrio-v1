'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowRight, ImageIcon, Info, Store } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardHeader } from '@/components/app/surface'
import { Badge, type Tone } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { Segmented } from '@/components/app/tabs'
import { KpiCard } from '@/components/app/kpi'
import { ChartLegend, DualTrend, StackedBars } from '@/components/app/charts'
import { Table, Td, Th, Tr } from '@/components/app/table'
import { Callout, EmptyState, Skeleton } from '@/components/app/feedback'
import { FadeIn } from '@/components/app/motion'
import { day, useFormats } from '@/components/app/formats'
import { campaignKindKey } from '@/components/campaigns/live-campaigns'

// =============================================
// Rapoarte — ce aduc reclamele Google Ads (din cronul zilnic): cheltuiala,
// valoarea conversiilor, ROAS-ul și costul pe conversie, pe zi, campanie,
// produs și termen de căutare; plus vânzările de pe site pe sursă și cele
// aduse de campaniile Hontrio.
// =============================================

type Kpi = { cost: number; clicks: number; impressions: number; conversions: number; value: number; roas: number | null }
type Data = {
  store: { platform: string; supported: boolean; store_name?: string | null; currency?: string } | null
  /** Gomag nu dă sursa comenzii: vânzările din campaniile Hontrio vin din conversiile Google Ads. */
  sales_source?: 'store_orders' | 'google_ads'
  period?: { days: number; from: string; to: string }
  /** `synced_at` = ultima citire a contului de către pilot; `sync_error` = de ce n-a mers ultima (cheie salvată). */
  google?: { connected: boolean; account: { id: string; name: string | null } | null; synced_at: string | null; sync_error?: string | null }
  ads?: {
    total: Kpi
    hontrio: Kpi | null
    daily: { date: string; cost: number; value: number }[]
    campaigns: {
      id: string; name: string; channel: string; hontrio: boolean
      /** Felul campaniei Hontrio (pornire, PMax, grupă); null la ale omului. */
      kind: { type: 'shopping' | 'performance_max'; segment: string | null } | null
      cost: number; clicks: number; conversions: number; value: number; roas: number | null
    }[]
    products: { item_id: string; title: string; image_url: string | null; cost: number; clicks: number; conversions: number; value: number; roas: number | null; verdict: Verdict }[]
    search_terms: { term: string; cost: number; clicks: number; conversions: number; value: number }[]
  } | null
  sales?: {
    daily: { day: string; revenue: number; google_ads: number; hontrio: number; orders: number }[]
    sources: { source: string; orders: number; revenue: number }[]
    total: { orders: number; revenue: number }
    hontrio: { orders: number; revenue: number }
  } | null
}

const PERIODS = [7, 30, 90]
/** Ca pilotul: fără vânzări, sau vânzări sub costul reclamei (ROAS sub 1). */
type Verdict = 'below_cost' | 'sells' | 'no_sales' | 'none'
const VERDICT_TONE: Record<Verdict, Tone> = { below_cost: 'red', sells: 'green', no_sales: 'amber', none: 'neutral' }

export default function ReportsPage() {
  const { t } = useT()
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  // Starea se schimbă doar în callback-urile răspunsului, nu în efectul care pornește încărcarea
  const load = useCallback((d: number) =>
    fetch(`/api/reports?days=${d}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<Data> })
      .then(body => { setData(body); setFailed(false) })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false)), [])

  useEffect(() => { load(days) }, [load, days])

  const f = useFormats(data?.store?.currency || 'RON')
  const label = (d: string) => f.shortDate.format(day(d))

  const header = (
    <PageHeader title={t('reports.title')} description={t('reports.subtitle')}
      actions={<Segmented id="reports-period" value={String(days)} onChange={v => setDays(Number(v))}
        items={PERIODS.map(p => ({ value: String(p), label: t('reports.period_days', { count: p }) }))} />} />
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2"><Skeleton className="h-8 w-40" /><Skeleton className="h-4 w-[420px] max-w-full" /></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-[136px] rounded-xl" />)}</div>
        <Skeleton className="h-[320px] rounded-xl" />
      </div>
    )
  }

  if (failed && !data) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <EmptyState icon={<AlertCircle />} title={t('reports.load_error')} description={t('campaigns.load_error_hint')}
            action={<Button variant="primary" onClick={() => load(days)}>{t('catalog.retry')}</Button>} />
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
            title={data?.store ? t('catalog.unsupported_title') : t('reports.no_store_title')}
            description={data?.store ? t('catalog.unsupported_desc') : t('reports.no_store_desc')}
            action={!data?.store && <Button asChild variant="primary"><Link href="/settings?tab=integrations">{t('catalog.connect_store')}</Link></Button>} />
        </Card>
      </div>
    )
  }

  const ads = data.ads ?? null
  const sales = data.sales ?? null
  const noSource = data.sales_source === 'google_ads'
  // „Fără cheltuieli" doar după o citire reușită a contului; până atunci (sau cât timp nu reușește), cifrele vin
  const syncError = data.google?.sync_error ?? null
  const noAdsReason = !data.google?.connected ? 'reports.no_ads_google' : !data.google.account ? 'reports.no_ads_account'
    : data.google.synced_at && !syncError ? 'reports.no_ads_empty' : 'reports.no_ads_waiting'
  const daily = ads?.daily ?? []
  const spark = (pick: (d: { cost: number; value: number }) => number | null) =>
    daily.length > 1 ? daily.flatMap(d => { const v = pick(d); return v === null ? [] : [{ label: label(d.date), value: v }] }) : undefined

  return (
    <div className="space-y-6">
      {header}

      {/* Google Ads: de ce n-a putut citi pilotul contul, la ultima trecere */}
      {syncError && data.google?.account && (
        <Callout tone="warning" title={t('reports.sync_error_title')}>{translateStored(t, syncError)}</Callout>
      )}
      {!ads ? (
        <Callout tone="info"
          action={noAdsReason !== 'reports.no_ads_empty' && noAdsReason !== 'reports.no_ads_waiting' && (
            <Button asChild size="sm"><Link href="/settings?tab=integrations">{t('reports.go_settings')}<ArrowRight /></Link></Button>
          )}>
          {t(noAdsReason)}
        </Callout>
      ) : (
        <>
          <FadeIn>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label={t('reports.kpi_spend')} value={ads.total.cost} format={n => f.money.format(n)} series={spark(d => d.cost)} color="#a3a3a3"
                footnote={t('reports.kpi_clicks', { count: ads.total.clicks, value: f.int.format(ads.total.clicks) })} />
              <KpiCard label={t('reports.kpi_value')} value={ads.total.value} format={n => f.money.format(n)} series={spark(d => d.value)}
                footnote={t('reports.kpi_conversions_count', { count: Math.round(ads.total.conversions), value: f.num.format(ads.total.conversions) })} />
              <KpiCard label={t('reports.kpi_roas')} value={ads.total.roas} format={n => f.num.format(n)} series={spark(d => (d.cost > 0 ? d.value / d.cost : null))}
                footnote={t('reports.kpi_roas_sub')} />
              <KpiCard label={t('reports.kpi_cpa')} value={ads.total.conversions > 0 ? ads.total.cost / ads.total.conversions : null} format={n => f.money.format(n)} color="#a3a3a3"
                footnote={t('reports.kpi_cpa_sub')} />
            </div>
          </FadeIn>
          {ads.hontrio && (
            <p className="-mt-2 text-[13px] text-neutral-500">
              {t('reports.hontrio_line', { spend: f.money.format(ads.hontrio.cost), value: f.money.format(ads.hontrio.value), roas: ads.hontrio.roas === null ? '—' : f.num.format(ads.hontrio.roas) })}
            </p>
          )}

          {/* Pe zile: valoarea vânzărilor față de cheltuială */}
          <FadeIn delay={0.04}>
            <Card>
              <CardHeader title={t('reports.daily_title')} description={data.period ? t('reports.daily_range', { from: label(data.period.from), to: label(data.period.to) }) : undefined}
                action={<ChartLegend items={[{ label: t('reports.kpi_value'), className: 'bg-neutral-900' }, { label: t('reports.kpi_spend'), className: 'bg-neutral-400' }]} />} />
              <div className="px-3 pb-4 pt-4">
                <DualTrend data={daily.map(d => ({ label: label(d.date), a: d.value, b: d.cost }))} names={{ a: t('reports.kpi_value'), b: t('reports.kpi_spend') }}
                  format={n => f.money.format(n)} axisFormat={n => f.compact.format(n)} />
              </div>
            </Card>
          </FadeIn>

          {/* Campaniile */}
          <FadeIn delay={0.06}>
            <ReportTable title={t('reports.campaigns_title')} empty={t('reports.empty')} count={ads.campaigns.length}
              head={<tr>
                <Th>{t('reports.col_campaign')}</Th>
                <Th align="right">{t('reports.kpi_spend')}</Th><Th align="right">{t('reports.kpi_value')}</Th>
                <Th align="right">{t('reports.kpi_roas')}</Th><Th align="right">{t('reports.kpi_conversions')}</Th>
              </tr>}>
              {ads.campaigns.map(c => {
                return (
                  <Tr key={c.id}>
                    <Td className="max-w-[340px]">
                      <p className="truncate font-medium text-neutral-900">{c.name}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-neutral-500">
                        {c.kind ? t(campaignKindKey(c.kind)) : t.has(`reports.channel_${c.channel.toLowerCase()}`) ? t(`reports.channel_${c.channel.toLowerCase()}`) : c.channel}
                        {c.hontrio && <Badge tone="brand" className="h-[18px] px-1 text-[10px]">{t('reports.by_hontrio')}</Badge>}
                      </p>
                    </Td>
                    <Td align="right">{f.money.format(c.cost)}</Td>
                    <Td align="right">{f.money.format(c.value)}</Td>
                    <Td align="right" className={c.roas !== null && c.roas < 1 ? 'font-semibold text-red-600' : 'font-medium text-neutral-900'}>{c.roas === null ? '—' : f.num.format(c.roas)}</Td>
                    <Td align="right">{f.num.format(c.conversions)}</Td>
                  </Tr>
                )
              })}
            </ReportTable>
          </FadeIn>

          {/* Produsele */}
          <FadeIn delay={0.08}>
            <ReportTable title={t('reports.products_title')} hint={t('reports.products_hint')} empty={t('reports.empty')} count={ads.products.length}
              head={<tr>
                <Th>{t('catalog.col_product')}</Th>
                <Th align="right">{t('reports.kpi_spend')}</Th><Th align="right">{t('reports.kpi_value')}</Th>
                <Th align="right">{t('reports.kpi_roas')}</Th><Th>{t('reports.col_verdict')}</Th>
              </tr>}>
              {ads.products.map(p => (
                <Tr key={p.item_id}>
                  <Td className="max-w-[340px]">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-neutral-50 ring-1 ring-inset ring-neutral-200/70">
                        {p.image_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={p.image_url} alt="" loading="lazy" className="size-full object-cover" />
                          : <ImageIcon className="size-3.5 text-neutral-300" />}
                      </div>
                      <span className="line-clamp-2 text-neutral-900">{p.title}</span>
                    </div>
                  </Td>
                  <Td align="right">{f.money.format(p.cost)}</Td>
                  <Td align="right">{f.money.format(p.value)}</Td>
                  <Td align="right" className="font-medium text-neutral-900">{p.roas === null ? '—' : f.num.format(p.roas)}</Td>
                  <Td><Badge tone={VERDICT_TONE[p.verdict]} dot>{t(`reports.verdict_${p.verdict}`)}</Badge></Td>
                </Tr>
              ))}
            </ReportTable>
          </FadeIn>

          {/* Termenii de căutare */}
          {ads.search_terms.length > 0 && (
            <FadeIn delay={0.1}>
              <ReportTable title={t('reports.terms_title')} hint={t('reports.terms_hint')} empty={t('reports.empty')} count={ads.search_terms.length}
                head={<tr>
                  <Th>{t('reports.col_term')}</Th>
                  <Th align="right">{t('reports.kpi_spend')}</Th><Th align="right">{t('reports.kpi_clicks_short')}</Th>
                  <Th align="right">{t('reports.kpi_conversions')}</Th><Th align="right">{t('reports.kpi_value')}</Th>
                </tr>}>
                {ads.search_terms.map(s => (
                  <Tr key={s.term}>
                    <Td className="max-w-[340px] truncate font-medium text-neutral-900">{s.term}</Td>
                    <Td align="right">{f.money.format(s.cost)}</Td>
                    <Td align="right">{f.int.format(s.clicks)}</Td>
                    <Td align="right">{f.num.format(s.conversions)}</Td>
                    <Td align="right">{f.money.format(s.value)}</Td>
                  </Tr>
                ))}
              </ReportTable>
            </FadeIn>
          )}
        </>
      )}

      {/* Vânzările de pe site */}
      {sales && (
        <FadeIn delay={0.12}>
          <Card>
            <CardHeader title={t('reports.sales_title')}
              description={<>
                {t('reports.sales_hint', { revenue: f.money.format(Number(sales.total.revenue)), orders: t('common.orders_count', { count: Number(sales.total.orders) }) })}
                {!noSource && Number(sales.hontrio.orders) > 0 && ` ${t('reports.sales_hontrio', { revenue: f.money.format(Number(sales.hontrio.revenue)), orders: t('common.orders_count', { count: Number(sales.hontrio.orders) }) })}`}
              </>}
              action={noSource
                ? <ChartLegend items={[{ label: t('reports.sales_site'), className: 'bg-neutral-900' }]} />
                : <ChartLegend items={[{ label: t('reports.source_google_ads'), className: 'bg-neutral-900' }, { label: t('reports.sales_other'), className: 'bg-neutral-300' }]} />} />
            {noSource && (
              <p className="mx-5 mt-3 rounded-lg bg-neutral-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-neutral-600">
                {ads?.hontrio
                  ? t('reports.sales_gomag_hontrio', { value: f.money.format(ads.hontrio.value), conversions: f.num.format(ads.hontrio.conversions) })
                  : t('reports.sales_gomag')}
              </p>
            )}
            {sales.daily.length === 0 ? (
              <p className="px-5 py-12 text-center text-[13px] text-neutral-400">{t('reports.sales_empty')}</p>
            ) : (
              <div className="px-3 pb-2 pt-4">
                {/* Fără sursa comenzii (Gomag), vânzările nu se pot împărți pe surse */}
                <StackedBars data={sales.daily.map(d => noSource
                  ? { label: label(d.day), a: Number(d.revenue), b: 0 }
                  : { label: label(d.day), a: Number(d.google_ads), b: Math.max(0, Number(d.revenue) - Number(d.google_ads)) })}
                  names={noSource ? { a: t('reports.sales_site'), b: t('reports.sales_other') } : { a: t('reports.source_google_ads'), b: t('reports.sales_other') }}
                  format={n => f.money.format(n)} axisFormat={n => f.compact.format(n)} />
              </div>
            )}
            {!noSource && sales.sources.length > 0 && (
              <ul className="mx-5 mb-5 mt-2 divide-y divide-neutral-100 border-t border-neutral-100">
                {sales.sources.map(s => (
                  <li key={s.source} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                    <span className="text-neutral-700">{t.has(`overview.source_${s.source}`) ? t(`overview.source_${s.source}`) : s.source}</span>
                    <span className="tabular-nums text-neutral-500">{t('common.orders_count', { count: Number(s.orders) })} · <span className="font-medium text-neutral-900">{f.money.format(Number(s.revenue))}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </FadeIn>
      )}

      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-neutral-400">
        <Info className="mt-0.5 size-3.5 shrink-0" />{t('reports.footer')}
      </p>
    </div>
  )
}

/** Un tabel al raportului, într-un card cu titlul lui. */
function ReportTable({ title, hint, head, count, empty, children }: { title: string; hint?: string; head: ReactNode; count: number; empty: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title={title} description={hint} />
      {count === 0 ? (
        <p className="px-5 py-12 text-center text-[13px] text-neutral-400">{empty}</p>
      ) : (
        <div className="mt-4">
          <Table className="min-w-[720px]">
            <thead>{head}</thead>
            <tbody>{children}</tbody>
          </Table>
        </div>
      )}
    </Card>
  )
}
