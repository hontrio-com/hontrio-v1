'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useT } from '@/lib/i18n/context'
import {
  AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, BadgePercent, CalendarRange, Check, CheckCircle2, Coins, FolderTree,
  ImageIcon, Info, ListChecks, Loader2, Rocket, Search, ShieldCheck, Sparkles, Tag, X, type LucideIcon,
} from 'lucide-react'
import { GOAL_KEEP, GOALS, type Goal, type Plan, type PlanOffer } from '@/lib/campaigns/plan'
import {
  accountBlockers, assignedAsDraft, assignGroups, buildGroupPlan, canRun, EMPTY_RULES, isEmptyRules, otherBudgetsFor,
  type GroupPlan, type GroupRules, type GroupType, type ProductGroup,
} from '@/lib/campaigns/groups'
import type { AuditData } from '@/components/campaigns/launch-panel'
import type { LiveCampaign } from '@/components/campaigns/live-campaigns'
import { AccountChoices, choicesDone, type Overlap } from '@/components/campaigns/account-choices'

// =============================================
// Editorul unei campanii pe grupă de produse, în trei pași: ce produse vinde
// (categorie, brand, preț, reduceri, alese de mână, și orice combinație),
// cum rulează (obiectiv, buget, tip, perioadă), apoi rezumatul cu estimarea
// și lansarea. Planul grupei se socotește pe loc, cu aceleași funcții ca pe
// server (lib/campaigns/groups.ts), deci cifrele sunt cele de la lansare.
// =============================================

type Filter = 'categories' | 'brands' | 'price' | 'sale' | 'manual'
const FILTERS: { id: Filter; icon: LucideIcon }[] = [
  { id: 'categories', icon: FolderTree },
  { id: 'brands', icon: Tag },
  { id: 'price', icon: Coins },
  { id: 'sale', icon: BadgePercent },
  { id: 'manual', icon: ListChecks },
]
const NEW_ID = 'new'
const PER_PAGE = 40
const TYPES: GroupType[] = ['auto', 'shopping', 'performance_max']

export type Step = 1 | 2 | 3

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Grupa de schimbat; null = una nouă. */
  group: ProductGroup | null
  initialStep?: Step
  plan: Plan
  /** Toate grupele salvate, cu planul lor de pe server. */
  groups: GroupPlan[]
  campaigns: LiveCampaign[]
  audit: AuditData | null
  today: string
  currency: string
  fmt: Intl.NumberFormat
  fmt2: Intl.NumberFormat
  fmtNum: Intl.NumberFormat
  fmtInt: Intl.NumberFormat
  /** După o salvare: pagina își reîncarcă datele. */
  onSaved: () => Promise<unknown>
  /** După lansare: mesajul de arătat în pagină. */
  onLaunched: (text: string) => void
}

function filtersOf(r: GroupRules): Set<Filter> {
  const s = new Set<Filter>()
  if (r.categories.length) s.add('categories')
  if (r.brands.length) s.add('brands')
  if (r.price_min !== null || r.price_max !== null) s.add('price')
  if (r.on_sale) s.add('sale')
  if (r.include.length) s.add('manual')
  return s
}

function parseAmount(text: string): number | null | 'invalid' {
  const raw = text.trim().replace(/\s/g, '').replace(',', '.')
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 'invalid'
}

/** Parametrii unei note (avertisment, pas de făcut): banii în moneda magazinului; `count` rămâne număr, pentru plural. */
export function noteParams(params: Record<string, string | number> | undefined, fmt: Intl.NumberFormat): Record<string, string | number> {
  const out: Record<string, string | number> = { ...(params ?? {}) }
  for (const k of ['total', 'max', 'suggested'] as const) if (typeof out[k] === 'number') out[k] = fmt.format(out[k] as number)
  return out
}

const sameRules = (a: GroupRules, b: GroupRules) => JSON.stringify(a) === JSON.stringify(b)

/** Categoriile (sau brandurile) din catalog, cu câte oferte are fiecare, de la cea mai mare. */
function facetOf(offers: PlanOffer[], key: 'category' | 'brand'): [string, number][] {
  const counts = new Map<string, number>()
  for (const o of offers) if (o[key]) counts.set(o[key]!, (counts.get(o[key]!) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}
const short = (xs: string[]) => (xs.length <= 2 ? xs.join(', ') : `${xs.slice(0, 2).join(', ')} +${xs.length - 2}`)

export function GroupEditor(props: Props) {
  const { open, onOpenChange } = props
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl outline-none sm:max-w-[680px] sm:rounded-l-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right duration-300">
          {/* Cheia repornește editorul la fiecare deschidere, cu grupa lui */}
          {open && <EditorBody key={`${props.group?.id ?? NEW_ID}:${props.initialStep ?? 1}`} {...props} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function EditorBody({
  group, initialStep = 1, plan, groups, campaigns, audit, today, currency, fmt, fmt2, fmtNum, fmtInt, onOpenChange, onSaved, onLaunched,
}: Props) {
  const { t } = useT()
  const live = group?.status === 'live'
  const [step, setStepState] = useState<Step>(initialStep)
  const body = useRef<HTMLDivElement>(null)
  // Fiecare pas începe de sus
  const setStep = (s: Step) => { setStepState(s); body.current?.scrollTo({ top: 0 }) }
  const [rules, setRules] = useState<GroupRules>(group?.rules ?? EMPTY_RULES)
  const [active, setActive] = useState<Set<Filter>>(() => (group ? filtersOf(group.rules) : new Set()))
  const [name, setName] = useState(group?.name ?? '')
  const [nameTouched, setNameTouched] = useState(!!group)
  const [goal, setGoal] = useState<Goal>(group?.goal ?? plan.goal)
  const [budgetText, setBudgetText] = useState(group?.daily_budget ? String(group.daily_budget).replace('.', ',') : '')
  const [type, setType] = useState<GroupType>(group?.campaign_type ?? 'auto')
  const [period, setPeriod] = useState<'always' | 'period'>(group?.ends_on || group?.starts_on ? 'period' : 'always')
  const [startsOn, setStartsOn] = useState(group?.starts_on ?? '')
  const [endsOn, setEndsOn] = useState(group?.ends_on ?? '')
  const [overlap, setOverlap] = useState<Overlap>(null)
  const [declareEu, setDeclareEu] = useState(false)
  const [busy, setBusy] = useState<'save' | 'launch' | null>(null)
  const [error, setError] = useState<{ text: string; details?: string[] } | null>(null)

  const budget = parseAmount(budgetText)
  const others = groups.filter(g => g.group.id !== group?.id)
  const nextPosition = Math.max(0, ...groups.map(g => g.group.position)) + 1

  const priceText = (r: GroupRules) => {
    const money = (n: number) => fmt.format(n)
    if (r.price_min !== null && r.price_max !== null) return t('campaigns.g_price_between', { min: money(r.price_min), max: money(r.price_max) })
    if (r.price_min !== null) return t('campaigns.g_price_from', { min: money(r.price_min) })
    return t('campaigns.g_price_to', { max: money(r.price_max ?? 0) })
  }
  const suggestedName = (r: GroupRules) => {
    const parts: string[] = []
    if (r.categories.length) parts.push(short(r.categories))
    if (r.brands.length) parts.push(short(r.brands))
    if (r.price_min !== null || r.price_max !== null) parts.push(priceText(r))
    if (r.on_sale) parts.push(t('campaigns.g_name_sale'))
    return (parts.length ? parts.join(' · ') : t('campaigns.g_name_manual')).slice(0, 80)
  }
  const shownName = nameTouched ? name : suggestedName(rules)

  // ── Planul grupei, pe loc ─────────────────────────────────────────────────
  const draft: ProductGroup = {
    id: group?.id ?? NEW_ID,
    name: shownName,
    rules,
    goal,
    daily_budget: typeof budget === 'number' ? budget : null,
    campaign_type: type,
    starts_on: period === 'period' && startsOn ? startsOn : null,
    ends_on: period === 'period' && endsOn ? endsOn : null,
    position: group?.position ?? nextPosition,
    status: group?.status ?? 'draft',
    launched_at: group?.launched_at ?? null,
  }
  // Ieftin și la mii de produse (câteva grupe): se socotește la fiecare schimbare. O grupă încheiată
  // se vede ca la relansare: o ciornă care ia ce au lăsat celelalte
  const assigned = draft.status === 'ended'
    ? assignedAsDraft(plan.offers, others.map(g => g.group).filter(g => g.status !== 'ended'), draft)
    : assignGroups(plan.offers, [...others.map(g => g.group), draft])
  const liveBudgets = campaigns.filter(c => c.status === 'active').map(c => ({ group_id: c.group_id, daily_budget: c.daily_budget ?? 0 }))
  const drafts = others.filter(g => g.group.status === 'draft').map(g => ({ id: g.group.id, daily: g.budget.daily }))
  const preview = buildGroupPlan(draft, {
    plan,
    assigned,
    otherConversions: others.filter(g => g.group.status !== 'ended').reduce((s, g) => s + g.conversions30, 0),
    otherBudgets: otherBudgetsFor(draft.id, liveBudgets, drafts),
    today,
  })
  const noValue = !!audit?.result?.checks.some(c => c.id === 'purchase_no_value')
  const account = accountBlockers(plan, preview.type, noValue)
  const ownerName = new Map(others.map(g => [g.group.id, g.group.name]))

  // ── Ce poate face omul la fiecare pas ─────────────────────────────────────
  const step1Ok = !isEmptyRules(rules) && preview.counts.included > 0
  const periodOk = period === 'always' || (!!endsOn && endsOn >= today && (!startsOn || startsOn <= endsOn))
  const step2Ok = shownName.trim().length > 0 && budget !== 'invalid' && periodOk
  const auditResult = audit?.result ?? null
  const ready = step1Ok && step2Ok && !account.length && !preview.blockers.length && !!auditResult && choicesDone(auditResult, overlap, declareEu)
  // De ce nu se poate lansa încă, lângă buton
  const waiting = ready || !step1Ok || !step2Ok ? null
    : account.length || preview.blockers.length || !auditResult ? 'campaigns.g_fix_first' : 'campaigns.g_choose_first'

  function toggleFilter(f: Filter) {
    const next = new Set(active)
    if (next.has(f)) {
      next.delete(f)
      setRules(r => ({
        ...r,
        ...(f === 'categories' ? { categories: [] } : f === 'brands' ? { brands: [] } : f === 'price' ? { price_min: null, price_max: null } : f === 'sale' ? { on_sale: false } : { include: [] }),
      }))
    } else {
      next.add(f)
      if (f === 'sale') setRules(r => ({ ...r, on_sale: true }))
    }
    setActive(next)
  }

  /** Bifează sau scoate un produs din grupă (adăugat de mână, sau scos din ce prind filtrele). */
  function toggleOffer(o: PlanOffer, inGroup: boolean) {
    setRules(r => {
      const include = new Set(r.include)
      const exclude = new Set(r.exclude)
      if (inGroup) {
        if (include.has(o.offer_id)) include.delete(o.offer_id)
        else exclude.add(o.offer_id)
      } else if (exclude.has(o.offer_id)) exclude.delete(o.offer_id)
      else include.add(o.offer_id)
      return { ...r, include: [...include], exclude: [...exclude] }
    })
    if (!inGroup) setActive(a => new Set(a).add('manual'))
  }

  // ── Salvarea și lansarea ──────────────────────────────────────────────────
  function payload(): Record<string, unknown> {
    const all: Record<string, unknown> = {
      name: shownName.trim(), rules, goal, daily_budget: draft.daily_budget, campaign_type: type, starts_on: draft.starts_on, ends_on: draft.ends_on,
    }
    if (!group) return all
    // La o grupă existentă, doar ce s-a schimbat: pe una lansată, fiecare câmp ajunge în Google Ads
    const changed: Record<string, unknown> = {}
    if (all.name !== group.name) changed.name = all.name
    if (!sameRules(rules, group.rules)) changed.rules = rules
    if (goal !== group.goal) changed.goal = goal
    if (draft.daily_budget !== group.daily_budget) changed.daily_budget = draft.daily_budget
    if (type !== group.campaign_type) changed.campaign_type = type
    if (draft.starts_on !== group.starts_on) changed.starts_on = draft.starts_on
    if (draft.ends_on !== group.ends_on) changed.ends_on = draft.ends_on
    return changed
  }

  async function save(): Promise<string | null> {
    const body = payload()
    if (group && !Object.keys(body).length) return group.id
    const r = await fetch(group ? `/api/campaigns/groups/${group.id}` : '/api/campaigns/groups', {
      method: group ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const res = await r.json().catch(() => ({}))
    if (!r.ok) {
      setError({ text: res.error || t('campaigns.save_error') })
      return null
    }
    if (Array.isArray(res.warnings) && res.warnings.length) setError({ text: res.warnings.join(' ') })
    return (res.group?.id as string | undefined) ?? group?.id ?? null
  }

  async function onSave() {
    setBusy('save')
    setError(null)
    try {
      const id = await save()
      if (id) {
        await onSaved()
        onOpenChange(false)
      }
    } catch {
      setError({ text: t('campaigns.save_error') })
    } finally {
      setBusy(null)
    }
  }

  async function onLaunch() {
    setBusy('launch')
    setError(null)
    try {
      const id = await save()
      if (!id) return
      const r = await fetch('/api/campaigns/launch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: id, overlap, declare_eu: declareEu }),
      })
      const res = await r.json().catch(() => ({}))
      if (!r.ok) {
        const details = (res.details as { code: string | null; path: string | null; message: string }[] | undefined ?? [])
          .map(d => [d.code, d.path, d.message].filter(Boolean).join(' · '))
        setError({ text: res.error || t('campaigns.launch_failed'), details })
        await onSaved()
        return
      }
      onLaunched([t('campaigns.g_launched', { name: shownName }), ...(res.warnings ?? [])].join(' '))
      await onSaved()
      onOpenChange(false)
    } catch {
      setError({ text: t('campaigns.launch_failed') })
    } finally {
      setBusy(null)
    }
  }

  const title = group ? t(live ? 'campaigns.g_edit_live_title' : 'campaigns.g_edit_title') : t('campaigns.g_new_title')
  const steps: { id: Step; label: string }[] = [
    { id: 1, label: t('campaigns.g_step_products') },
    { id: 2, label: t('campaigns.g_step_settings') },
    { id: 3, label: t(live ? 'campaigns.g_step_review' : 'campaigns.g_step_launch') },
  ]
  const canGo = (s: Step) => s === 1 || (s === 2 && step1Ok) || (s === 3 && step1Ok && step2Ok)

  return (
    <>
      {/* Antetul */}
      <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-5 pt-5 pb-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white"><Sparkles className="h-4 w-4" /></span>
            <DialogPrimitive.Title className="text-[16px] font-semibold text-neutral-900 tracking-tight truncate">{title}</DialogPrimitive.Title>
          </div>
          <p className="mt-1.5 text-[12px] text-neutral-500 leading-relaxed">{t('campaigns.g_subtitle')}</p>
        </div>
        <DialogPrimitive.Close className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label={t('campaigns.dismiss')}>
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </div>

      {/* Pașii */}
      <nav className="flex items-center gap-1.5 border-b border-neutral-100 px-5 py-3 sm:px-6" aria-label={t('campaigns.g_steps')}>
        {steps.map((s, i) => {
          const done = s.id < step
          const current = s.id === step
          return (
            <div key={s.id} className="flex items-center gap-1.5">
              {i > 0 && <span className="h-px w-4 bg-neutral-200 sm:w-8" />}
              <button onClick={() => canGo(s.id) && setStep(s.id)} disabled={!canGo(s.id)} aria-current={current ? 'step' : undefined}
                className={`inline-flex items-center gap-1.5 h-7 pl-1 pr-2.5 rounded-full text-[12px] font-medium transition-all disabled:cursor-not-allowed ${current ? 'bg-neutral-900 text-white' : done ? 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200' : 'text-neutral-400'}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${current ? 'bg-white/20' : done ? 'bg-emerald-500 text-white' : 'border border-neutral-200'}`}>
                  {done ? <Check className="h-3 w-3" /> : s.id}
                </span>
                {s.label}
              </button>
            </div>
          )
        })}
      </nav>

      {/* Conținutul pasului */}
      <div ref={body} className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        {step === 1 && (
          <ProductsStep plan={plan} rules={rules} setRules={setRules} active={active} toggleFilter={toggleFilter}
            assigned={assigned} groupId={draft.id} ownerName={ownerName} preview={preview} toggleOffer={toggleOffer}
            fmt={fmt} fmtNum={fmtNum} fmtInt={fmtInt} currency={currency} />
        )}
        {step === 2 && (
          <div className="space-y-6">
            <Field label={t('campaigns.g_name')} hint={nameTouched ? undefined : t('campaigns.g_name_hint')}>
              <input value={shownName} maxLength={80} onChange={e => { setName(e.target.value); setNameTouched(true) }}
                className="w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-[13px] text-neutral-900 focus:outline-none focus:border-neutral-400" />
            </Field>

            <Field label={t('campaigns.goal_title')} hint={t('campaigns.g_goal_hint')}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {GOALS.map(g => {
                  const on = goal === g
                  return (
                    <button key={g} onClick={() => setGoal(g)} aria-pressed={on}
                      className={`text-left p-3 rounded-xl border transition-all ${on ? 'border-neutral-900 ring-1 ring-neutral-900' : 'border-neutral-200 hover:border-neutral-300'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-semibold text-neutral-900">{t(`campaigns.goal_${g}`)}</p>
                        {on && <CheckCircle2 className="h-4 w-4 text-neutral-900" />}
                      </div>
                      <p className="mt-1 text-[11px] text-neutral-500 leading-snug">{t(`campaigns.goal_${g}_desc`, { keep: String(Math.round(GOAL_KEEP[g] * 100)) })}</p>
                      <p className="mt-2 text-[12px] font-medium text-neutral-800 tabular-nums">
                        {preview.economics.targets[g] !== null ? t('campaigns.goal_roas', { roas: fmtNum.format(preview.economics.targets[g]!) }) : t('campaigns.goal_roas_unknown')}
                      </p>
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label={t('campaigns.row_budget')}>
              <div className="flex items-center gap-3">
                <div className="relative w-40">
                  <input value={budgetText} inputMode="decimal" aria-label={t('campaigns.row_budget')}
                    placeholder={preview.budget.suggested === null ? '' : String(preview.budget.suggested)}
                    onChange={e => setBudgetText(e.target.value)}
                    className={`w-full h-10 pl-3 pr-12 rounded-xl border bg-white text-[13px] font-medium tabular-nums placeholder:text-neutral-300 focus:outline-none ${budget === 'invalid' ? 'border-red-300' : 'border-neutral-200 focus:border-neutral-400'}`} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 pointer-events-none">{currency}</span>
                </div>
                {budget === 'invalid' && <span className="text-[11px] text-red-500">{t('campaigns.budget_invalid')}</span>}
                {budgetText && preview.budget.suggested !== null && budget !== preview.budget.suggested && (
                  <button onClick={() => setBudgetText('')} className="text-[11px] font-medium text-neutral-600 underline underline-offset-2 hover:text-neutral-900">
                    {t('campaigns.budget_use_suggested', { budget: fmt.format(preview.budget.suggested) })}
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-neutral-500 leading-relaxed">
                {preview.budget.suggested !== null && preview.economics.aov !== null && preview.economics.target !== null
                  ? t('campaigns.g_budget_hint', {
                    conversions: fmtInt.format(Math.min(30, Math.max(10, Math.round(preview.conversions30 * 1.25)))),
                    aov: fmt.format(preview.economics.aov), roas: fmtNum.format(preview.economics.target), budget: fmt.format(preview.budget.suggested),
                  })
                  : t('campaigns.budget_hint_no_target')}
              </p>
            </Field>

            <Field label={t('campaigns.g_type')} hint={live ? t('campaigns.g_type_locked') : undefined}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {TYPES.map(k => {
                  const on = type === k
                  return (
                    <button key={k} onClick={() => setType(k)} disabled={live} aria-pressed={on}
                      className={`text-left p-3 rounded-xl border transition-all disabled:cursor-not-allowed disabled:opacity-60 ${on ? 'border-neutral-900 ring-1 ring-neutral-900' : 'border-neutral-200 hover:border-neutral-300'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-semibold text-neutral-900">{t(`campaigns.g_type_${k}`)}</p>
                        {k === 'auto' ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-neutral-100 text-neutral-500">{t('campaigns.recommended')}</span>
                          : on && <CheckCircle2 className="h-4 w-4 text-neutral-900" />}
                      </div>
                      <p className="mt-1 text-[11px] text-neutral-500 leading-snug">
                        {k === 'auto'
                          ? t(preview.auto_type === 'shopping' ? 'campaigns.g_type_auto_shopping' : 'campaigns.g_type_auto_pmax', { conversions: fmtNum.format(preview.conversions30) })
                          : t(`campaigns.g_type_${k}_desc`)}
                      </p>
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label={t('campaigns.g_period')} hint={t('campaigns.g_period_hint')}>
              <div className="flex flex-wrap gap-2">
                {(['always', 'period'] as const).map(p => (
                  <button key={p} onClick={() => setPeriod(p)} aria-pressed={period === p} disabled={live && p === 'always' && !!group?.starts_on}
                    className={`h-9 px-3.5 rounded-xl border text-[12px] font-medium transition-all ${period === p ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-700 hover:border-neutral-300'}`}>
                    {t(`campaigns.g_period_${p}`)}
                  </button>
                ))}
              </div>
              {period === 'period' && (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-sm">
                  <label className="text-[11px] text-neutral-500">
                    {t('campaigns.g_starts_on')}
                    <input type="date" value={startsOn} min={today} disabled={live} onChange={e => setStartsOn(e.target.value)}
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-[13px] text-neutral-900 focus:outline-none focus:border-neutral-400 disabled:opacity-60" />
                  </label>
                  <label className="text-[11px] text-neutral-500">
                    {t('campaigns.g_ends_on')}
                    <input type="date" value={endsOn} min={startsOn || today} onChange={e => setEndsOn(e.target.value)}
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-[13px] text-neutral-900 focus:outline-none focus:border-neutral-400" />
                  </label>
                </div>
              )}
              {!periodOk && <p className="mt-1.5 text-[11px] text-red-500">{t(endsOn ? 'campaigns.group_period_invalid' : 'campaigns.g_period_need_end')}</p>}
            </Field>
          </div>
        )}
        {step === 3 && (
          <ReviewStep plan={plan} preview={preview} name={shownName} account={account} audit={audit} live={live}
            overlap={overlap} setOverlap={setOverlap} declareEu={declareEu} setDeclareEu={setDeclareEu}
            fmt={fmt} fmt2={fmt2} fmtNum={fmtNum} fmtInt={fmtInt} priceText={priceText} />
        )}
      </div>

      {/* Mesajul și butoanele */}
      <div className="border-t border-neutral-100 bg-neutral-50/60 px-5 py-4 sm:px-6">
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-px" />
            <div>
              <p>{error.text}</p>
              {error.details?.map(d => <p key={d} className="mt-1 font-mono text-[11px] opacity-80 break-all">{d}</p>)}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <div>
            {step > 1 && (
              <button onClick={() => setStep((step - 1) as Step)} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-[13px] font-medium text-neutral-600 hover:bg-neutral-100">
                <ArrowLeft className="h-4 w-4" />{t('campaigns.g_back')}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step < 3 ? (
              <>
                {step === 1 && !step1Ok && <span className="hidden text-[11px] text-neutral-400 sm:inline">{t(isEmptyRules(rules) ? 'campaigns.g_pick_products' : 'campaigns.g_no_products')}</span>}
                <button onClick={() => setStep((step + 1) as Step)} disabled={!(step === 1 ? step1Ok : step2Ok)}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-neutral-900 text-white text-[13px] font-medium hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed">
                  {t('campaigns.g_next')}<ArrowRight className="h-4 w-4" />
                </button>
              </>
            ) : live ? (
              <button onClick={onSave} disabled={!!busy || !step2Ok}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-neutral-900 text-white text-[13px] font-medium hover:bg-neutral-800 disabled:opacity-40">
                {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{t('campaigns.g_save_live')}
              </button>
            ) : (
              <>
                {waiting && <span className="hidden max-w-[180px] text-right text-[11px] leading-tight text-neutral-400 md:inline">{t(waiting)}</span>}
                <button onClick={onSave} disabled={!!busy || !step1Ok || !step2Ok}
                  className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-neutral-200 bg-white text-[13px] font-medium text-neutral-700 hover:border-neutral-300 disabled:opacity-40">
                  {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}{t('campaigns.g_save_draft')}
                </button>
                <button onClick={onLaunch} disabled={!!busy || !ready}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-neutral-900 text-white text-[13px] font-medium hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed">
                  {busy === 'launch' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  {t(group?.status === 'ended' ? 'campaigns.g_relaunch' : 'campaigns.g_launch')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-neutral-900">{label}</p>
      {hint && <p className="mt-0.5 text-[11px] text-neutral-500 leading-relaxed">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </div>
  )
}

// ─── Pasul 1: produsele ──────────────────────────────────────────────────────

type ProductsProps = {
  plan: Plan
  rules: GroupRules
  setRules: (fn: (r: GroupRules) => GroupRules) => void
  active: Set<Filter>
  toggleFilter: (f: Filter) => void
  assigned: Map<string, string>
  groupId: string
  ownerName: Map<string, string>
  preview: GroupPlan
  toggleOffer: (o: PlanOffer, inGroup: boolean) => void
  fmt: Intl.NumberFormat
  fmtNum: Intl.NumberFormat
  fmtInt: Intl.NumberFormat
  currency: string
}

function ProductsStep({ plan, rules, setRules, active, toggleFilter, assigned, groupId, ownerName, preview, toggleOffer, fmt, fmtNum, fmtInt, currency }: ProductsProps) {
  const { t } = useT()
  const [scope, setScope] = useState<'group' | 'all'>('group')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const categories = useMemo(() => facetOf(plan.offers, 'category'), [plan.offers])
  const brands = useMemo(() => facetOf(plan.offers, 'brand'), [plan.offers])
  const prices = plan.offers.map(o => o.price).filter(p => p > 0)
  const onSale = plan.offers.filter(o => o.on_sale).length

  // Fără filtre (doar produse alese de mână) lista arată tot catalogul
  const shownScope = active.size === 0 || (active.size === 1 && active.has('manual') && !rules.include.length) ? 'all' : scope
  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return plan.offers.filter(o => (shownScope === 'all' || assigned.get(o.offer_id) === groupId)
      && (!q || o.title.toLowerCase().includes(q) || (o.variant_title ?? '').toLowerCase().includes(q) || (o.category ?? '').toLowerCase().includes(q) || (o.brand ?? '').toLowerCase().includes(q)))
  }, [plan.offers, shownScope, assigned, groupId, search])
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE))
  const current = Math.min(page, pages)
  const visible = list.slice((current - 1) * PER_PAGE, current * PER_PAGE)

  const pick = (key: 'categories' | 'brands', value: string) => setRules(r => {
    const set = new Set(r[key])
    if (set.has(value)) set.delete(value)
    else set.add(value)
    return { ...r, [key]: [...set] }
  })
  const setPrice = (key: 'price_min' | 'price_max', text: string) => {
    const v = parseAmount(text)
    setRules(r => ({ ...r, [key]: v === 'invalid' ? r[key] : v }))
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[13px] font-semibold text-neutral-900">{t('campaigns.g_start_from')}</p>
        <p className="mt-0.5 text-[11px] text-neutral-500 leading-relaxed">{t('campaigns.g_start_hint')}</p>
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {FILTERS.map(({ id, icon: Icon }) => {
            const on = active.has(id)
            const disabled = (id === 'categories' && !categories.length) || (id === 'brands' && !brands.length) || (id === 'sale' && !onSale)
            return (
              <button key={id} onClick={() => toggleFilter(id)} disabled={disabled} aria-pressed={on}
                className={`group relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 ${on ? 'border-neutral-900 bg-neutral-900 text-white shadow-sm' : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm'}`}>
                <Icon className={`h-4 w-4 ${on ? 'text-white' : 'text-neutral-500'}`} />
                <span className="text-[12px] font-semibold leading-tight">{t(`campaigns.g_filter_${id}`)}</span>
                {on && <Check className="absolute right-2.5 top-2.5 h-3.5 w-3.5" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Filtrele alese */}
      {active.has('categories') && (
        <FilterBox title={t('campaigns.g_filter_categories')} hint={t('campaigns.g_categories_hint')}>
          <Chips items={categories} picked={rules.categories} onPick={v => pick('categories', v)} fmtInt={fmtInt} />
        </FilterBox>
      )}
      {active.has('brands') && (
        <FilterBox title={t('campaigns.g_filter_brands')} hint={t('campaigns.g_brands_hint')}>
          <Chips items={brands} picked={rules.brands} onPick={v => pick('brands', v)} fmtInt={fmtInt} />
        </FilterBox>
      )}
      {active.has('price') && (
        <FilterBox title={t('campaigns.g_filter_price')}
          hint={prices.length ? t('campaigns.g_price_hint', { min: fmt.format(Math.min(...prices)), max: fmt.format(Math.max(...prices)) }) : undefined}>
          <div className="flex items-center gap-2">
            {(['price_min', 'price_max'] as const).map((k, i) => (
              <div key={k} className="flex items-center gap-2">
                {i === 1 && <span className="text-neutral-300">—</span>}
                <div className="relative w-32">
                  <input defaultValue={rules[k] === null ? '' : String(rules[k]).replace('.', ',')} inputMode="decimal"
                    placeholder={t(k === 'price_min' ? 'campaigns.g_price_min' : 'campaigns.g_price_max')} aria-label={t(k === 'price_min' ? 'campaigns.g_price_min' : 'campaigns.g_price_max')}
                    onChange={e => setPrice(k, e.target.value)}
                    className="w-full h-9 pl-3 pr-11 rounded-xl border border-neutral-200 bg-white text-[13px] tabular-nums placeholder:text-neutral-300 focus:outline-none focus:border-neutral-400" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 pointer-events-none">{currency}</span>
                </div>
              </div>
            ))}
          </div>
        </FilterBox>
      )}
      {active.has('sale') && (
        <FilterBox title={t('campaigns.g_filter_sale')} hint={t('campaigns.g_sale_hint', { count: onSale })}>{null}</FilterBox>
      )}
      {active.has('manual') && (
        <FilterBox title={t('campaigns.g_filter_manual')} hint={t('campaigns.g_manual_hint', { count: rules.include.length })}>{null}</FilterBox>
      )}

      {/* Ce prinde grupa acum */}
      <div className="rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-neutral-100 bg-gradient-to-b from-neutral-50 to-white p-4">
          <div className="grid grid-cols-3 gap-2">
            <Stat label={t('campaigns.g_stat_products')} value={fmtInt.format(preview.counts.included)} />
            <Stat label={t('campaigns.g_stat_conversions')} value={fmtNum.format(preview.conversions30)} sub={t(`campaigns.g_basis_${preview.basis}`)} />
            <Stat label={t('campaigns.econ_break_even')} value={preview.economics.break_even !== null ? fmtNum.format(preview.economics.break_even) : '—'} />
          </div>
          {preview.counts.elsewhere > 0 && (
            <p className="flex items-start gap-1.5 text-[11px] text-amber-700"><Info className="h-3.5 w-3.5 shrink-0 mt-px" />{t('campaigns.g_warn_in_other_group', { count: preview.counts.elsewhere })}</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 rounded-xl bg-neutral-100 p-1 self-start">
              {(['group', 'all'] as const).map(k => (
                <button key={k} onClick={() => { setScope(k); setPage(1) }} disabled={shownScope === 'all' && k === 'group'}
                  className={`h-7 px-2.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-40 ${shownScope === k ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}>
                  {t(`campaigns.g_scope_${k}`, { count: fmtInt.format(k === 'group' ? preview.counts.members : plan.offers.length) })}
                </button>
              ))}
            </div>
            <div className="relative sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-300 pointer-events-none" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={t('campaigns.search_placeholder')}
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-white border border-neutral-200 text-[12px] text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:border-neutral-300" />
            </div>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="py-10 text-center text-[12px] text-neutral-400">{search ? t('catalog.no_results') : t('campaigns.g_list_empty')}</p>
        ) : (
          <ul className="divide-y divide-neutral-50">
            {visible.map(o => {
              const owner = assigned.get(o.offer_id)
              const inGroup = owner === groupId
              const elsewhere = !!owner && !inGroup
              const blocked = !canRun(o)
              return (
                <li key={o.offer_id} className={`flex items-center gap-3 px-4 py-2.5 ${inGroup ? '' : 'bg-neutral-50/40'}`}>
                  <button onClick={() => toggleOffer(o, inGroup)} disabled={elsewhere} aria-pressed={inGroup}
                    title={elsewhere ? t('campaigns.g_in_other', { name: ownerName.get(owner!) ?? '' }) : undefined}
                    aria-label={t(inGroup ? 'campaigns.g_remove_product' : 'campaigns.g_add_product')}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all disabled:cursor-not-allowed disabled:opacity-40 ${inGroup ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white hover:border-neutral-500'}`}>
                    {inGroup && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50 flex items-center justify-center">
                    {o.image_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={o.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                      : <ImageIcon className="h-4 w-4 text-neutral-300" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[12px] font-medium leading-snug line-clamp-1 ${inGroup ? 'text-neutral-900' : 'text-neutral-600'}`}>
                      {o.title}{o.variant_title ? <span className="text-neutral-400"> · {o.variant_title}</span> : null}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-400">
                      {[o.category, o.brand].filter(Boolean).join(' · ')}
                      {o.on_sale && <span className="rounded bg-rose-50 px-1 py-px font-medium text-rose-600">{t('campaigns.g_on_sale')}</span>}
                      {elsewhere && <span className="rounded bg-neutral-100 px-1 py-px font-medium text-neutral-600">{t('campaigns.g_in_other', { name: ownerName.get(owner!) ?? '' })}</span>}
                      {blocked && o.reason && <span className="rounded bg-amber-50 px-1 py-px font-medium text-amber-700">{t.has(`campaigns.reason_${o.reason}`) ? t(`campaigns.reason_${o.reason}`) : t('campaigns.reason_generic')}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[12px] font-medium text-neutral-900 tabular-nums">{fmt.format(o.price)}</p>
                    <p className="text-[10px] text-neutral-400 tabular-nums">
                      {o.units > 0 ? t('catalog.units', { count: Number(o.units) }) : '—'}
                      {o.margin !== null ? ` · ${Math.round(o.margin * 100)}%` : ''}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-neutral-100 px-4 py-2.5 text-[11px] text-neutral-500">
            <span>{t('catalog.page_of', { from: fmtInt.format((current - 1) * PER_PAGE + 1), to: fmtInt.format(Math.min(current * PER_PAGE, list.length)), total: fmtInt.format(list.length) })}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={current === 1} className="h-7 w-7 flex items-center justify-center rounded-md border border-neutral-200 hover:bg-neutral-50 disabled:opacity-40" aria-label={t('catalog.prev')}><ArrowLeft className="h-3.5 w-3.5" /></button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={current === pages} className="h-7 w-7 flex items-center justify-center rounded-md border border-neutral-200 hover:bg-neutral-50 disabled:opacity-40" aria-label={t('catalog.next')}><ArrowRight className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FilterBox({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3.5">
      <p className="text-[12px] font-semibold text-neutral-900">{title}</p>
      {hint && <p className="mt-0.5 text-[11px] text-neutral-500 leading-relaxed">{hint}</p>}
      {children && <div className="mt-2.5">{children}</div>}
    </div>
  )
}

function Chips({ items, picked, onPick, fmtInt }: { items: [string, number][]; picked: string[]; onPick: (v: string) => void; fmtInt: Intl.NumberFormat }) {
  const { t } = useT()
  const [q, setQ] = useState('')
  const set = new Set(picked.map(p => p.toLocaleLowerCase('ro')))
  const shown = items.filter(([v]) => !q || v.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <div>
      {items.length > 12 && (
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('campaigns.g_filter_search')}
          className="mb-2 w-full h-8 px-3 rounded-lg border border-neutral-200 bg-white text-[12px] placeholder:text-neutral-300 focus:outline-none focus:border-neutral-300" />
      )}
      <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
        {shown.map(([v, n]) => {
          const on = set.has(v.toLocaleLowerCase('ro'))
          return (
            <button key={v} onClick={() => onPick(v)} aria-pressed={on}
              className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-medium transition-all ${on ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'}`}>
              {on && <Check className="h-3 w-3" />}{v}<span className={on ? 'text-white/60' : 'text-neutral-400'}>{fmtInt.format(n)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-100">
      <p className="text-[10px] text-neutral-400">{label}</p>
      <p className="text-[16px] font-bold text-neutral-900 tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-neutral-400 leading-tight">{sub}</p>}
    </div>
  )
}

// ─── Pasul 3: rezumatul și lansarea ───────────────────────────────────────────

type ReviewProps = {
  plan: Plan
  preview: GroupPlan
  name: string
  account: Plan['blockers']
  audit: AuditData | null
  live: boolean
  overlap: Overlap
  setOverlap: (v: 'pause' | 'keep') => void
  declareEu: boolean
  setDeclareEu: (v: boolean) => void
  fmt: Intl.NumberFormat
  fmt2: Intl.NumberFormat
  fmtNum: Intl.NumberFormat
  fmtInt: Intl.NumberFormat
  priceText: (r: GroupRules) => string
}

function ReviewStep({ plan, preview: p, name, account, audit, live, overlap, setOverlap, declareEu, setDeclareEu, fmt, fmt2, fmtNum, fmtInt, priceText }: ReviewProps) {
  const { t, intlLocale } = useT()
  const g = p.group
  const dateFmt = new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' })
  const day = (d: string) => dateFmt.format(new Date(`${d}T12:00:00`))
  const rules = [
    g.rules.categories.length ? t('campaigns.rule_categories', { list: short(g.rules.categories) }) : null,
    g.rules.brands.length ? t('campaigns.rule_brands', { list: short(g.rules.brands) }) : null,
    g.rules.price_min !== null || g.rules.price_max !== null ? priceText(g.rules) : null,
    g.rules.on_sale ? t('campaigns.rule_sale') : null,
    g.rules.include.length ? t('campaigns.rule_include', { count: g.rules.include.length }) : null,
    g.rules.exclude.length ? t('campaigns.rule_exclude', { count: g.rules.exclude.length }) : null,
  ].filter((x): x is string => !!x)

  const rows: { label: string; value: ReactNode; hint?: string }[] = [
    { label: t('campaigns.row_products'), value: t('campaigns.g_products_value', { count: p.counts.included }), hint: rules.join(' · ') },
    {
      label: t('campaigns.row_type'),
      value: t(p.type === 'shopping' ? 'campaigns.type_shopping' : 'campaigns.type_pmax'),
      hint: g.campaign_type === 'auto' ? t(p.type === 'shopping' ? 'campaigns.g_type_auto_shopping' : 'campaigns.g_type_auto_pmax', { conversions: fmtNum.format(p.conversions30) }) : undefined,
    },
    p.type === 'shopping' ? {
      label: t('campaigns.row_bidding'),
      value: p.cpc_ceiling !== null ? t('campaigns.bidding_cpc', { cpc: fmt2.format(p.cpc_ceiling) }) : t('campaigns.bidding_cpc_unknown'),
      hint: p.cpc_ceiling !== null && p.economics.aov !== null && p.economics.break_even !== null
        ? `${t('campaigns.bidding_cpc_hint', { aov: fmt.format(p.economics.aov), roas: fmtNum.format(p.economics.break_even) })}${p.cpc_ceiling_low ? ` ${t('campaigns.bidding_cpc_low')}` : ''}`
        : undefined,
    } : {
      label: t('campaigns.row_bidding'),
      value: p.start_target !== null ? t('campaigns.bidding_target', { roas: fmtNum.format(p.start_target) }) : t('campaigns.g_bidding_no_target'),
      hint: p.start_target !== null && p.economics.target !== null && p.economics.break_even !== null
        ? t('campaigns.bidding_start_hint', { goal: fmtNum.format(p.economics.target), break_even: fmtNum.format(p.economics.break_even) })
        : t('campaigns.g_bidding_no_target_hint'),
    },
    { label: t('campaigns.row_budget'), value: p.budget.daily !== null ? t('campaigns.g_budget_value', { budget: fmt.format(p.budget.daily) }) : '—' },
    {
      label: t('campaigns.g_period'),
      value: g.ends_on ? t(g.starts_on ? 'campaigns.g_period_between' : 'campaigns.g_period_until', { start: g.starts_on ? day(g.starts_on) : '', end: day(g.ends_on) }) : t('campaigns.g_period_always'),
    },
    { label: t('campaigns.goal_title'), value: t(`campaigns.goal_${g.goal}`) },
    {
      label: t('campaigns.row_safety'),
      value: p.loss_limit ? t('campaigns.safety_value', { none: fmt.format(p.loss_limit.no_conversions), low: fmt.format(p.loss_limit.low_roas) }) : t('campaigns.safety_unknown'),
    },
  ]

  return (
    <div className="space-y-5">
      {/* Cartea de vizită a campaniei */}
      <div className="relative overflow-hidden rounded-2xl bg-neutral-900 p-5 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -right-2 bottom-0 h-24 w-24 rounded-full bg-white/5" />
        <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">{t(live ? 'campaigns.g_review_live' : 'campaigns.g_review_ready')}</p>
        <p className="mt-1 text-[18px] font-semibold tracking-tight">{name}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: t('campaigns.econ_break_even'), value: p.economics.break_even !== null ? fmtNum.format(p.economics.break_even) : '—' },
            { label: t('campaigns.econ_target'), value: p.economics.target !== null ? fmtNum.format(p.economics.target) : '—' },
            { label: t('campaigns.econ_aov'), value: p.economics.aov !== null ? fmt.format(p.economics.aov) : '—' },
            { label: t('campaigns.g_stat_conversions'), value: fmtNum.format(p.conversions30) },
          ].map(k => (
            <div key={k.label}>
              <p className="text-[10px] text-white/50">{k.label}</p>
              <p className="text-[17px] font-bold tabular-nums">{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      <dl className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 px-4">
        {rows.map(r => (
          <div key={r.label} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="text-[12px] text-neutral-400">{r.label}</dt>
            <dd className="sm:col-span-2">
              <div className="text-[13px] text-neutral-900">{r.value}</div>
              {r.hint && <p className="mt-0.5 text-[11px] text-neutral-400 leading-relaxed">{r.hint}</p>}
            </dd>
          </div>
        ))}
      </dl>

      {p.forecast && (
        <div className="rounded-2xl border border-neutral-200 p-4">
          <p className="text-[12px] font-semibold text-neutral-900">{t('campaigns.forecast_title')}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: t('campaigns.forecast_spend'), value: fmt.format(p.forecast.spend) },
              { label: t('campaigns.forecast_revenue'), value: fmt.format(p.forecast.revenue) },
              { label: t('campaigns.forecast_orders'), value: p.forecast.orders !== null ? `~${fmtInt.format(p.forecast.orders)}` : '—' },
              { label: t('campaigns.forecast_profit'), value: fmt.format(p.forecast.profit), strong: true },
            ].map(k => (
              <div key={k.label}>
                <p className="text-[10px] text-neutral-400">{k.label}</p>
                <p className={`text-[15px] font-semibold tabular-nums ${k.strong ? 'text-emerald-600' : 'text-neutral-900'}`}>{k.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-neutral-400 leading-relaxed">{t('campaigns.forecast_note')}</p>
        </div>
      )}

      {/* Ce oprește lansarea și ce trebuie știut */}
      {(account.length > 0 || p.blockers.length > 0 || p.warnings.length > 0) && (
        <div className="space-y-1.5">
          {account.map(b => {
            const params = Object.fromEntries(Object.entries(b.params ?? {}).map(([k, v]) => [k, String(v)]))
            const step = `${b.id}${b.variant ? `_${b.variant}` : ''}`
            const label = t.has(`campaigns.blocker_${step}`) ? t(`campaigns.blocker_${step}`, params) : t.has(`campaigns.blocker_${b.id}`) ? t(`campaigns.blocker_${b.id}`, params) : t('campaigns.blocker_generic')
            return <Note key={b.id} level="blocker">{label}</Note>
          })}
          {p.blockers.map(b => <Note key={b.id} level="blocker">{t(`campaigns.g_block_${b.id}`, noteParams(b.params, fmt))}</Note>)}
          {p.warnings.map(w => <Note key={w.id} level="warning">{t(`campaigns.g_warn_${w.id}`, noteParams(w.params, fmt))}</Note>)}
        </div>
      )}

      {/* Alegerile din audit (prima lansare în cont, sau dacă omul și-a păstrat campaniile) */}
      {!live && audit?.result && (audit.result.overlap.length > 0 || audit.result.eu_undeclared.length > 0) && (
        <div className="space-y-3 rounded-2xl border border-neutral-200 p-4">
          <p className="flex items-center gap-2 text-[12px] font-semibold text-neutral-900"><ShieldCheck className="h-4 w-4 text-neutral-500" />{t('campaigns.audit_title')}</p>
          <AccountChoices result={audit.result} overlap={overlap} onOverlap={setOverlap} declareEu={declareEu} onDeclareEu={setDeclareEu} />
        </div>
      )}
      {!live && !audit?.result && <Note level="blocker">{t('campaigns.blocker_audit')}</Note>}

      {live && <p className="flex items-start gap-1.5 text-[11px] text-neutral-500 leading-relaxed"><CalendarRange className="h-3.5 w-3.5 shrink-0 mt-px" />{t('campaigns.g_live_note')}</p>}
      {!live && (
        <p className="flex items-start gap-1.5 text-[11px] text-neutral-500 leading-relaxed">
          <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
          {t(plan.counts.included > 0 ? 'campaigns.g_launch_note' : 'campaigns.g_launch_note_alone', { products: fmtInt.format(p.counts.included) })}
        </p>
      )}
    </div>
  )
}

function Note({ level, children }: { level: 'blocker' | 'warning'; children: ReactNode }) {
  const Icon = level === 'blocker' ? AlertCircle : AlertTriangle
  return (
    <p className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] leading-relaxed ${level === 'blocker' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
      <Icon className="h-4 w-4 shrink-0 mt-px" />
      <span>{children}</span>
    </p>
  )
}
