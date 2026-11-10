'use client'

import { useState } from 'react'
import {
  Ban, Bot, CalendarRange, Check, CirclePause, CircleStop, FileCheck, History, Inbox, PackageX, Pause, Play, RefreshCw, Rocket,
  ShieldAlert, ShieldCheck, Sparkles, Split, Target, TrendingUp, Wallet, X, type LucideIcon,
} from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import type { TFunction } from '@/lib/i18n/translate'
import { cn } from '@/lib/utils'
import { Card, CardHeader } from '@/components/app/surface'
import { Badge, type Tone } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { Callout, EmptyState } from '@/components/app/feedback'
import { ChoiceCard, Input } from '@/components/app/input'
import { FadeIn } from '@/components/app/motion'
import { useTimeAgo } from '@/components/app/time'
import { campaignKindKey, type LiveCampaign } from '@/components/campaigns/live-campaigns'
import { day, type Formats } from '@/components/app/formats'
import type { ActionItem } from '@/components/campaigns/types'
import { MODES, type Mode } from '@/lib/campaigns/plan'

// =============================================
// Pilotul: ce așteaptă răspunsul tău (propunerile, cu aprobă / respinge),
// tot ce s-a schimbat în cont (jurnalul) și, alături, cum lucrează pilotul
// (cu aprobare sau automat, până unde poate urca bugetul) și ce face mereu,
// orice mod ai alege.
// =============================================

type Props = {
  mode: Mode
  maxDailyBudget: number | null
  currency: string
  proposals: ActionItem[]
  journal: ActionItem[]
  /** Campaniile Hontrio: cu mai multe, fiecare propunere spune la care se referă. */
  campaigns: LiveCampaign[]
  /** Numele grupelor omului: propunerile pe campania unei grupe poartă numele ei. */
  groupNames: Map<string, string>
  /** Rulează cel puțin o campanie: pilotul lucrează. */
  piloting: boolean
  f: Formats
  onSaveSettings: (body: { mode?: Mode; max_daily_budget?: number | null }) => Promise<boolean>
  onChanged: () => Promise<unknown>
  onError: (text: string) => void
}

export const KIND_ICON: Record<string, LucideIcon> = {
  set_target: Target,
  set_budget: Wallet,
  graduate: TrendingUp,
  segment: Split,
  exclude_products: PackageX,
  add_negatives: Ban,
  pause_loss_limit: ShieldAlert,
  launch: Rocket,
  pause: Pause,
  enable: Play,
  declare_eu: FileCheck,
  pause_existing: CirclePause,
  sync_products: RefreshCw,
  end: CircleStop,
  set_end_date: CalendarRange,
}

const STATUS_TONE: Record<ActionItem['status'], Tone> = {
  proposed: 'outline', applied: 'green', rejected: 'neutral', failed: 'red', expired: 'neutral',
}

const RULES = ['pilot_rule_loss', 'pilot_rule_products', 'pilot_rule_budget', 'pilot_rule_learning'] as const

/**
 * Motivul salvat al unei acțiuni, în limba omului. Motivele vechi, de când Hontrio lucra cu
 * marje (ținta, împărțirea), nu mai au text: nu se arată deloc, decât cheia brută.
 */
export function reasonOf(t: TFunction, value: string | null | undefined, num: (n: number) => string): string | null {
  if (!value) return null
  const key = value.split('|')[0]
  return /^[a-z0-9_]+(\.[a-z0-9_]+)+$/.test(key) && !t.has(key) ? null : translateStored(t, value, num)
}

/** Ce schimbă o propunere a pilotului, pe scurt, din parametrii ei (și pe Dashboard). */
export function actionDetail(a: ActionItem, t: TFunction, f: Formats): string | null {
  const p = a.params
  const n = (k: string) => Number(p[k])
  switch (a.kind) {
    case 'set_budget': return t('campaigns.detail_budget', { from: f.money.format(n('from')), to: f.money.format(n('to')) })
    case 'graduate': return t('campaigns.detail_graduate', { budget: f.money.format(n('daily_budget')) })
    case 'pause_loss_limit': return t('campaigns.detail_loss', { spend: f.money.format(n('spend')) })
    case 'set_end_date': return typeof p.ends_on === 'string'
      ? t('campaigns.detail_end_date', { date: f.date.format(day(p.ends_on)) })
      : t('campaigns.detail_no_end_date')
    default: return null
  }
}

export function PilotTab({ mode, maxDailyBudget, currency, proposals, journal, campaigns, groupNames, piloting, f, onSaveSettings, onChanged, onError }: Props) {
  const { t } = useT()
  const [deciding, setDeciding] = useState<string | null>(null)
  const [savingMode, setSavingMode] = useState<Mode | null>(null)
  const [maxText, setMaxText] = useState(maxDailyBudget === null ? '' : String(maxDailyBudget).replace('.', ','))
  const [maxInvalid, setMaxInvalid] = useState(false)
  const num = (n: number) => f.num.format(n)
  const ago = useTimeAgo()

  async function decide(a: ActionItem, decision: 'approve' | 'reject') {
    setDeciding(a.id)
    try {
      const r = await fetch('/api/campaigns/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, decision }) })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) onError(body.error || t('campaigns.save_error'))
      await onChanged()
    } catch {
      onError(t('campaigns.save_error'))
    } finally {
      setDeciding(null)
    }
  }

  async function chooseMode(m: Mode) {
    if (m === mode || savingMode) return
    setSavingMode(m)
    await onSaveSettings({ mode: m })
    setSavingMode(null)
  }

  async function saveMax() {
    const raw = maxText.trim().replace(/\s/g, '').replace(',', '.')
    const value = raw ? Number(raw) : null
    if (value !== null && (!Number.isFinite(value) || value <= 0)) { setMaxInvalid(true); return }
    setMaxInvalid(false)
    if (value === maxDailyBudget) return
    await onSaveSettings({ max_daily_budget: value === null ? null : Math.round(value * 100) / 100 })
  }

  /** Campania la care se referă (doar când sunt mai multe; declarația UE și pauza privesc campaniile omului). */
  function campaignLabel(a: ActionItem): string | null {
    if (campaigns.length < 2 || !a.ad_campaign_id || a.kind === 'declare_eu' || a.kind === 'pause_existing') return null
    const c = campaigns.find(x => x.id === a.ad_campaign_id)
    if (!c) return null
    // Campania unei grupe: numele grupei spune mai mult decât felul ei
    return (c.group_id && groupNames.get(c.group_id)) || t(campaignKindKey(c))
  }

  const detail = (a: ActionItem) => actionDetail(a, t, f)

  function items(a: ActionItem) {
    if (a.kind === 'exclude_products') {
      const list = (a.params.products as { item_id: string; title: string; cost: number; conversions: number; roas: number | null; why: string }[] | undefined) ?? []
      return list.slice(0, 10).map(p => ({
        key: p.item_id,
        text: p.title,
        note: p.why === 'no_sales'
          ? t('campaigns.item_no_sales', { spend: f.money.format(p.cost) })
          : t('campaigns.item_below_cost', { spend: f.money.format(p.cost), roas: f.num.format(p.roas ?? 0) }),
      }))
    }
    if (a.kind === 'add_negatives') {
      const list = (a.params.terms as { term: string; cost: number; clicks: number }[] | undefined) ?? []
      return list.slice(0, 10).map(x => ({ key: x.term, text: t('campaigns.item_term_text', { term: x.term }), note: t('campaigns.item_term', { spend: f.money.format(x.cost), clicks: f.num.format(x.clicks) }) }))
    }
    return []
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        {!piloting && <FadeIn><Callout tone="info" title={t('campaigns.pilot_idle_title')}>{t('campaigns.pilot_idle')}</Callout></FadeIn>}

        {/* Propunerile */}
        <FadeIn>
          <Card>
            <CardHeader icon={<Sparkles />} title={t('campaigns.proposals_heading')} description={t(mode === 'auto' ? 'campaigns.proposals_hint_auto' : 'campaigns.proposals_hint')}
              action={proposals.length > 0 ? <Badge tone="brand">{proposals.length}</Badge> : undefined} />
            <div className="px-5 pb-5 pt-4">
              {proposals.length === 0 ? (
                <EmptyState icon={<Inbox />} title={t('campaigns.proposals_none_title')} description={t('campaigns.proposals_empty')} className="py-10" />
              ) : (
                <ul className="space-y-3">
                  {proposals.map(a => {
                    const Icon = KIND_ICON[a.kind] ?? Sparkles
                    const label = campaignLabel(a)
                    const d = detail(a)
                    const list = items(a)
                    return (
                      <li key={a.id} className="rounded-xl border border-neutral-200/80 bg-white p-4 transition-shadow hover:shadow-card">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100"><Icon className="size-4" /></span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-[14px] font-semibold text-neutral-900">{t(`campaigns.kind_action_${a.kind}`)}</p>
                                {label && <Badge>{label}</Badge>}
                              </div>
                              {d && <p className="mt-1 text-[14px] font-medium tabular-nums text-neutral-800">{d}</p>}
                              {reasonOf(t, a.reason, num) && <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{reasonOf(t, a.reason, num)}</p>}
                              <p className="mt-2 text-[12px] text-neutral-400">{ago(a.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 sm:pt-0.5">
                            <Button size="sm" disabled={deciding === a.id} onClick={() => decide(a, 'reject')}><X />{t('campaigns.reject')}</Button>
                            <Button size="sm" variant="primary" loading={deciding === a.id} onClick={() => decide(a, 'approve')}>
                              {deciding !== a.id && <Check />}{t('campaigns.approve')}
                            </Button>
                          </div>
                        </div>
                        {list.length > 0 && (
                          <ul className="mt-3 divide-y divide-neutral-100 overflow-hidden rounded-lg bg-neutral-50/70 ring-1 ring-inset ring-neutral-200/60 sm:ml-12">
                            {list.map(x => (
                              <li key={x.key} className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]">
                                <span className="truncate text-neutral-800">{x.text}</span>
                                <span className="shrink-0 tabular-nums text-neutral-500">{x.note}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </Card>
        </FadeIn>

        {/* Jurnalul */}
        <FadeIn delay={0.05}>
          <Card>
            <CardHeader icon={<History />} title={t('campaigns.journal_title')} description={t('campaigns.journal_hint')} />
            <div className="px-5 pb-5 pt-5">
              {journal.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-neutral-400">{t('campaigns.journal_empty')}</p>
              ) : (
                <ol>
                  {journal.map((a, i) => {
                    const Icon = KIND_ICON[a.kind] ?? Sparkles
                    const label = campaignLabel(a)
                    const note = a.error ? translateStored(t, a.error, num) : [detail(a), reasonOf(t, a.reason, num)].filter(Boolean).join(' · ')
                    return (
                      <li key={a.id} className="relative flex gap-3 pb-5 last:pb-0">
                        {i < journal.length - 1 && <span className="absolute bottom-0 left-[13px] top-8 w-px bg-neutral-200" />}
                        <span className={cn('relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-1',
                          a.status === 'failed' ? 'bg-red-50 text-red-500 ring-red-200' : a.status === 'applied' ? 'bg-white text-neutral-600 ring-neutral-200' : 'bg-neutral-50 text-neutral-400 ring-neutral-200')}>
                          <Icon className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="text-[13px] font-medium text-neutral-900">{t(`campaigns.kind_action_${a.kind}`)}</p>
                            <Badge tone={STATUS_TONE[a.status]}>{t(`campaigns.action_status_${a.status}`)}</Badge>
                            {label && <span className="text-[12px] text-neutral-500">{label}</span>}
                          </div>
                          {note && <p className={cn('mt-0.5 text-[12px] leading-relaxed', a.error ? 'text-red-600' : 'text-neutral-500')}>{note}</p>}
                          <p className="mt-1 text-[12px] text-neutral-400">
                            <time dateTime={a.created_at} title={f.dateTime.format(new Date(a.created_at))}>{ago(a.created_at)}</time>
                            {' · '}{t(a.source === 'user' ? 'campaigns.by_you' : 'campaigns.by_pilot')}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          </Card>
        </FadeIn>
      </div>

      {/* Cum lucrează pilotul */}
      <div className="space-y-6">
        <FadeIn delay={0.08}>
          <Card>
            <CardHeader icon={<Bot />} title={t('campaigns.pilot_settings')} description={t('campaigns.pilot_settings_hint')} />
            <div className="space-y-3 px-5 pb-5 pt-4">
              {MODES.map(m => (
                <ChoiceCard key={m} active={(savingMode ?? mode) === m} disabled={!!savingMode} onClick={() => chooseMode(m)}
                  title={t(`campaigns.mode_${m}`)} description={t(`campaigns.mode_${m}_desc`)} />
              ))}
              <div className="pt-3">
                <label htmlFor="max-budget" className="text-[13px] font-semibold text-neutral-900">{t('campaigns.max_budget_title')}</label>
                <Input id="max-budget" wrapperClassName="mt-2" value={maxText} inputMode="decimal" suffix={currency} placeholder={t('campaigns.max_budget_none')}
                  aria-invalid={maxInvalid} onChange={e => { setMaxText(e.target.value); setMaxInvalid(false) }} onBlur={saveMax}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
                {maxInvalid && <p className="mt-1.5 text-[12px] text-red-600">{t('campaigns.budget_invalid')}</p>}
                <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-500">{t('campaigns.max_budget_hint')}</p>
              </div>
            </div>
          </Card>
        </FadeIn>

        <FadeIn delay={0.12}>
          <Card>
            <CardHeader icon={<ShieldCheck />} title={t('campaigns.pilot_rules_title')} description={t('campaigns.pilot_rules_hint')} />
            <ul className="space-y-3 px-5 pb-5 pt-4">
              {RULES.map(k => (
                <li key={k} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-neutral-700">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/70"><Check className="size-2.5" strokeWidth={3} /></span>
                  {t(`campaigns.${k}`)}
                </li>
              ))}
            </ul>
          </Card>
        </FadeIn>
      </div>
    </div>
  )
}
