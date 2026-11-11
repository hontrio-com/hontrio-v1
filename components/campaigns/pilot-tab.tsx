'use client'

import { useState } from 'react'
import { Bot, Check, History, Inbox, ShieldCheck, Sparkles } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { Card, CardHeader } from '@/components/app/surface'
import { Badge } from '@/components/app/badge'
import { Callout, EmptyState } from '@/components/app/feedback'
import { ChoiceCard, Input } from '@/components/app/input'
import { FadeIn } from '@/components/app/motion'
import { useTimeAgo } from '@/components/app/time'
import { campaignKindKey, type LiveCampaign } from '@/components/campaigns/live-campaigns'
import { JOURNAL_ROW, JournalEntry, PROPOSAL_ROW, ProposalItem } from '@/components/campaigns/journal'
import type { Formats } from '@/components/app/formats'
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

const RULES = ['pilot_rule_loss', 'pilot_rule_products', 'pilot_rule_budget', 'pilot_rule_learning'] as const

export function PilotTab({ mode, maxDailyBudget, currency, proposals, journal, campaigns, groupNames, piloting, f, onSaveSettings, onChanged, onError }: Props) {
  const { t } = useT()
  const [deciding, setDeciding] = useState<string | null>(null)
  const [savingMode, setSavingMode] = useState<Mode | null>(null)
  const [maxText, setMaxText] = useState(maxDailyBudget === null ? '' : String(maxDailyBudget).replace('.', ','))
  const [maxInvalid, setMaxInvalid] = useState(false)
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
                  {proposals.map(a => (
                    <li key={a.id} className={PROPOSAL_ROW}>
                      <ProposalItem a={a} label={campaignLabel(a)} time={ago(a.created_at)} f={f} busy={deciding === a.id} onDecide={d => decide(a, d)} />
                    </li>
                  ))}
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
                  {journal.map((a, i) => (
                    <li key={a.id} className={JOURNAL_ROW}>
                      <JournalEntry a={a} label={campaignLabel(a)} time={ago(a.created_at)} timeTitle={f.dateTime.format(new Date(a.created_at))} f={f} last={i === journal.length - 1} />
                    </li>
                  ))}
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
