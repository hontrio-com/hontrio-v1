'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n/context'
import { ExternalLink, Loader2, Pause, Play } from 'lucide-react'

// =============================================
// Campaniile lansate de Hontrio: starea, cifrele pe 30 de zile (din cronul
// zilnic), ținta, bugetul, și pauza/repornirea cerute de om.
// =============================================

export type LiveCampaign = {
  id: string
  name: string | null
  type: 'shopping' | 'performance_max'
  status: 'active' | 'paused' | 'ended' | string
  stage: 'starter' | 'growth' | 'segment' | null
  segment: string | null
  google_campaign_id: string | null
  daily_budget: number | null
  target_roas: number | null
  cpc_ceiling: number | null
  launched_at: string | null
  excluded: number
  included: number | null
  last30: { cost: number; clicks: number; conversions: number; value: number }
}

type Props = {
  campaigns: LiveCampaign[]
  breakEven: number | null
  fmt: Intl.NumberFormat
  /** Cu bani mărunți, pentru costul pe click. */
  fmt2: Intl.NumberFormat
  fmtNum: Intl.NumberFormat
  onChanged: () => Promise<unknown>
  onError: (text: string) => void
}

export function LiveCampaigns({ campaigns, breakEven, fmt, fmt2, fmtNum, onChanged, onError }: Props) {
  const { t, intlLocale } = useT()
  const [busy, setBusy] = useState<string | null>(null)

  async function setStatus(c: LiveCampaign, status: 'paused' | 'active') {
    setBusy(c.id)
    try {
      const r = await fetch(`/api/campaigns/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) onError(body.error || t('campaigns.save_error'))
      await onChanged()
    } catch {
      onError(t('campaigns.save_error'))
    } finally {
      setBusy(null)
    }
  }

  const dateFmt = new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' })

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <p className="text-[15px] font-semibold text-neutral-900">{t('campaigns.live_title')}</p>
      <p className="text-[12px] text-neutral-400 mt-0.5">{t('campaigns.live_hint')}</p>
      <div className="mt-4 space-y-3">
        {campaigns.map(c => {
          const roas = c.last30.cost > 0 ? c.last30.value / c.last30.cost : null
          const profit = breakEven ? c.last30.value / breakEven - c.last30.cost : null
          const statusCls = c.status === 'active' ? 'bg-emerald-50 text-emerald-700' : c.status === 'paused' ? 'bg-amber-50 text-amber-700' : 'bg-neutral-100 text-neutral-500'
          return (
            <div key={c.id} className="rounded-lg border border-neutral-200 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md ${statusCls}`}>{t(`campaigns.status_${c.status}`)}</span>
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-neutral-100 text-neutral-600">
                      {t(c.type === 'shopping' ? 'campaigns.kind_starter' : c.segment === 'high_margin' ? 'campaigns.kind_high_margin' : c.segment === 'rest' ? 'campaigns.kind_rest' : 'campaigns.kind_growth')}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] font-medium text-neutral-900 truncate">{c.name}</p>
                  <p className="text-[11px] text-neutral-400">
                    {c.launched_at ? t('campaigns.launched_on', { date: dateFmt.format(new Date(c.launched_at)) }) : null}
                    {c.google_campaign_id ? ` · ${t('campaigns.live_id', { id: c.google_campaign_id })}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href="https://ads.google.com/" target="_blank" rel="noopener"
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-neutral-200 text-[11px] font-medium text-neutral-600 hover:border-neutral-300">
                    {t('campaigns.open_google_ads')}<ExternalLink className="h-3 w-3" />
                  </a>
                  {(c.status === 'active' || c.status === 'paused') && (
                    <button onClick={() => setStatus(c, c.status === 'active' ? 'paused' : 'active')} disabled={busy === c.id}
                      className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-neutral-200 text-[11px] font-medium text-neutral-700 hover:border-neutral-300 disabled:opacity-50">
                      {busy === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : c.status === 'active' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      {t(c.status === 'active' ? 'campaigns.pause' : 'campaigns.resume')}
                    </button>
                  )}
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: t('campaigns.kpi_spend'), value: fmt.format(c.last30.cost) },
                  { label: t('campaigns.kpi_value'), value: fmt.format(c.last30.value) },
                  { label: t('campaigns.kpi_roas'), value: roas === null ? '—' : fmtNum.format(roas), warn: roas !== null && breakEven !== null && roas < breakEven },
                  { label: t('campaigns.kpi_conversions'), value: fmtNum.format(c.last30.conversions) },
                  { label: t('campaigns.kpi_profit'), value: profit === null ? '—' : fmt.format(profit), warn: profit !== null && profit < 0 },
                ].map(k => (
                  <div key={k.label} className="rounded-md bg-neutral-50 px-2.5 py-2">
                    <dt className="text-[10px] text-neutral-400">{k.label}</dt>
                    <dd className={`text-[13px] font-semibold tabular-nums ${k.warn ? 'text-red-600' : 'text-neutral-900'}`}>{k.value}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-2 text-[11px] text-neutral-500 leading-relaxed">
                {[
                  c.daily_budget !== null ? t('campaigns.live_budget', { budget: fmt.format(c.daily_budget) }) : null,
                  c.type === 'shopping' && c.cpc_ceiling !== null ? t('campaigns.live_cpc', { cpc: fmt2.format(c.cpc_ceiling) }) : null,
                  c.type === 'performance_max' ? (c.target_roas !== null ? t('campaigns.live_target', { roas: fmtNum.format(c.target_roas) }) : t('campaigns.live_no_target')) : null,
                  c.included !== null ? t('campaigns.live_included', { count: c.included }) : t('campaigns.live_excluded', { count: c.excluded }),
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[11px] text-neutral-400 leading-relaxed">{t('campaigns.live_footer')}</p>
    </div>
  )
}
