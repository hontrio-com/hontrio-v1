'use client'

import { useId, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ArrowUpRight, Check, ImageIcon, ShoppingBag, Sparkles, X } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { AnimatedList } from '@/components/app/fx/feedback'
import { Segmented } from '@/components/app/tabs'
import { Badge } from '@/components/app/badge'
import { Button, textActionStyles } from '@/components/app/button'
import { useTimeAgo } from '@/components/app/time'
import { day, type Formats } from '@/components/app/formats'
import { KIND_ICON, actionDetail, reasonOf } from '@/components/campaigns/pilot-tab'
import type { ActionItem } from '@/components/campaigns/types'
import type { Plan } from '@/lib/campaigns/plan'
import type { OverviewData } from '@/components/dashboard/types'

// =============================================
// „Magazinul tău", sub suprafața mare a Dashboard-ului (ca „Your projects" la
// Bezeno): graficul vânzărilor de pe site (venit, comenzi sau coș mediu), de
// unde vin vânzările, ce se vinde cel mai bine și, alături, ce produse pot
// intra în campanie (înainte de lansare) sau ce face pilotul automat (după).
// =============================================

export type Metric = 'revenue' | 'orders' | 'aov'
export type SeriesDay = { day: string; revenue: number; orders: number }

const EASE = [0.22, 1, 0.36, 1] as const
const SOURCE_ORDER = ['google_ads', 'google_organic', 'meta', 'email', 'other_campaigns', 'referral', 'direct']
const SHADES = ['#0a0a0a', '#404040', '#6b6b6b', '#8f8f8f', '#b3b3b3', '#d1d1d1', '#e5e5e5']

/** Cardul Bezeno: alb, colțuri mari, contur fin; umbra se adâncește la hover. */
const box = 'rounded-[1.4rem] border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_24px_50px_-32px_rgba(0,0,0,0.35)]'

export function StoreSection({ data, series, weekly, f, plan, proposals, journal, onChanged }: {
  data: OverviewData
  series: SeriesDay[]
  /** Peste 90 de zile, seria e pe săptămâni. */
  weekly: boolean
  f: Formats
  /** Planul campaniei (pentru produsele care pot intra); null = încă se încarcă. */
  plan: Plan | null
  /** Pilotul lucrează: în loc de produse, propunerile și jurnalul lui. */
  proposals: ActionItem[] | null
  journal: ActionItem[]
  onChanged: () => Promise<unknown>
}) {
  return (
    <div className="space-y-3 lg:space-y-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">
        <SalesChart className="lg:col-span-2" series={series} weekly={weekly} f={f} />
        <SourcesCard data={data} f={f} />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">
        <TopProducts className="lg:col-span-2" data={data} f={f} />
        {proposals ? <PilotCard proposals={proposals} journal={journal} f={f} onChanged={onChanged} />
          : plan ? <CatalogCard plan={plan} /> : <div className={cn(box, 'min-h-[220px] animate-pulse bg-neutral-50')} />}
      </div>
    </div>
  )
}

function CardTitle({ title, hint, action }: { title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold tracking-[-0.015em] text-neutral-900">{title}</p>
        {hint && <p className="mt-0.5 text-[12.5px] leading-relaxed text-neutral-500">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

// ── Graficul ──────────────────────────────────────────────────────────────────

function SalesChart({ series, weekly, f, className }: { series: SeriesDay[]; weekly: boolean; f: Formats; className?: string }) {
  const { t } = useT()
  const [metric, setMetric] = useState<Metric>('revenue')
  const id = useId().replace(/:/g, '')
  const data = series.map(s => ({ label: f.shortDate.format(day(s.day)), revenue: s.revenue, orders: s.orders, aov: s.orders ? s.revenue / s.orders : 0 }))
  const has = series.some(s => s.revenue > 0)
  const fmt = (n: number) => (metric === 'orders' ? t('common.orders_count', { count: Math.round(n) }) : f.money.format(n))

  return (
    <div className={cn(box, 'flex flex-col p-5', className)}>
      <CardTitle title={t(weekly ? `home.chart_${metric}_weekly` : `home.chart_${metric}`)} hint={t('overview.chart_hint')}
        action={has && (
          <Segmented id="home-metric" size="sm" value={metric} onChange={setMetric}
            items={[{ value: 'revenue', label: t('overview.chart_revenue') }, { value: 'orders', label: t('overview.chart_orders') }, { value: 'aov', label: t('home.chart_aov_short') }]} />
        )} />
      {has ? (
        <div className="mt-4 h-[264px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart key={metric} data={data} margin={{ top: 12, right: 6, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`sf-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0a0a0a" stopOpacity={0.13} />
                  <stop offset="100%" stopColor="#0a0a0a" stopOpacity={0} />
                </linearGradient>
                <filter id={`ss-${id}`} x="-5%" y="-20%" width="110%" height="160%">
                  <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#0a0a0a" floodOpacity="0.2" />
                </filter>
              </defs>
              <CartesianGrid vertical={false} stroke="#efefef" strokeDasharray="3 4" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#a3a3a3', fontSize: 11 }} minTickGap={28} interval="preserveStartEnd" />
              <YAxis tickLine={false} axisLine={false} width={42} tick={{ fill: '#a3a3a3', fontSize: 11 }} tickFormatter={n => f.compact.format(Number(n))} />
              <Tooltip cursor={{ stroke: '#0a0a0a', strokeOpacity: 0.2, strokeDasharray: '3 3' }}
                content={({ active, payload, label: tip }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload as (typeof data)[number]
                  return (
                    <div className="min-w-[150px] rounded-xl border border-neutral-200 bg-white/95 px-3 py-2 text-[12px] shadow-pop backdrop-blur">
                      <p className="mb-1 font-medium text-neutral-500">{tip}</p>
                      <p className="text-[15px] font-semibold tabular-nums text-neutral-950">{fmt(p[metric])}</p>
                      <p className="mt-0.5 text-neutral-500">{metric === 'orders' ? f.money.format(p.revenue) : t('common.orders_count', { count: p.orders })}</p>
                    </div>
                  )
                }} />
              <Area type="monotone" dataKey={metric} stroke="none" fill={`url(#sf-${id})`} isAnimationActive animationDuration={900} />
              <Area type="monotone" dataKey={metric} stroke="#0a0a0a" strokeWidth={2.2} fill="none" filter={`url(#ss-${id})`} dot={false}
                activeDot={{ r: 5, fill: '#ffffff', stroke: '#0a0a0a', strokeWidth: 2.5 }} isAnimationActive animationDuration={900} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
          <span className="flex size-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400"><ShoppingBag className="size-5" /></span>
          <p className="text-[14px] font-medium text-neutral-800">{t('overview.no_sales_title')}</p>
          <p className="max-w-xs text-[12.5px] text-neutral-500">{t('overview.no_sales')}</p>
        </div>
      )}
    </div>
  )
}

// ── Sursele ───────────────────────────────────────────────────────────────────

function SourcesCard({ data, f }: { data: OverviewData; f: Formats }) {
  const { t } = useT()
  const [hover, setHover] = useState<string | null>(null)
  const sources = [...(data.overview?.sources ?? [])].sort((a, b) => SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source))
  const total = sources.reduce((s, x) => s + Number(x.revenue), 0)
  const shade = (source: string) => SHADES[Math.max(0, SOURCE_ORDER.indexOf(source))] ?? SHADES[SHADES.length - 1]
  const name = (source: string) => (t.has(`overview.source_${source}`) ? t(`overview.source_${source}`) : t('overview.source_unknown'))

  return (
    <div className={cn(box, 'p-5')}>
      <CardTitle title={t('overview.sources_title')} hint={t('home.sources_hint')} />
      {sources.length === 0 || total === 0 ? (
        <p className="py-12 text-center text-[13px] text-neutral-400">{t('overview.no_sales')}</p>
      ) : (
        <>
          {/* Inelul: la trecerea cursorului, mijlocul spune sursa și partea ei */}
          <div className="relative mx-auto mt-4 size-[156px]" onMouseLeave={() => setHover(null)}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie data={sources.map(s => ({ ...s, revenue: Number(s.revenue) }))} dataKey="revenue" nameKey="source" innerRadius={54} outerRadius={74}
                  paddingAngle={sources.length > 1 ? 2.5 : 0} cornerRadius={4} stroke="none" startAngle={90} endAngle={-270}
                  onMouseEnter={(_, i) => setHover(sources[i]?.source ?? null)} isAnimationActive animationDuration={900}>
                  {sources.map(s => (
                    <Cell key={s.source} fill={shade(s.source)} opacity={hover && hover !== s.source ? 0.22 : 1} className="transition-opacity duration-200" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="max-w-[96px] truncate text-[11px] font-medium text-neutral-400">{hover ? name(hover) : t('home.sources_total')}</span>
              <span className="mt-0.5 text-[17px] font-semibold tabular-nums tracking-[-0.02em] text-neutral-950">
                {hover ? `${Math.round((Number(sources.find(s => s.source === hover)?.revenue ?? 0) / total) * 100)}%` : f.money.format(total)}
              </span>
            </div>
          </div>
          <ul className="mt-4 space-y-0.5" onMouseLeave={() => setHover(null)}>
            {sources.map(s => {
              const pct = Math.round((Number(s.revenue) / total) * 100)
              return (
                <li key={s.source} onMouseEnter={() => setHover(s.source)}
                  className={cn('flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-[13px] transition-colors', hover === s.source ? 'bg-neutral-100' : '')}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: shade(s.source) }} />
                    <span className={cn('truncate', s.source === 'google_ads' ? 'font-semibold text-neutral-900' : 'text-neutral-600')}>{name(s.source)}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-neutral-500">
                    <span className="font-medium text-neutral-900">{f.money.format(Number(s.revenue))}</span>
                    <span className="ml-2 inline-block w-9 text-right text-neutral-400">{pct}%</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

// ── Produsele de top ─────────────────────────────────────────────────────────

function TopProducts({ data, f, className }: { data: OverviewData; f: Formats; className?: string }) {
  const { t } = useT()
  const max = Math.max(1, ...data.top_products.map(p => p.revenue))
  return (
    <div className={cn(box, 'overflow-hidden', className)}>
      <div className="p-5 pb-3">
        <CardTitle title={t('overview.top_title')} hint={t(`overview.period_${data.days}`)}
          action={<Link href="/products" className={cn(textActionStyles, 'text-[13px]')}>{t('overview.view_products')}<ArrowRight /></Link>} />
      </div>
      {data.top_products.length === 0 ? (
        <p className="px-5 py-12 text-center text-[13px] text-neutral-400">{t('overview.no_sales')}</p>
      ) : (
        <ol className="divide-y divide-neutral-100 border-t border-neutral-100">
          {data.top_products.map((p, i) => {
            return (
              <li key={p.offer_id}>
                <Link href={`/products?search=${encodeURIComponent(p.title)}`} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-neutral-50/80">
                  <span className="w-4 text-center text-[12px] font-semibold tabular-nums text-neutral-300">{i + 1}</span>
                  <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-50 ring-1 ring-inset ring-neutral-200/70">
                    {p.image_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={p.image_url} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      : <ImageIcon className="size-4 text-neutral-300" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-neutral-900">{p.title}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-[12px] text-neutral-500">
                      {p.variant_title ? `${p.variant_title} · ` : ''}{t('catalog.units', { count: Number(p.units) })}
                    </span>
                  </span>
                  <span className="hidden w-28 shrink-0 sm:block">
                    <span className="block h-1.5 overflow-hidden rounded-full bg-neutral-100">
                      <motion.span className="block h-full rounded-full bg-neutral-950" initial={{ width: 0 }} animate={{ width: `${(p.revenue / max) * 100}%` }} transition={{ duration: 0.8, delay: 0.05 * i, ease: EASE }} />
                    </span>
                  </span>
                  <span className="w-24 shrink-0 text-right text-[13.5px] font-semibold tabular-nums text-neutral-900">{f.money.format(p.revenue)}</span>
                  <ArrowUpRight className="size-4 shrink-0 text-neutral-300 opacity-0 transition-[opacity,transform] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

// ── Înainte de lansare: produsele care pot intra ─────────────────────────────

function CatalogCard({ plan }: { plan: Plan }) {
  const { t } = useT()
  const [hover, setHover] = useState<string | null>(null)
  const counts = new Map<string, number>()
  for (const o of plan.offers) counts.set(o.reason ?? 'included', (counts.get(o.reason ?? 'included') ?? 0) + 1)
  const total = plan.offers.length
  const included = counts.get('included') ?? 0
  const parts = [...counts.entries()].sort((a, b) => (a[0] === 'included' ? -1 : b[0] === 'included' ? 1 : b[1] - a[1]))
  const color = (key: string, i: number) => (key === 'included' ? '#0a0a0a' : SHADES[Math.min(SHADES.length - 1, i + 2)])
  const name = (key: string) => key === 'included' ? t('home.catalog_included')
    : t.has(`campaigns.reason_${key}`) ? t(`campaigns.reason_${key}`) : t('campaigns.reason_generic')

  return (
    <div className={cn(box, 'flex flex-col p-5')}>
      <CardTitle title={t('home.catalog_title')} hint={t('home.catalog_hint')} />
      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="text-[36px] font-semibold leading-none tabular-nums tracking-[-0.04em] text-neutral-950">{included}</span>
        <span className="text-[16px] font-medium tabular-nums text-neutral-400">/ {total}</span>
      </p>
      <p className="mt-1 text-[12.5px] text-neutral-500">{t('home.catalog_can_run')}</p>
      {total > 0 && (
        <>
          <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full" onMouseLeave={() => setHover(null)}>
            {parts.map(([key, n], i) => (
              <motion.span key={key} onMouseEnter={() => setHover(key)} className="h-full first:rounded-l-full last:rounded-r-full" style={{ background: color(key, i) }}
                initial={{ width: 0 }} animate={{ width: `${(n / total) * 100}%`, opacity: hover && hover !== key ? 0.3 : 1 }} transition={{ duration: 0.7, ease: EASE }} />
            ))}
          </div>
          <ul className="mt-3 space-y-0.5" onMouseLeave={() => setHover(null)}>
            {parts.map(([key, n], i) => (
              <li key={key} onMouseEnter={() => setHover(key)} className={cn('flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[12.5px] transition-colors', hover === key && 'bg-neutral-100')}>
                <span className="flex min-w-0 items-center gap-2"><span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color(key, i) }} /><span className="truncate text-neutral-600">{name(key)}</span></span>
                <span className="font-semibold tabular-nums text-neutral-900">{n}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <Link href="/campaigns?tab=plan" className={cn(textActionStyles, 'mt-auto pt-4 text-[13px]')}>{t('home.catalog_open')}<ArrowRight /></Link>
    </div>
  )
}

// ── După lansare: pilotul automat ────────────────────────────────────────────

function PilotCard({ proposals, journal, f, onChanged }: { proposals: ActionItem[]; journal: ActionItem[]; f: Formats; onChanged: () => Promise<unknown> }) {
  const { t } = useT()
  const ago = useTimeAgo()
  const reduce = useReducedMotion()
  const [deciding, setDeciding] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const num = (n: number) => f.num.format(n)

  async function decide(a: ActionItem, decision: 'approve' | 'reject') {
    setDeciding(a.id)
    setError(null)
    try {
      const r = await fetch('/api/campaigns/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, decision }) })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) setError(body.error || t('campaigns.save_error'))
      await onChanged()
    } catch {
      setError(t('campaigns.save_error'))
    } finally {
      setDeciding(null)
    }
  }

  const recent = journal.filter(a => a.status !== 'proposed').slice(0, 3)
  return (
    <div className={cn(box, 'flex flex-col p-5')}>
      <CardTitle title={t('home.pilot_title')} hint={t('home.pilot_hint')}
        action={<Link href="/campaigns?tab=pilot" className={cn(textActionStyles, 'text-[13px]')}>{t('home.pilot_open')}<ArrowRight /></Link>} />

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</p>}

      {proposals.length > 0 ? (
        <ul className="mt-4 space-y-2.5">
          {proposals.slice(0, 2).map(a => {
            const Icon = KIND_ICON[a.kind] ?? Sparkles
            const detail = actionDetail(a, t, f)
            return (
              <motion.li key={a.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-neutral-200 bg-gradient-to-b from-white to-neutral-50/70 p-3.5">
                <div className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-white [&_svg]:size-4"><Icon /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-neutral-900">{t(`campaigns.kind_action_${a.kind}`)}</p>
                    {detail && <p className="mt-0.5 text-[12.5px] font-medium tabular-nums text-neutral-700">{detail}</p>}
                    {reasonOf(t, a.reason, num) && <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-neutral-500">{reasonOf(t, a.reason, num)}</p>}
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="xs" disabled={deciding === a.id} onClick={() => decide(a, 'reject')}><X />{t('campaigns.reject')}</Button>
                  <Button size="xs" variant="primary" loading={deciding === a.id} onClick={() => decide(a, 'approve')}>{deciding !== a.id && <Check />}{t('campaigns.approve')}</Button>
                </div>
              </motion.li>
            )
          })}
          {proposals.length > 2 && (
            <Link href="/campaigns?tab=pilot" className="block text-center text-[12.5px] font-medium text-neutral-500 hover:text-neutral-900">
              {t('home.pilot_more', { count: proposals.length - 2 })}
            </Link>
          )}
        </ul>
      ) : (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-neutral-50 px-3.5 py-3 text-[12.5px] text-neutral-600 ring-1 ring-inset ring-neutral-200/70">
          <span className="flex size-5 items-center justify-center rounded-full bg-neutral-950 text-white"><Check className="size-3" strokeWidth={3} /></span>
          {t('home.pilot_nothing')}
        </p>
      )}

      {recent.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-neutral-400">{t('home.pilot_recent')}</p>
          <AnimatedList every={260}>
            {recent.map(a => {
              const Icon = KIND_ICON[a.kind] ?? Sparkles
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-xl px-1.5 py-1.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 [&_svg]:size-3.5"><Icon /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-neutral-800">{t(`campaigns.kind_action_${a.kind}`)}</span>
                    <span className="block text-[11.5px] text-neutral-400">{ago(a.created_at)}</span>
                  </span>
                  <Badge tone={a.status === 'applied' ? 'green' : a.status === 'failed' ? 'red' : 'neutral'}>{t(`campaigns.action_status_${a.status}`)}</Badge>
                </div>
              )
            })}
          </AnimatedList>
        </div>
      )}
    </div>
  )
}
