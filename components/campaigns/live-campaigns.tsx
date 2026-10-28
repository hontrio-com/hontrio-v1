'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n/context'
import { ExternalLink, Loader2, Pause, Play } from 'lucide-react'

// =============================================
// O campanie Hontrio din Google Ads: starea, cifrele pe 30 de zile (din
// cronul zilnic), ținta, bugetul, și pauza/repornirea cerute de om. Panoul
// „Campaniile tale" le arată pe fiecare sub campania (principală sau grupa)
// din care face parte.
// =============================================

export type LiveCampaign = {
  id: string
  name: string | null
  type: 'shopping' | 'performance_max'
  status: 'active' | 'paused' | 'ended' | string
  stage: 'starter' | 'growth' | 'segment' | null
  segment: string | null
  /** Grupa omului a cărei campanie e; null = campania principală. */
  group_id: string | null
  google_campaign_id: string | null
  daily_budget: number | null
  target_roas: number | null
  cpc_ceiling: number | null
  launched_at: string | null
  excluded: number
  included: number | null
  /** De ce e oprită sau încheiată: loss_limit, user, google, graduated, scheduled. */
  paused_reason: string | null
  ended_at: string | null
  /** Pragul de profit al produselor campaniei (segmentele de marjă și grupele au pragul lor). */
  break_even: number | null
  /** Profitul e socotit pe server, pe zi (înainte de împărțirea pe marje, „restul" avea pragul magazinului). */
  last30: { cost: number; clicks: number; conversions: number; value: number; profit: number | null }
}

/** Felul campaniei, pe scurt (pornirea, PMax, segmentele de marjă, grupele omului). */
export function campaignKindKey(c: Pick<LiveCampaign, 'type' | 'segment'>): string {
  if (c.segment === 'group') return c.type === 'shopping' ? 'campaigns.kind_group_shopping' : 'campaigns.kind_group_pmax'
  if (c.type === 'shopping') return 'campaigns.kind_starter'
  return c.segment === 'high_margin' ? 'campaigns.kind_high_margin' : c.segment === 'rest' ? 'campaigns.kind_rest' : 'campaigns.kind_growth'
}

export const isRunning = (c: Pick<LiveCampaign, 'status'>) => c.status === 'active' || c.status === 'paused'

type Formats = {
  fmt: Intl.NumberFormat
  /** Cu bani mărunți, pentru costul pe click. */
  fmt2: Intl.NumberFormat
  fmtNum: Intl.NumberFormat
}

type ItemProps = Formats & {
  campaign: LiveCampaign
  breakEven: number | null
  onChanged: () => Promise<unknown>
  onError: (text: string) => void
}

/** Cele cinci cifre pe 30 de zile ale unei campanii (sau ale mai multora, adunate). */
export function CampaignKpis({ last30, breakEven, fmt, fmtNum }: { last30: LiveCampaign['last30']; breakEven: number | null } & Pick<Formats, 'fmt' | 'fmtNum'>) {
  const { t } = useT()
  const roas = last30.cost > 0 ? last30.value / last30.cost : null
  const profit = last30.profit
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {[
        { label: t('campaigns.kpi_spend'), value: fmt.format(last30.cost) },
        { label: t('campaigns.kpi_value'), value: fmt.format(last30.value) },
        { label: t('campaigns.kpi_roas'), value: roas === null ? '—' : fmtNum.format(roas), warn: roas !== null && breakEven !== null && roas < breakEven },
        { label: t('campaigns.kpi_conversions'), value: fmtNum.format(last30.conversions) },
        { label: t('campaigns.kpi_profit'), value: profit === null ? '—' : fmt.format(profit), warn: profit !== null && profit < 0 },
      ].map(k => (
        <div key={k.label} className="rounded-md bg-neutral-50 px-2.5 py-2">
          <dt className="text-[10px] text-neutral-400">{k.label}</dt>
          <dd className={`text-[13px] font-semibold tabular-nums ${k.warn ? 'text-red-600' : 'text-neutral-900'}`}>{k.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** O campanie din Google Ads, cu starea, cifrele și pauza/repornirea. */
export function LiveCampaignItem({ campaign: c, breakEven, fmt, fmt2, fmtNum, onChanged, onError }: ItemProps) {
  const { t, intlLocale } = useT()
  const [busy, setBusy] = useState(false)

  async function setStatus(status: 'paused' | 'active') {
    setBusy(true)
    try {
      const r = await fetch(`/api/campaigns/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) onError(body.error || t('campaigns.save_error'))
      await onChanged()
    } catch {
      onError(t('campaigns.save_error'))
    } finally {
      setBusy(false)
    }
  }

  const dateFmt = new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' })

  /** De ce nu rulează (pe pauză sau încheiată). */
  function stateNote(): string | null {
    if (c.status === 'ended') {
      const date = c.ended_at ? dateFmt.format(new Date(c.ended_at)) : '—'
      return t(c.paused_reason === 'graduated' ? 'campaigns.ended_graduated' : c.paused_reason === 'scheduled' ? 'campaigns.ended_scheduled' : 'campaigns.ended_on', { date })
    }
    if (c.status !== 'paused') return null
    if (c.paused_reason === 'loss_limit') return t('campaigns.paused_loss_limit')
    if (c.paused_reason === 'user') return t('campaigns.paused_user')
    if (c.paused_reason === 'google') return t('campaigns.paused_google')
    return null
  }

  const be = c.break_even ?? breakEven
  const statusCls = c.status === 'active' ? 'bg-emerald-50 text-emerald-700' : c.status === 'paused' ? 'bg-amber-50 text-amber-700' : 'bg-neutral-100 text-neutral-500'
  const note = stateNote()
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md ${statusCls}`}>{t(`campaigns.status_${c.status}`)}</span>
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-neutral-100 text-neutral-600">{t(campaignKindKey(c))}</span>
          </div>
          <p className="mt-1.5 text-[13px] font-medium text-neutral-900 truncate">{c.name}</p>
          <p className="text-[11px] text-neutral-400">
            {c.launched_at ? t('campaigns.launched_on', { date: dateFmt.format(new Date(c.launched_at)) }) : null}
            {c.google_campaign_id ? ` · ${t('campaigns.live_id', { id: c.google_campaign_id })}` : ''}
          </p>
          {note && <p className={`mt-1 text-[11px] leading-relaxed ${c.paused_reason === 'loss_limit' ? 'text-amber-700' : 'text-neutral-500'}`}>{note}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a href="https://ads.google.com/" target="_blank" rel="noopener"
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-neutral-200 text-[11px] font-medium text-neutral-600 hover:border-neutral-300">
            {t('campaigns.open_google_ads')}<ExternalLink className="h-3 w-3" />
          </a>
          {isRunning(c) && (
            <button onClick={() => setStatus(c.status === 'active' ? 'paused' : 'active')} disabled={busy}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-neutral-200 text-[11px] font-medium text-neutral-700 hover:border-neutral-300 disabled:opacity-50">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : c.status === 'active' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {t(c.status === 'active' ? 'campaigns.pause' : 'campaigns.resume')}
            </button>
          )}
        </div>
      </div>

      {/* Una încheiată n-are cifre pe 30 de zile: ce a adus rămâne în Rapoarte */}
      {c.status !== 'ended' && (
        <>
          <div className="mt-3"><CampaignKpis last30={c.last30} breakEven={be} fmt={fmt} fmtNum={fmtNum} /></div>
          <p className="mt-2 text-[11px] text-neutral-500 leading-relaxed">
            {[
              c.daily_budget !== null ? t('campaigns.live_budget', { budget: fmt.format(c.daily_budget) }) : null,
              c.type === 'shopping' && c.cpc_ceiling !== null ? t('campaigns.live_cpc', { cpc: fmt2.format(c.cpc_ceiling) }) : null,
              c.type === 'performance_max' ? (c.target_roas !== null ? t('campaigns.live_target', { roas: fmtNum.format(c.target_roas) }) : t('campaigns.live_no_target')) : null,
              be !== null ? t('campaigns.live_break_even', { roas: fmtNum.format(be) }) : null,
              c.included !== null ? t('campaigns.live_included', { count: c.included }) : t('campaigns.live_excluded', { count: c.excluded }),
            ].filter(Boolean).join(' · ')}
          </p>
        </>
      )}
    </div>
  )
}
