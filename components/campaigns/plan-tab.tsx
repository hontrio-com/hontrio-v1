'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, CircleCheck, Info, Layers, Loader2 } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Card, CardHeader, Field } from '@/components/app/surface'
import { Badge } from '@/components/app/badge'
import { Button, linkStyles } from '@/components/app/button'
import { Callout } from '@/components/app/feedback'
import { ChoiceCard, Input } from '@/components/app/input'
import { InfoTip } from '@/components/app/info-tip'
import { FadeIn } from '@/components/app/motion'
import { LaunchCard } from '@/components/campaigns/launch-card'
import { PlanProducts } from '@/components/campaigns/plan-products'
import type { AuditData } from '@/components/campaigns/types'
import type { Formats } from '@/components/app/formats'
import { CONVERSIONS_PER_MONTH, GOAL_KEEP, GOALS, type Goal, type Plan } from '@/lib/campaigns/plan'

// =============================================
// Planul campaniei principale (tot ce nu e într-o campanie pe grupă):
// lansarea, obiectivul, ce va crea Hontrio în cont, rentabilitatea cu
// estimarea pe o lună și produsele, cu ce intră și ce rămâne afară.
// =============================================

type Settings = { goal?: Goal; daily_budget?: number | null }

/** 1234567890 → 123-456-7890, cum îl arată Google Ads. */
function customerId(id: string): string {
  return id.length === 10 ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id
}

function parseAmount(text: string): number | null | 'invalid' {
  const raw = text.trim().replace(/\s/g, '').replace(',', '.')
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 'invalid'
}

export function PlanTab({ plan, audit, running, currency, groupNames, f, onSaveSettings, onChanged, onError, onLaunched, onOpenGroup, onOpenMain }: {
  plan: Plan
  audit: AuditData | null
  /** Campania principală rulează (sau stă pe pauză): planul arată campania, nu lansarea. */
  running: boolean
  currency: string
  groupNames: Map<string, string>
  f: Formats
  onSaveSettings: (body: Settings) => Promise<boolean>
  onChanged: () => Promise<unknown>
  onError: (text: string) => void
  onLaunched: (text: string) => void
  onOpenGroup: (groupId: string) => void
  /** Fișa campaniei principale (după lansare). */
  onOpenMain: () => void
}) {
  const { t, intlLocale } = useT()
  const [goalSaving, setGoalSaving] = useState<Goal | null>(null)
  const { economics: econ, campaign, budget, forecast, structure } = plan
  const starter = plan.stage.id === 'starter'

  async function chooseGoal(goal: Goal) {
    if (goal === plan.goal || goalSaving) return
    setGoalSaving(goal)
    await onSaveSettings({ goal })
    setGoalSaving(null)
  }

  /** RO → România, ro → română; codul așa cum e dacă browserul nu-l știe. */
  const nameOf = (type: 'region' | 'language', code: string | null) => {
    if (!code) return null
    try { return new Intl.DisplayNames([intlLocale], { type }).of(code) ?? code } catch { return code }
  }
  // De ce „de verificat": pluginul (WooCommerce) sau canalele pe care Shopify nu le spune
  const launchCheck = plan.platform.id === 'shopify' ? 'campaigns.verified_at_launch_shopify' : 'campaigns.verified_at_launch'
  const place = [nameOf('region', campaign.country), nameOf('language', campaign.language)].filter(Boolean).join(' · ')
  const adjustments = [
    econ.vat_pct > 0 ? t(econ.vat_assumed ? 'campaigns.adjust_vat_assumed' : 'campaigns.adjust_vat', { vat: String(econ.vat_pct) }) : null,
    econ.discount_pct > 0 ? t('campaigns.adjust_discount', { discount: String(econ.discount_pct) }) : null,
  ].filter(Boolean) as string[]
  const muted = (text: string) => <span className="font-normal text-neutral-400">{text}</span>

  const rows: { label: string; value: ReactNode; hint?: ReactNode }[] = [
    { label: t('campaigns.row_type'), value: t(starter ? 'campaigns.type_shopping' : 'campaigns.type_pmax'), hint: t(starter ? 'campaigns.type_shopping_hint' : 'campaigns.type_pmax_hint') },
    { label: t('campaigns.row_products'), value: t('campaigns.products_value', { included: f.int.format(plan.counts.included), count: plan.offers.length }) },
    { label: t('campaigns.row_where'), value: place || '—' },
    {
      label: t('campaigns.row_account'),
      value: campaign.account
        ? <>{campaign.account.name || customerId(campaign.account.customer_id)}<span className="font-normal text-neutral-400"> · {customerId(campaign.account.customer_id)}</span></>
        : muted(t('campaigns.account_missing')),
    },
    {
      label: t('campaigns.row_merchant'),
      value: campaign.merchant.status === 'missing' ? muted(t('campaigns.merchant_missing'))
        : t.has(`campaigns.merchant_${campaign.merchant.status}`)
          ? t(`campaigns.merchant_${campaign.merchant.status}${campaign.merchant.via ? '' : '_unknown'}`, { via: campaign.merchant.via ?? '' })
          : t('campaigns.merchant_unverified_unknown'),
      hint: campaign.merchant.status === 'unverified' ? t(launchCheck) : undefined,
    },
    {
      label: t('campaigns.row_conversion'),
      value: campaign.conversion.status === 'missing' ? muted(t('campaigns.conversion_missing'))
        : t.has(`campaigns.conversion_${campaign.conversion.status}`)
          ? t(`campaigns.conversion_${campaign.conversion.status}${campaign.conversion.via ? '' : '_unknown'}`, { via: campaign.conversion.via ?? '' })
          : t('campaigns.conversion_unverified_unknown'),
      hint: campaign.conversion.status === 'unverified' ? t(launchCheck) : undefined,
    },
    starter ? {
      label: t('campaigns.row_bidding'),
      value: structure.cpc_ceiling !== null ? t('campaigns.bidding_cpc', { cpc: f.money2.format(structure.cpc_ceiling) }) : t('campaigns.bidding_cpc_unknown'),
      hint: structure.cpc_ceiling !== null
        ? `${t('campaigns.bidding_cpc_hint', { aov: econ.aov !== null ? f.money.format(econ.aov) : '—', roas: econ.break_even !== null ? f.num.format(econ.break_even) : '—' })}${structure.cpc_ceiling_low ? ` ${t('campaigns.bidding_cpc_low')}` : ''}`
        : undefined,
    } : {
      label: t('campaigns.row_bidding'),
      value: structure.start_target !== null ? t('campaigns.bidding_target', { roas: f.num.format(structure.start_target) }) : t('campaigns.bidding_no_target'),
      hint: structure.start_target !== null && plan.target_roas !== null
        ? t('campaigns.bidding_start_hint', { goal: f.num.format(plan.target_roas), break_even: econ.break_even !== null ? f.num.format(econ.break_even) : '—' })
        : undefined,
    },
    {
      label: t('campaigns.row_safety'),
      value: structure.loss_limit
        ? t('campaigns.safety_value', { none: f.money.format(structure.loss_limit.no_conversions), low: f.money.format(structure.loss_limit.low_roas) })
        : muted(t('campaigns.safety_unknown')),
      hint: t('campaigns.safety_hint'),
    },
    {
      label: t('campaigns.row_settings'),
      value: (
        <ul className="space-y-1 font-normal">
          {['settings_presence', 'settings_eu', 'settings_utm', ...(starter ? ['settings_no_partners'] : ['settings_no_expansion', 'settings_feed_only'])].map(k => (
            <li key={k} className="flex items-start gap-2"><CircleCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />{t(`campaigns.${k}`)}</li>
          ))}
          {structure.brand_negatives.length > 0 && (
            <li className="flex items-start gap-2"><CircleCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />{t('campaigns.settings_brand', { terms: structure.brand_negatives.join(', ') })}</li>
          )}
        </ul>
      ),
    },
    {
      label: t('campaigns.row_exclusions'),
      value: t('campaigns.exclusions_value', { count: plan.exclusions.item_ids.length }),
      hint: plan.exclusions.unmatched > 0
        ? t('campaigns.exclusions_unmatched', { count: plan.exclusions.unmatched })
        : plan.exclusions.mode === 'label' ? t('campaigns.exclusions_label') : t('campaigns.exclusions_hint'),
    },
  ]

  return (
    <div className="space-y-6">
      {/* A cui e planul: campania principală, cu tot ce nu e într-o campanie pe grupă */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100"><Layers className="size-4" /></span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-900">{t('campaigns.plan_intro_title')}</p>
            <p className="text-[13px] text-neutral-500">{t(plan.counts.in_groups > 0 ? 'campaigns.board_main_rest' : 'campaigns.board_main_all')}</p>
          </div>
        </div>
        {running && <Button size="sm" onClick={onOpenMain}>{t('campaigns.plan_see_campaign')}<ArrowRight /></Button>}
      </div>

      {/* Înainte de lansare: ce mai lipsește, auditul contului și lansarea */}
      {!running && (
        <FadeIn>
          <div className="space-y-3">
            <LaunchCard plan={plan} audit={audit} f={f} onChanged={onChanged} onLaunched={onLaunched} />
            {plan.history.google_ads_orders > 0 && (
              <Callout tone="info">
                {t('campaigns.existing_ads', { orders: t('common.orders_count', { count: plan.history.google_ads_orders }), total: f.money.format(plan.history.google_ads_total) })}
              </Callout>
            )}
          </div>
        </FadeIn>
      )}

      {/* Obiectivul: cât din profitul unei vânzări rămâne după reclamă */}
      <FadeIn delay={0.04}>
        <Card>
          <CardHeader title={t('campaigns.goal_title')} description={t('campaigns.goal_hint')} />
          <div className="grid grid-cols-1 gap-3 px-5 pb-5 pt-4 sm:grid-cols-3">
            {GOALS.map(g => {
              const target = plan.targets[g]
              return (
                <ChoiceCard key={g} active={(goalSaving ?? plan.goal) === g} disabled={!!goalSaving} onClick={() => chooseGoal(g)}
                  title={t(`campaigns.goal_${g}`)}
                  aside={goalSaving === g ? <Loader2 className="size-3.5 animate-spin text-neutral-400" /> : g === 'balanced' ? <Badge tone="brand">{t('campaigns.recommended')}</Badge> : undefined}
                  description={t(`campaigns.goal_${g}_desc`, { keep: String(Math.round(GOAL_KEEP[g] * 100)) })}
                  footer={
                    <span className="flex items-baseline justify-between gap-2 border-t border-neutral-100 pt-3">
                      <span className="text-[12px] text-neutral-500">{t('campaigns.econ_target')}</span>
                      <span className="text-[15px] font-semibold tabular-nums text-neutral-900">{target !== null ? f.num.format(target) : '—'}</span>
                    </span>
                  } />
              )
            })}
          </div>
        </Card>
      </FadeIn>

      <div className={cn('grid grid-cols-1 gap-6', !running && 'lg:grid-cols-5')}>
        {/* Campania propusă (după lansare, setările ei sunt în fișa campaniei) */}
        {!running && (
          <FadeIn delay={0.08} className="lg:col-span-3">
            <Card className="h-full">
              <CardHeader title={t('campaigns.campaign_title')} description={t('campaigns.campaign_hint')} />
              <dl className="divide-y divide-neutral-100 px-5 pb-2 pt-2">
                {rows.map(r => <Field key={r.label} label={r.label} hint={r.hint}>{r.value}</Field>)}
                <Field label={t('campaigns.row_budget')} hint={
                  budget.suggested !== null && econ.aov !== null && plan.target_roas !== null
                    ? t('campaigns.budget_hint', { conversions: String(CONVERSIONS_PER_MONTH), aov: f.money.format(econ.aov), roas: f.num.format(plan.target_roas), budget: f.money.format(budget.suggested) })
                    : t('campaigns.budget_hint_no_target')
                }>
                  <BudgetInput key={String(budget.chosen)} chosen={budget.chosen} suggested={budget.suggested} currency={currency}
                    onSave={value => onSaveSettings({ daily_budget: value })} />
                  {budget.chosen !== null && budget.suggested !== null && budget.chosen !== budget.suggested && (
                    <button onClick={() => onSaveSettings({ daily_budget: null })} className={cn(linkStyles, 'mt-2 text-[12px]')}>
                      {t('campaigns.budget_use_suggested', { budget: f.money.format(budget.suggested) })}
                    </button>
                  )}
                </Field>
              </dl>
            </Card>
          </FadeIn>
        )}

        {/* Rentabilitatea */}
        <FadeIn delay={0.1} className={running ? undefined : 'lg:col-span-2'}>
          <Card className="h-full">
            <CardHeader title={t('campaigns.econ_title')} description={t('campaigns.econ_hint')} />
            <div className="px-5 pb-5 pt-4">
              {econ.margin === null || econ.break_even === null ? (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-[13px] leading-relaxed text-neutral-600">{t('campaigns.econ_need_costs', { pct: String(Math.round(econ.cost_coverage * 100)) })}</p>
                  <Button asChild variant="primary" size="sm"><Link href="/products">{t('campaigns.add_costs')}<ArrowRight /></Link></Button>
                </div>
              ) : (
                <>
                  <dl className={cn('grid gap-px overflow-hidden rounded-xl bg-neutral-200/70 ring-1 ring-neutral-200/70', running ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2')}>
                    {[
                      { label: t('campaigns.econ_margin'), value: `${Math.round(econ.margin * 100)}%`, sub: t(`campaigns.econ_margin_${econ.margin_basis}`) },
                      { label: t('campaigns.econ_break_even'), value: f.num.format(econ.break_even), sub: t('campaigns.econ_break_even_sub') },
                      { label: t('campaigns.econ_target'), value: plan.target_roas !== null ? f.num.format(plan.target_roas) : '—', sub: t(`campaigns.goal_${plan.goal}`) },
                      { label: t('campaigns.econ_aov'), value: econ.aov !== null ? f.money.format(econ.aov) : '—', sub: t('campaigns.econ_aov_sub') },
                    ].map(k => (
                      <div key={k.label} className="bg-white p-3.5">
                        <dt className="text-[12px] text-neutral-500">{k.label}</dt>
                        <dd className="mt-1 text-[20px] font-semibold leading-tight tabular-nums tracking-[-0.02em] text-neutral-950">{k.value}</dd>
                        <p className="mt-0.5 text-[11px] leading-snug text-neutral-400">{k.sub}</p>
                      </div>
                    ))}
                  </dl>
                  {adjustments.length > 0 && <p className="mt-3 text-[12px] leading-relaxed text-neutral-400">{t('campaigns.adjust_intro')} {adjustments.join(' ')}</p>}
                  {forecast && (
                    <div className="mt-4 rounded-xl bg-gradient-to-br from-emerald-50/80 to-white p-4 ring-1 ring-emerald-100">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-semibold text-neutral-900">{t('campaigns.forecast_title')}</p>
                        <InfoTip>{t('campaigns.forecast_note')}</InfoTip>
                      </div>
                      <p className="mt-2 text-[24px] font-semibold tabular-nums tracking-[-0.02em] text-emerald-600">{f.money.format(forecast.profit)}</p>
                      <p className="text-[12px] text-neutral-500">{t('campaigns.forecast_profit')}</p>
                      <dl className="mt-3 space-y-1.5 border-t border-emerald-100/80 pt-3 text-[13px]">
                        {[
                          { label: t('campaigns.forecast_spend'), value: f.money.format(forecast.spend) },
                          { label: t('campaigns.forecast_revenue'), value: f.money.format(forecast.revenue) },
                          { label: t('campaigns.forecast_orders'), value: forecast.orders !== null ? `~${f.int.format(forecast.orders)}` : '—' },
                        ].map(r => (
                          <div key={r.label} className="flex items-center justify-between gap-3">
                            <dt className="text-neutral-500">{r.label}</dt>
                            <dd className="font-medium tabular-nums text-neutral-900">{r.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </FadeIn>
      </div>

      {/* Produsele din campanie */}
      <FadeIn delay={0.12}>
        <PlanProducts plan={plan} groupNames={groupNames} f={f} onChanged={onChanged} onError={onError} onOpenGroup={onOpenGroup} />
      </FadeIn>

      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-neutral-400">
        <Info className="mt-0.5 size-3.5 shrink-0" />{t('campaigns.footer')}
      </p>
    </div>
  )
}

/** Bugetul zilnic: gol = cel propus de Hontrio. Se salvează la Enter sau la ieșirea din câmp. */
function BudgetInput({ chosen, suggested, currency, onSave }: {
  chosen: number | null; suggested: number | null; currency: string; onSave: (value: number | null) => Promise<boolean>
}) {
  const { t } = useT()
  const shown = chosen === null ? '' : String(chosen).replace('.', ',')
  const [text, setText] = useState(shown)
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')

  async function commit() {
    const next = parseAmount(text)
    if (next === 'invalid') { setState('error'); return }
    if (next === chosen) { setState('idle'); return }
    setState('saving')
    // Dacă salvarea cade, pagina arată de ce
    await onSave(next)
    setState('idle')
  }

  return (
    <div className="flex items-center gap-2">
      <Input value={text} inputMode="decimal" aria-label={t('campaigns.row_budget')} aria-invalid={state === 'error'} suffix={currency}
        wrapperClassName="w-40" placeholder={suggested === null ? '' : String(suggested)} className="font-medium tabular-nums"
        onChange={e => { setText(e.target.value); setState('idle') }}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') { setText(shown); setState('idle') }
        }} />
      {state === 'saving' && <Loader2 className="size-4 animate-spin text-neutral-400" />}
      {state === 'error' && <span className="text-[12px] font-normal text-red-600">{t('campaigns.budget_invalid')}</span>}
    </div>
  )
}
