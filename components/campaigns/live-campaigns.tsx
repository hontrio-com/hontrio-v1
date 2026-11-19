'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n/context'
import { ExternalLink, Pause, Play } from 'lucide-react'
import { Badge, type Tone } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { cn } from '@/lib/utils'
import type { Formats } from '@/components/app/formats'

// =============================================
// O campanie Hontrio din Google Ads: starea, cifrele pe 30 de zile (din
// cronul zilnic), bugetul, și pauza/repornirea cerute de om. Apare în
// fișa campaniei (principala sau o grupă), câte una pentru fiecare campanie
// Google din spatele ei.
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
  last30: { cost: number; clicks: number; conversions: number; value: number }
  /** Pe zi, ultimele 30 de zile. */
  trend?: { date: string; value: number; cost: number }[]
}

/** Felul campaniei, pe scurt (pornirea, PMax, grupele omului; segmentele vechi apar ca PMax). */
export function campaignKindKey(c: Pick<LiveCampaign, 'type' | 'segment'>): string {
  if (c.segment === 'group') return c.type === 'shopping' ? 'campaigns.kind_group_shopping' : 'campaigns.kind_group_pmax'
  if (c.type === 'shopping') return 'campaigns.kind_starter'
  return 'campaigns.kind_growth'
}

export const isRunning = (c: Pick<LiveCampaign, 'status'>) => c.status === 'active' || c.status === 'paused'

export const STATUS_TONE: Record<string, Tone> = { active: 'green', paused: 'amber', ended: 'neutral' }

type Props = {
  campaign: LiveCampaign
  f: Formats
  onChanged: () => Promise<unknown>
  onError: (text: string) => void
}

/** O campanie din Google Ads, cu starea, cifrele și pauza/repornirea. */
export function LiveCampaignItem({ campaign: c, f, onChanged, onError }: Props) {
  const { t } = useT()
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

  /** De ce nu rulează (pe pauză sau încheiată). */
  function stateNote(): string | null {
    if (c.status === 'ended') {
      const date = c.ended_at ? f.date.format(new Date(c.ended_at)) : '—'
      return t(c.paused_reason === 'graduated' ? 'campaigns.ended_graduated' : c.paused_reason === 'scheduled' ? 'campaigns.ended_scheduled' : 'campaigns.ended_on', { date })
    }
    if (c.status !== 'paused') return null
    if (c.paused_reason === 'loss_limit') return t('campaigns.paused_loss_limit')
    if (c.paused_reason === 'user') return t('campaigns.paused_user')
    if (c.paused_reason === 'google') return t('campaigns.paused_google')
    return null
  }

  const roas = c.last30.cost > 0 ? c.last30.value / c.last30.cost : null
  const note = stateNote()
  const stats = [
    { label: t('campaigns.kpi_spend'), value: f.money.format(c.last30.cost) },
    { label: t('campaigns.kpi_value'), value: f.money.format(c.last30.value) },
    // Sub 1, reclamele au costat mai mult decât au adus vânzările
    { label: t('campaigns.kpi_roas'), value: roas === null ? '—' : f.num.format(roas), warn: roas !== null && roas < 1 },
    { label: t('campaigns.kpi_conversions'), value: f.num.format(Math.round(c.last30.conversions * 10) / 10) },
    { label: t('campaigns.st_clicks'), value: f.int.format(c.last30.clicks) },
    { label: t('campaigns.st_cpc'), value: c.last30.clicks > 0 ? f.money2.format(c.last30.cost / c.last30.clicks) : '—' },
  ]

  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS_TONE[c.status] ?? 'neutral'} dot live={c.status === 'active'}>{t(`campaigns.status_${c.status}`)}</Badge>
            <Badge>{t(campaignKindKey(c))}</Badge>
          </div>
          <p className="mt-2 truncate text-[13px] font-medium text-neutral-900">{c.name}</p>
          <p className="mt-0.5 text-[12px] text-neutral-500">
            {c.launched_at ? t('campaigns.launched_on', { date: f.date.format(new Date(c.launched_at)) }) : null}
            {c.google_campaign_id ? ` · ${t('campaigns.live_id', { id: c.google_campaign_id })}` : ''}
          </p>
          {note && <p className={cn('mt-1.5 text-[12px] leading-relaxed', c.paused_reason === 'loss_limit' ? 'text-amber-700' : 'text-neutral-500')}>{note}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button asChild size="sm" variant="ghost">
            <a href="https://ads.google.com/" target="_blank" rel="noopener">{t('campaigns.open_google_ads')}<ExternalLink /></a>
          </Button>
          {isRunning(c) && (
            <Button size="sm" loading={busy} onClick={() => setStatus(c.status === 'active' ? 'paused' : 'active')}>
              {!busy && (c.status === 'active' ? <Pause /> : <Play />)}
              {t(c.status === 'active' ? 'campaigns.pause' : 'campaigns.resume')}
            </Button>
          )}
        </div>
      </div>

      {/* Una încheiată n-are cifre pe 30 de zile: ce a adus rămâne în Rapoarte */}
      {c.status !== 'ended' && (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-neutral-100 ring-1 ring-neutral-100 sm:grid-cols-3">
            {stats.map(s => (
              <div key={s.label} className="bg-white px-3 py-2.5">
                <dt className="text-[11px] text-neutral-500">{s.label}</dt>
                <dd className={cn('mt-0.5 text-[14px] font-semibold tabular-nums', s.warn ? 'text-red-600' : 'text-neutral-900')}>{s.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[12px] leading-relaxed text-neutral-500">
            {[
              c.daily_budget !== null ? t('campaigns.live_budget', { budget: f.money.format(c.daily_budget) }) : null,
              c.type === 'shopping' && c.cpc_ceiling !== null ? t('campaigns.live_cpc', { cpc: f.money2.format(c.cpc_ceiling) }) : null,
              // Hontrio nu pune ținte: doar o campanie veche are una, păstrată (și schimbată) în Google
              c.type === 'performance_max' && c.target_roas !== null ? t('campaigns.live_target', { roas: f.num.format(c.target_roas) }) : null,
              c.included !== null ? t('campaigns.live_included', { count: c.included }) : t('campaigns.live_excluded', { count: c.excluded }),
            ].filter(Boolean).join(' · ')}
          </p>
        </>
      )}
    </div>
  )
}
