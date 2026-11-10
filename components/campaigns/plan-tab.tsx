'use client'

import { useState, type ReactNode } from 'react'
import { ArrowRight, CircleCheck, Info, Layers, Loader2 } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Card, CardHeader, Field } from '@/components/app/surface'
import { Button, linkStyles } from '@/components/app/button'
import { Callout } from '@/components/app/feedback'
import { Input } from '@/components/app/input'
import { FadeIn } from '@/components/app/motion'
import { LaunchCard } from '@/components/campaigns/launch-card'
import { PlanProducts } from '@/components/campaigns/plan-products'
import type { AuditData } from '@/components/campaigns/types'
import type { Formats } from '@/components/app/formats'
import type { Plan } from '@/lib/campaigns/plan'

// =============================================
// Planul campaniei principale (tot ce nu e într-o campanie pe grupă):
// lansarea, ce va crea Hontrio în cont (cu bugetul) și produsele, cu ce
// intră și ce rămâne afară.
// =============================================

type Settings = { daily_budget?: number | null }

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
  const { economics: econ, campaign, budget, structure } = plan
  const starter = plan.stage.id === 'starter'

  /** RO → România, ro → română; codul așa cum e dacă browserul nu-l știe. */
  const nameOf = (type: 'region' | 'language', code: string | null) => {
    if (!code) return null
    try { return new Intl.DisplayNames([intlLocale], { type }).of(code) ?? code } catch { return code }
  }
  // De ce „de verificat": pluginul (WooCommerce) sau canalele pe care Shopify nu le spune
  const launchCheck = plan.platform.id === 'shopify' ? 'campaigns.verified_at_launch_shopify' : 'campaigns.verified_at_launch'
  const place = [nameOf('region', campaign.country), nameOf('language', campaign.language)].filter(Boolean).join(' · ')
  const aov = econ.aov !== null ? f.money.format(econ.aov) : '—'
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
      value: structure.cpc_ceiling !== null ? t('campaigns.bidding_clicks', { cpc: f.money2.format(structure.cpc_ceiling) }) : t('campaigns.bidding_clicks_no_cap'),
      hint: structure.cpc_ceiling !== null
        ? `${t('campaigns.bidding_clicks_hint', { aov })}${structure.cpc_ceiling_low ? ` ${t('campaigns.bidding_cpc_low')}` : ''}`
        : undefined,
    } : {
      label: t('campaigns.row_bidding'),
      value: t('campaigns.bidding_value'),
      hint: t('campaigns.bidding_value_hint'),
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

      {/* Campania propusă (după lansare, setările ei sunt în fișa campaniei) */}
      {!running && (
        <FadeIn delay={0.04}>
          <Card>
            <CardHeader title={t('campaigns.campaign_title')} description={t('campaigns.campaign_hint')} />
            <dl className="divide-y divide-neutral-100 px-5 pb-2 pt-2">
              {rows.map(r => <Field key={r.label} label={r.label} hint={r.hint}>{r.value}</Field>)}
              <Field label={t('campaigns.row_budget')} hint={
                budget.suggested === null ? t('campaigns.budget_hint_none')
                  : t(budget.basis === 'history' ? 'campaigns.budget_hint_history' : 'campaigns.budget_hint_aov', { budget: f.money.format(budget.suggested), aov })
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
