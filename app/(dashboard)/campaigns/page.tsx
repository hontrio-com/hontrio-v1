'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/context'
import {
  AlertCircle, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, ImageIcon, Info, Loader2, Search, Store, X,
} from 'lucide-react'
import { CONVERSIONS_PER_MONTH, GOAL_KEEP, GOALS, type Goal, type Mode, type Plan, type PlanOffer } from '@/lib/campaigns/plan'
import { LaunchPanel, type AuditData } from '@/components/campaigns/launch-panel'
import { LiveCampaigns, type LiveCampaign } from '@/components/campaigns/live-campaigns'
import { AutopilotPanel, type ActionItem } from '@/components/campaigns/autopilot-panel'
import type { AdsMode } from '@/lib/commerce/ads-data'

// =============================================
// Campanii — planul campaniei Google Ads (lib/campaigns/plan.ts): treapta,
// ce produse intră, ROAS-ul țintă, bugetul; auditul contului și lansarea;
// după lansare, campaniile, propunerile pilotului și jurnalul.
// =============================================

type Data = {
  store: { platform: string; supported: boolean; store_name?: string | null; currency?: string } | null
  plan: Plan | null
  audit?: AuditData | null
  campaigns?: LiveCampaign[]
  proposals?: ActionItem[]
  journal?: ActionItem[]
}
type Tab = 'included' | 'excluded'

// Motivele care nu se pot întoarce din Hontrio: se repară în magazin
const FIXED = new Set(['out_of_stock', 'google_rejected', 'price_unconfirmed', 'not_in_merchant'])
const PER_PAGE = 50

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
      <div className="relative w-36">
        <input value={text} inputMode="decimal" aria-label={t('campaigns.row_budget')}
          placeholder={suggested === null ? '' : String(suggested)}
          onChange={e => { setText(e.target.value); setState('idle') }}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') { setText(shown); setState('idle') }
          }}
          className={`w-full h-9 pl-3 pr-12 rounded-xl border bg-white text-[13px] font-medium text-neutral-900 tabular-nums placeholder:text-neutral-300 focus:outline-none transition-all ${state === 'error' ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-400'}`} />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 pointer-events-none">{currency}</span>
      </div>
      {state === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" />}
      {state === 'error' && <span className="text-[11px] text-red-500">{t('campaigns.budget_invalid')}</span>}
    </div>
  )
}

export default function CampaignsPage() {
  const { t, intlLocale: numberLocale } = useT()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [goalSaving, setGoalSaving] = useState<Goal | null>(null)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<Tab>('included')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const r = await fetch('/api/campaigns/plan')
      if (!r.ok) throw new Error()
      setData(await r.json())
      return true
    } catch {
      setFailed(true)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const currency = data?.store?.currency || 'RON'
  const fmt = useMemo(() => {
    try { return new Intl.NumberFormat(numberLocale, { style: 'currency', currency, maximumFractionDigits: 0 }) }
    catch { return new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 }) }
  }, [numberLocale, currency])
  // Costul pe click are nevoie de bani mărunți: 0,79 lei, nu „1 leu"
  const fmtMoney2 = useMemo(() => {
    try { return new Intl.NumberFormat(numberLocale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
    catch { return new Intl.NumberFormat(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
  }, [numberLocale, currency])
  const fmtNum = useMemo(() => new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }), [numberLocale])
  const fmtInt = useMemo(() => new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 }), [numberLocale])
  // Sub 1%, o zecimală: o marjă de −0,4% nu e „0%"
  const pctText = (m: number) => `${Math.abs(m) < 0.01 && m !== 0 ? fmtNum.format(m * 100) : fmtInt.format(Math.round(m * 100))}%`

  /** RO → România, ro → română; codul așa cum e dacă browserul nu-l știe. */
  const nameOf = useCallback((type: 'region' | 'language', code: string | null) => {
    if (!code) return null
    try { return new Intl.DisplayNames([numberLocale], { type }).of(code) ?? code } catch { return code }
  }, [numberLocale])

  const plan = data?.plan ?? null
  const list = useMemo(() => {
    if (!plan) return []
    const q = search.trim().toLowerCase()
    return plan.offers.filter(o => (tab === 'included' ? o.reason === null : o.reason !== null)
      && (!q || o.title.toLowerCase().includes(q) || (o.variant_title ?? '').toLowerCase().includes(q)))
  }, [plan, tab, search])
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE))
  const current = Math.min(page, pages)
  const visible = list.slice((current - 1) * PER_PAGE, current * PER_PAGE)

  async function saveSettings(body: { goal?: Goal; daily_budget?: number | null; mode?: Mode; max_daily_budget?: number | null }): Promise<boolean> {
    try {
      const r = await fetch('/api/campaigns/plan', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!r.ok) throw new Error()
      // Obiectivul și bugetul schimbă ținta, bugetul propus și estimarea: le socotește serverul
      return await load()
    } catch {
      setNotice(t('campaigns.save_error'))
      return false
    }
  }

  async function chooseGoal(goal: Goal) {
    if (!plan || goal === plan.goal || goalSaving) return
    setGoalSaving(goal)
    await saveSettings({ goal })
    setGoalSaving(null)
  }

  async function setMode(offer: PlanOffer, mode: AdsMode) {
    setBusy(s => new Set(s).add(offer.offer_id))
    try {
      const r = await fetch('/api/campaigns/offers', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offer_ids: [offer.offer_id], mode }),
      })
      if (!r.ok) throw new Error()
      await load()
    } catch {
      setNotice(t('campaigns.save_error'))
    } finally {
      setBusy(s => { const next = new Set(s); next.delete(offer.offer_id); return next })
    }
  }

  const header = (
    <div>
      <h1 className="text-[22px] font-semibold text-neutral-900 tracking-tight">{t('campaigns.title')}</h1>
      <p className="text-[13px] text-neutral-400 mt-0.5">{t('campaigns.subtitle')}</p>
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-5">
        {header}
        <div className="h-32 rounded-xl bg-neutral-100 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{[0, 1, 2].map(i => <div key={i} className="h-28 rounded-xl bg-neutral-100 animate-pulse" />)}</div>
        <div className="h-72 rounded-xl bg-neutral-100 animate-pulse" />
      </div>
    )
  }

  if (failed && !data) {
    return (
      <div className="space-y-5">
        {header}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white py-16 text-center">
          <AlertCircle className="h-6 w-6 text-neutral-400" />
          <p className="mt-3 text-[14px] font-medium text-neutral-900">{t('campaigns.load_error')}</p>
          <button onClick={load} className="mt-4 h-9 px-4 rounded-xl bg-neutral-900 text-white text-[13px] font-medium hover:bg-neutral-800">{t('catalog.retry')}</button>
        </div>
      </div>
    )
  }

  if (!data?.store || !data.store.supported || !plan) {
    return (
      <div className="space-y-5">
        {header}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white py-16 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100"><Store className="h-6 w-6 text-neutral-500" /></div>
          <p className="mt-4 text-[15px] font-semibold text-neutral-900">{data?.store ? t('catalog.unsupported_title') : t('campaigns.no_store_title')}</p>
          <p className="mt-1 max-w-md text-[13px] text-neutral-400 leading-relaxed">{data?.store ? t('catalog.unsupported_desc') : t('campaigns.no_store_desc')}</p>
          {!data?.store && (
            <Link href="/settings?tab=integrations" className="mt-5 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-neutral-900 text-white text-[13px] font-medium hover:bg-neutral-800">
              {t('catalog.connect_store')}
            </Link>
          )}
        </div>
      </div>
    )
  }

  const { economics: econ, campaign, budget, forecast, structure } = plan
  const live = data.campaigns ?? []
  // O campanie Hontrio rulează (sau stă pe pauză): pagina arată campaniile și pilotul, nu lansarea
  const running = live.some(c => c.status === 'active' || c.status === 'paused')
  const starter = plan.stage.id === 'starter'
  // De ce „de verificat": pluginul (WooCommerce) sau canalele pe care Shopify nu le spune
  const launchCheck = plan.platform.id === 'shopify' ? 'campaigns.verified_at_launch_shopify' : 'campaigns.verified_at_launch'
  const place = [nameOf('region', campaign.country), nameOf('language', campaign.language)].filter(Boolean).join(' · ')
  const adjustments = [
    econ.vat_pct > 0 ? t(econ.vat_assumed ? 'campaigns.adjust_vat_assumed' : 'campaigns.adjust_vat', { vat: String(econ.vat_pct) }) : null,
    econ.discount_pct > 0 ? t('campaigns.adjust_discount', { discount: String(econ.discount_pct) }) : null,
  ].filter(Boolean) as string[]

  const campaignRows: { label: string; value: ReactNode; hint?: string }[] = [
    {
      label: t('campaigns.row_type'),
      value: t(starter ? 'campaigns.type_shopping' : 'campaigns.type_pmax'),
      hint: t(starter ? 'campaigns.type_shopping_hint' : 'campaigns.type_pmax_hint'),
    },
    { label: t('campaigns.row_products'), value: t('campaigns.products_value', { included: fmtInt.format(plan.counts.included), count: plan.offers.length }) },
    { label: t('campaigns.row_where'), value: place || '—' },
    {
      label: t('campaigns.row_account'),
      value: campaign.account
        ? <>{campaign.account.name || customerId(campaign.account.customer_id)}<span className="text-neutral-400"> · {customerId(campaign.account.customer_id)}</span></>
        : <span className="text-neutral-400">{t('campaigns.account_missing')}</span>,
    },
    {
      label: t('campaigns.row_merchant'),
      value: campaign.merchant.status === 'missing'
        ? <span className="text-neutral-400">{t('campaigns.merchant_missing')}</span>
        : t.has(`campaigns.merchant_${campaign.merchant.status}`)
          ? t(`campaigns.merchant_${campaign.merchant.status}${campaign.merchant.via ? '' : '_unknown'}`, { via: campaign.merchant.via ?? '' })
          : t('campaigns.merchant_unverified_unknown'),
      hint: campaign.merchant.status === 'unverified' ? t(launchCheck) : undefined,
    },
    {
      label: t('campaigns.row_conversion'),
      value: campaign.conversion.status === 'missing'
        ? <span className="text-neutral-400">{t('campaigns.conversion_missing')}</span>
        : t.has(`campaigns.conversion_${campaign.conversion.status}`)
          ? t(`campaigns.conversion_${campaign.conversion.status}${campaign.conversion.via ? '' : '_unknown'}`, { via: campaign.conversion.via ?? '' })
          : t('campaigns.conversion_unverified_unknown'),
      hint: campaign.conversion.status === 'unverified' ? t(launchCheck) : undefined,
    },
    starter ? {
      label: t('campaigns.row_bidding'),
      value: structure.cpc_ceiling !== null ? t('campaigns.bidding_cpc', { cpc: fmtMoney2.format(structure.cpc_ceiling) }) : t('campaigns.bidding_cpc_unknown'),
      hint: structure.cpc_ceiling !== null
        ? `${t('campaigns.bidding_cpc_hint', { aov: econ.aov !== null ? fmt.format(econ.aov) : '—', roas: econ.break_even !== null ? fmtNum.format(econ.break_even) : '—' })}${structure.cpc_ceiling_low ? ` ${t('campaigns.bidding_cpc_low')}` : ''}`
        : undefined,
    } : {
      label: t('campaigns.row_bidding'),
      value: structure.start_target !== null ? t('campaigns.bidding_target', { roas: fmtNum.format(structure.start_target) }) : t('campaigns.bidding_no_target'),
      hint: structure.start_target !== null && plan.target_roas !== null
        ? t('campaigns.bidding_start_hint', { goal: fmtNum.format(plan.target_roas), break_even: econ.break_even !== null ? fmtNum.format(econ.break_even) : '—' })
        : undefined,
    },
    {
      label: t('campaigns.row_safety'),
      value: structure.loss_limit
        ? t('campaigns.safety_value', { none: fmt.format(structure.loss_limit.no_conversions), low: fmt.format(structure.loss_limit.low_roas) })
        : <span className="text-neutral-400">{t('campaigns.safety_unknown')}</span>,
      hint: t('campaigns.safety_hint'),
    },
    {
      label: t('campaigns.row_settings'),
      value: (
        <ul className="space-y-0.5">
          {['settings_presence', 'settings_eu', 'settings_utm', ...(starter ? ['settings_no_partners'] : ['settings_no_expansion', 'settings_feed_only'])].map(k => (
            <li key={k} className="flex items-start gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />{t(`campaigns.${k}`)}</li>
          ))}
          {structure.brand_negatives.length > 0 && (
            <li className="flex items-start gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />{t('campaigns.settings_brand', { terms: structure.brand_negatives.join(', ') })}</li>
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
    <div className="space-y-5">
      {header}

      {notice && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-[12px] leading-relaxed bg-amber-50 border border-amber-100 text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 mt-px" />
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} className="opacity-50 hover:opacity-100" aria-label={t('campaigns.dismiss')}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* După lansare: campaniile și pilotul */}
      {live.length > 0 && (
        <LiveCampaigns campaigns={live} breakEven={econ.break_even} fmt={fmt} fmt2={fmtMoney2} fmtNum={fmtNum} onChanged={load} onError={setNotice} />
      )}
      {running && (
        <AutopilotPanel mode={plan.settings.mode} maxDailyBudget={plan.settings.max_daily_budget} currency={currency}
          proposals={data.proposals ?? []} journal={data.journal ?? []} fmt={fmt} fmtNum={fmtNum}
          onSaveSettings={saveSettings} onChanged={load} onError={setNotice} />
      )}

      {/* Înainte de lansare: ce mai lipsește, auditul contului și lansarea */}
      {!running && (
        <>
          <LaunchPanel plan={plan} audit={data.audit ?? null} hasAccount={!!campaign.account} onChanged={load} />
          {plan.history.google_ads_orders > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-[12px] leading-relaxed bg-neutral-50 border border-neutral-100 text-neutral-600">
              <Info className="h-4 w-4 shrink-0 mt-px text-neutral-400" />
              <span>{t('campaigns.existing_ads', { orders: t('common.orders_count', { count: plan.history.google_ads_orders }), total: fmt.format(plan.history.google_ads_total) })}</span>
            </div>
          )}
        </>
      )}

      {/* Obiectivul: cât din profitul unei vânzări rămâne după reclamă */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <p className="text-[15px] font-semibold text-neutral-900">{t('campaigns.goal_title')}</p>
        <p className="text-[12px] text-neutral-400 mt-0.5 leading-relaxed">{t('campaigns.goal_hint')}</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {GOALS.map(g => {
            // Alegerea se vede pe loc; cifrele vin după ce serverul socotește planul
            const active = (goalSaving ?? plan.goal) === g
            return (
              <button key={g} onClick={() => chooseGoal(g)} disabled={!!goalSaving} aria-pressed={active}
                className={`text-left p-4 rounded-xl border transition-all disabled:cursor-wait ${active ? 'border-neutral-900 ring-1 ring-neutral-900' : 'border-neutral-200 hover:border-neutral-300'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] font-semibold text-neutral-900">{t(`campaigns.goal_${g}`)}</p>
                  {goalSaving === g
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" />
                    : active ? <CheckCircle2 className="h-4 w-4 text-neutral-900" />
                    : g === 'balanced' && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-neutral-100 text-neutral-500">{t('campaigns.recommended')}</span>}
                </div>
                <p className="mt-1 text-[12px] text-neutral-500 leading-relaxed">{t(`campaigns.goal_${g}_desc`, { keep: String(Math.round(GOAL_KEEP[g] * 100)) })}</p>
                <p className="mt-3 text-[12px] font-medium text-neutral-800 tabular-nums">
                  {plan.targets[g] !== null ? t('campaigns.goal_roas', { roas: fmtNum.format(plan.targets[g]!) }) : t('campaigns.goal_roas_unknown')}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Campania propusă (după lansare, setările ei sunt în cardul campaniei) */}
        {!running && (
        <div className="lg:col-span-3 bg-white border border-neutral-200 rounded-xl p-5">
          <p className="text-[15px] font-semibold text-neutral-900">{t('campaigns.campaign_title')}</p>
          <p className="text-[12px] text-neutral-400 mt-0.5">{t('campaigns.campaign_hint')}</p>
          <dl className="mt-4 divide-y divide-neutral-100">
            {campaignRows.map(r => (
              <div key={r.label} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="text-[12px] text-neutral-400">{r.label}</dt>
                <dd className="sm:col-span-2">
                  <p className="text-[13px] text-neutral-900">{r.value}</p>
                  {r.hint && <p className="mt-0.5 text-[11px] text-neutral-400 leading-relaxed">{r.hint}</p>}
                </dd>
              </div>
            ))}
            <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
              <dt className="text-[12px] text-neutral-400 sm:pt-2.5">{t('campaigns.row_budget')}</dt>
              <dd className="sm:col-span-2">
                <BudgetInput key={String(budget.chosen)} chosen={budget.chosen} suggested={budget.suggested} currency={currency}
                  onSave={value => saveSettings({ daily_budget: value })} />
                <p className="mt-1.5 text-[11px] text-neutral-400 leading-relaxed">
                  {budget.suggested !== null && econ.aov !== null && plan.target_roas !== null
                    ? t('campaigns.budget_hint', {
                      conversions: String(CONVERSIONS_PER_MONTH), aov: fmt.format(econ.aov),
                      roas: fmtNum.format(plan.target_roas), budget: fmt.format(budget.suggested),
                    })
                    : t('campaigns.budget_hint_no_target')}
                </p>
                {budget.chosen !== null && budget.suggested !== null && budget.chosen !== budget.suggested && (
                  <button onClick={() => saveSettings({ daily_budget: null })} className="mt-1 text-[11px] font-medium text-neutral-600 underline underline-offset-2 hover:text-neutral-900">
                    {t('campaigns.budget_use_suggested', { budget: fmt.format(budget.suggested) })}
                  </button>
                )}
              </dd>
            </div>
          </dl>
        </div>
        )}

        {/* Rentabilitatea */}
        <div className={`${running ? 'lg:col-span-5' : 'lg:col-span-2'} bg-white border border-neutral-200 rounded-xl p-5`}>
          <p className="text-[15px] font-semibold text-neutral-900">{t('campaigns.econ_title')}</p>
          {econ.margin === null || econ.break_even === null ? (
            <div className="mt-4 flex flex-col items-start gap-3">
              <p className="text-[13px] text-neutral-500 leading-relaxed">{t('campaigns.econ_need_costs', { pct: String(Math.round(econ.cost_coverage * 100)) })}</p>
              <Link href="/products" className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-[12px] font-medium">
                {t('campaigns.add_costs')}<ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  { label: t('campaigns.econ_margin'), value: `${Math.round(econ.margin * 100)}%`, sub: t(`campaigns.econ_margin_${econ.margin_basis}`) },
                  { label: t('campaigns.econ_break_even'), value: fmtNum.format(econ.break_even), sub: t('campaigns.econ_break_even_sub') },
                  { label: t('campaigns.econ_target'), value: plan.target_roas !== null ? fmtNum.format(plan.target_roas) : '—', sub: t(`campaigns.goal_${plan.goal}`) },
                  { label: t('campaigns.econ_aov'), value: econ.aov !== null ? fmt.format(econ.aov) : '—', sub: t('campaigns.econ_aov_sub') },
                ].map(k => (
                  <div key={k.label} className="rounded-lg border border-neutral-100 bg-neutral-50/60 p-3">
                    <p className="text-[11px] text-neutral-400">{k.label}</p>
                    <p className="mt-0.5 text-[18px] font-bold text-neutral-900 tabular-nums leading-tight">{k.value}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-400 leading-snug">{k.sub}</p>
                  </div>
                ))}
              </div>
              {adjustments.length > 0 && (
                <p className="mt-3 text-[11px] text-neutral-400 leading-relaxed">{t('campaigns.adjust_intro')} {adjustments.join(' ')}</p>
              )}
              {forecast && (
                <div className="mt-4 rounded-lg border border-neutral-100 p-3">
                  <p className="text-[12px] font-medium text-neutral-800">{t('campaigns.forecast_title')}</p>
                  <dl className="mt-2 space-y-1.5 text-[12px]">
                    {[
                      { label: t('campaigns.forecast_spend'), value: fmt.format(forecast.spend) },
                      { label: t('campaigns.forecast_revenue'), value: fmt.format(forecast.revenue) },
                      { label: t('campaigns.forecast_orders'), value: forecast.orders !== null ? `~${fmtInt.format(forecast.orders)}` : '—' },
                      { label: t('campaigns.forecast_profit'), value: fmt.format(forecast.profit), strong: true },
                    ].map(r => (
                      <div key={r.label} className="flex items-center justify-between gap-3">
                        <dt className="text-neutral-500">{r.label}</dt>
                        <dd className={`tabular-nums ${r.strong ? 'font-semibold text-emerald-600' : 'text-neutral-900'}`}>{r.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 text-[11px] text-neutral-400 leading-relaxed">{t('campaigns.forecast_note')}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Produsele din campanie */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="flex flex-col gap-3 p-4 border-b border-neutral-100 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 rounded-xl bg-neutral-100 p-1 self-start">
            {(['included', 'excluded'] as Tab[]).map(k => (
              <button key={k} onClick={() => { setTab(k); setPage(1) }}
                className={`h-8 px-3 rounded-lg text-[12px] font-medium transition-all ${tab === k ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}>
                {t(`campaigns.tab_${k}`, { count: fmtInt.format(k === 'included' ? plan.counts.included : plan.counts.excluded) })}
              </button>
            ))}
          </div>
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-300 pointer-events-none" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={t('campaigns.search_placeholder')}
              className="w-full h-9 pl-9 pr-8 rounded-xl bg-neutral-50 border border-neutral-100 text-[13px] text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:border-neutral-300 focus:bg-white transition-all" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-500" aria-label={t('campaigns.dismiss')}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="py-14 text-center text-[13px] text-neutral-400">{search ? t('catalog.no_results') : t(`campaigns.empty_${tab}`)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-neutral-100 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                  <th className="px-4 py-2.5">{t('catalog.col_product')}</th>
                  <th className="px-3 py-2.5 text-right">{t('campaigns.col_sales')}</th>
                  <th className="px-3 py-2.5 text-right">{t('catalog.col_margin')}</th>
                  <th className="px-3 py-2.5 text-right" title={t('campaigns.col_break_even_hint')}>{t('campaigns.col_break_even')}</th>
                  {tab === 'excluded' && <th className="px-3 py-2.5">{t('campaigns.col_reason')}</th>}
                  <th className="px-4 py-2.5 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {visible.map(o => {
                  const overTarget = o.reason === null && plan.target_roas !== null && (o.break_even === null ? o.margin !== null : o.break_even > plan.target_roas)
                  const saving = busy.has(o.offer_id)
                  return (
                    <tr key={o.offer_id} className="align-middle hover:bg-neutral-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50 flex items-center justify-center">
                            {o.image_url
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={o.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                              : <ImageIcon className="h-4 w-4 text-neutral-300" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-neutral-900 leading-snug line-clamp-2">{o.title}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-400">
                              {o.variant_title && <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-neutral-600">{o.variant_title}</span>}
                              {o.mode === 'include' && o.reason === null && <span className="rounded-md bg-neutral-900 px-1.5 py-0.5 text-white">{t('campaigns.included_by_you')}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {o.units > 0 ? (
                          <>
                            <p className="text-[13px] font-medium text-neutral-900 tabular-nums">{t('catalog.units', { count: Number(o.units) })}</p>
                            <p className="text-[11px] text-neutral-400 tabular-nums">{fmt.format(o.revenue)}</p>
                          </>
                        ) : <span className="text-[12px] text-neutral-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {o.margin !== null && o.cost_price !== null ? (
                          <>
                            <p className={`text-[13px] font-semibold tabular-nums ${o.margin <= 0 ? 'text-red-600' : o.margin_issue ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {pctText(o.margin)}
                            </p>
                            <p className="text-[11px] text-neutral-400 tabular-nums">{fmt.format(o.price - o.cost_price)}</p>
                          </>
                        ) : <span className="text-[12px] text-neutral-300" title={t('campaigns.no_cost_hint')}>{t('campaigns.no_cost')}</span>}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {o.break_even !== null ? (
                          <span className={`text-[13px] tabular-nums ${overTarget ? 'font-semibold text-amber-600' : 'text-neutral-700'}`}
                            title={overTarget ? t('campaigns.over_target_hint', { roas: fmtNum.format(plan.target_roas!) }) : undefined}>
                            {fmtNum.format(o.break_even)}
                          </span>
                        ) : <span className={`text-[12px] ${o.margin !== null ? 'text-red-500' : 'text-neutral-300'}`}>{o.margin !== null ? t('campaigns.never_profitable') : '—'}</span>}
                      </td>
                      {tab === 'excluded' && (
                        <td className="px-3 py-3">
                          <span className={`inline-flex text-[11px] font-medium px-1.5 py-0.5 rounded-md ${FIXED.has(o.reason!) ? 'bg-red-50 text-red-600' : o.reason === 'manual' ? 'bg-neutral-100 text-neutral-600' : 'bg-amber-50 text-amber-700'}`}>
                            {t.has(`campaigns.reason_${o.reason}`) ? t(`campaigns.reason_${o.reason}`) : t('campaigns.reason_generic')}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {saving ? <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-neutral-400" />
                          : o.reason === null ? (
                            o.mode === 'include'
                              ? <RowAction label={t('campaigns.action_auto')} onClick={() => setMode(o, 'auto')} />
                              : <RowAction label={t('campaigns.action_exclude')} onClick={() => setMode(o, 'exclude')} />
                          )
                          : FIXED.has(o.reason) ? <span className="text-[11px] text-neutral-400">{t('campaigns.fix_in_store', { platform: plan.platform.name })}</span>
                          : o.reason === 'manual' ? <RowAction label={t('campaigns.action_restore')} onClick={() => setMode(o, 'auto')} />
                          : <RowAction label={t('campaigns.action_include')} onClick={() => setMode(o, 'include')} />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-neutral-100 text-[12px] text-neutral-500">
            <span>{t('catalog.page_of', { from: fmtInt.format((current - 1) * PER_PAGE + 1), to: fmtInt.format(Math.min(current * PER_PAGE, list.length)), total: fmtInt.format(list.length) })}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={current === 1}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-40" aria-label={t('catalog.prev')}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={current === pages}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-40" aria-label={t('catalog.next')}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="flex items-start gap-1.5 text-[11px] text-neutral-400 leading-relaxed">
        <Info className="h-3.5 w-3.5 shrink-0 mt-px" />{t('campaigns.footer')}
      </p>
    </div>
  )
}

function RowAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="h-7 px-2.5 rounded-lg border border-neutral-200 text-[11px] font-medium text-neutral-600 hover:border-neutral-300 hover:text-neutral-900 transition-all">
      {label}
    </button>
  )
}
