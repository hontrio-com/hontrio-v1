'use client'

import { Fragment, useMemo, useRef, useState, type ReactNode } from 'react'
import { useT } from '@/lib/i18n/context'
import {
  ArrowLeft, ArrowRight, BadgePercent, CalendarRange, Check, ChevronLeft, ChevronRight, Coins, FolderTree, ImageIcon, Info,
  ListChecks, Rocket, Search, ShieldCheck, Sparkles, Tag, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sheet, SheetHeader } from '@/components/app/sheet'
import { Badge } from '@/components/app/badge'
import { Button, linkStyles } from '@/components/app/button'
import { Callout } from '@/components/app/feedback'
import { ChoiceCard, Input } from '@/components/app/input'
import { Segmented } from '@/components/app/tabs'
import { NumberTicker } from '@/components/app/motion'
import type { Plan, PlanOffer } from '@/lib/campaigns/plan'
import {
  accountBlockers, assignedAsDraft, assignGroups, buildGroupPlan, canRun, EMPTY_RULES, GROUP_TYPES, isEmptyRules, otherBudgetsFor,
  type GroupPlan, type GroupRules, type GroupType, type ProductGroup,
} from '@/lib/campaigns/groups'
import type { AuditData } from '@/components/campaigns/types'
import type { LiveCampaign } from '@/components/campaigns/live-campaigns'
import { day, type Formats } from '@/components/app/formats'
import { AccountChoices, choicesDone, type Overlap } from '@/components/campaigns/account-choices'

// =============================================
// Editorul unei campanii pe grupă de produse, în trei pași: ce produse vinde
// (categorie, brand, preț, reduceri, alese de mână, și orice combinație),
// cum rulează (buget, tip, perioadă), apoi rezumatul și lansarea. Alături, rezumatul se schimbă pe loc la fiecare alegere:
// planul grupei se socotește cu aceleași funcții ca pe server
// (lib/campaigns/groups.ts), deci cifrele sunt cele de la lansare.
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

export type Step = 1 | 2 | 3

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Crește la fiecare deschidere: editorul pornește curat, cu grupa lui. */
  session: number
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
  f: Formats
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

export function GroupEditor({ session, ...props }: Props) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange} width={1080}>
      {/* Cheia repornește editorul la fiecare deschidere; conținutul rămâne cât panoul se închide */}
      <EditorBody key={session} {...props} />
    </Sheet>
  )
}

function EditorBody({ group, initialStep = 1, plan, groups, campaigns, audit, today, currency, f, onOpenChange, onSaved, onLaunched }: Omit<Props, 'session'>) {
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
    const money = (n: number) => f.money.format(n)
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

  function toggleFilter(fl: Filter) {
    const next = new Set(active)
    if (next.has(fl)) {
      next.delete(fl)
      setRules(r => ({
        ...r,
        ...(fl === 'categories' ? { categories: [] } : fl === 'brands' ? { brands: [] } : fl === 'price' ? { price_min: null, price_max: null } : fl === 'sale' ? { on_sale: false } : { include: [] }),
      }))
    } else {
      next.add(fl)
      if (fl === 'sale') setRules(r => ({ ...r, on_sale: true }))
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
      name: shownName.trim(), rules, daily_budget: draft.daily_budget, campaign_type: type, starts_on: draft.starts_on, ends_on: draft.ends_on,
    }
    if (!group) return all
    // La o grupă existentă, doar ce s-a schimbat: pe una lansată, fiecare câmp ajunge în Google Ads
    const changed: Record<string, unknown> = {}
    if (all.name !== group.name) changed.name = all.name
    if (!sameRules(rules, group.rules)) changed.rules = rules
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
      await onSaved()
      onLaunched([t('campaigns.g_launched', { name: shownName }), ...(res.warnings ?? [])].join(' '))
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
      <SheetHeader icon={<Sparkles />} title={title} description={t('campaigns.g_subtitle')} onClose={() => onOpenChange(false)}>
        {/* Pașii */}
        <nav className="mt-5 flex items-center gap-2" aria-label={t('campaigns.g_steps')}>
          {steps.map((s, i) => {
            const done = s.id < step
            const current = s.id === step
            return (
              <Fragment key={s.id}>
                {i > 0 && <span className={cn('h-px w-6 sm:w-12', done || current ? 'bg-brand-300' : 'bg-neutral-200')} />}
                <button onClick={() => canGo(s.id) && setStep(s.id)} disabled={!canGo(s.id)} aria-current={current ? 'step' : undefined}
                  className="group flex items-center gap-2 rounded-lg py-1 pr-1 text-[13px] font-medium disabled:cursor-not-allowed">
                  <span className={cn('flex size-6 items-center justify-center rounded-full text-[12px] font-semibold transition-all',
                    current ? 'bg-brand-600 text-white ring-4 ring-brand-100' : done ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'bg-white text-neutral-400 ring-1 ring-neutral-200')}>
                    {done ? <Check className="size-3.5" strokeWidth={3} /> : s.id}
                  </span>
                  <span className={current ? 'text-neutral-900' : done ? 'text-neutral-600 group-hover:text-neutral-900' : 'text-neutral-400'}>{s.label}</span>
                </button>
              </Fragment>
            )
          })}
        </nav>
      </SheetHeader>

      <div className="flex min-h-0 flex-1">
        {/* Conținutul pasului */}
        <div ref={body} className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
          {step === 1 && (
            <ProductsStep plan={plan} rules={rules} setRules={setRules} active={active} toggleFilter={toggleFilter}
              assigned={assigned} groupId={draft.id} ownerName={ownerName} preview={preview} toggleOffer={toggleOffer} f={f} currency={currency} />
          )}
          {step === 2 && (
            <div className="space-y-8">
              <Block title={t('campaigns.g_name')} hint={nameTouched ? undefined : t('campaigns.g_name_hint')}>
                <Input value={shownName} maxLength={80} aria-label={t('campaigns.g_name')} className="h-10 max-w-lg text-[14px]"
                  onChange={e => { setName(e.target.value); setNameTouched(true) }} />
              </Block>

              <Block title={t('campaigns.row_budget')}>
                <div className="flex flex-wrap items-center gap-3">
                  <Input value={budgetText} inputMode="decimal" aria-label={t('campaigns.row_budget')} aria-invalid={budget === 'invalid'} suffix={currency}
                    wrapperClassName="w-44" className="h-10 text-[14px] font-medium tabular-nums"
                    placeholder={preview.budget.suggested === null ? '' : String(preview.budget.suggested)}
                    onChange={e => setBudgetText(e.target.value)} />
                  {budget === 'invalid' && <span className="text-[12px] text-red-600">{t('campaigns.budget_invalid')}</span>}
                  {budgetText && preview.budget.suggested !== null && budget !== preview.budget.suggested && (
                    <button onClick={() => setBudgetText('')} className={cn(linkStyles, 'text-[12px]')}>
                      {t('campaigns.budget_use_suggested', { budget: f.money.format(preview.budget.suggested) })}
                    </button>
                  )}
                </div>
                <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-neutral-500">
                  {preview.budget.suggested !== null && preview.economics.aov !== null
                    ? t('campaigns.g_budget_hint', { aov: f.money.format(preview.economics.aov), budget: f.money.format(preview.budget.suggested) })
                    : t('campaigns.budget_hint_none')}
                </p>
              </Block>

              <Block title={t('campaigns.g_type')} hint={live ? t('campaigns.g_type_locked') : undefined}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {GROUP_TYPES.map(k => (
                    <ChoiceCard key={k} active={type === k} disabled={live} onClick={() => setType(k)} title={t(`campaigns.g_type_${k}`)}
                      aside={k === 'auto' ? <Badge tone="brand">{t('campaigns.recommended')}</Badge> : undefined}
                      description={k === 'auto'
                        ? t(preview.auto_type === 'shopping' ? 'campaigns.g_type_auto_shopping' : 'campaigns.g_type_auto_pmax', { conversions: f.num.format(preview.conversions30) })
                        : t(`campaigns.g_type_${k}_desc`)} />
                  ))}
                </div>
              </Block>

              <Block title={t('campaigns.g_period')} hint={t('campaigns.g_period_hint')}>
                {/* O campanie lansată cu dată de început nu mai poate renunța la perioadă */}
                {live && !!group?.starts_on ? (
                  <Badge><CalendarRange className="size-3" />{t('campaigns.g_period_period')}</Badge>
                ) : (
                  <Segmented id="group-period" value={period} onChange={setPeriod}
                    items={(['always', 'period'] as const).map(p => ({ value: p, label: t(`campaigns.g_period_${p}`) }))} />
                )}
                {period === 'period' && (
                  <div className="mt-4 grid max-w-md grid-cols-2 gap-3">
                    <label className="text-[12px] font-medium text-neutral-600">
                      {t('campaigns.g_starts_on')}
                      <Input type="date" value={startsOn} min={today} disabled={live} onChange={e => setStartsOn(e.target.value)} className="mt-1.5 h-10" />
                    </label>
                    <label className="text-[12px] font-medium text-neutral-600">
                      {t('campaigns.g_ends_on')}
                      <Input type="date" value={endsOn} min={startsOn || today} aria-invalid={!periodOk} onChange={e => setEndsOn(e.target.value)} className="mt-1.5 h-10" />
                    </label>
                  </div>
                )}
                {!periodOk && <p className="mt-2 text-[12px] text-red-600">{t(endsOn ? 'campaigns.group_period_invalid' : 'campaigns.g_period_need_end')}</p>}
              </Block>
            </div>
          )}
          {step === 3 && (
            <ReviewStep plan={plan} preview={preview} name={shownName} account={account} audit={audit} live={live}
              overlap={overlap} setOverlap={setOverlap} declareEu={declareEu} setDeclareEu={setDeclareEu} f={f} priceText={priceText} />
          )}
        </div>

        {/* Rezumatul, pe loc */}
        <Summary preview={preview} name={shownName} f={f} showNotes={!isEmptyRules(rules)}
          className="hidden w-[300px] shrink-0 overflow-y-auto border-l border-neutral-100 bg-neutral-50/60 lg:block" />
      </div>

      {/* Mesajul și butoanele */}
      <div className="border-t border-neutral-100 bg-white px-6 py-4">
        {error && (
          <Callout tone="danger" className="mb-3" onClose={() => setError(null)}>
            <p>{error.text}</p>
            {error.details?.map(d => <p key={d} className="mt-1 break-all font-mono text-[11px] opacity-80">{d}</p>)}
          </Callout>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {step > 1 && <Button variant="ghost" onClick={() => setStep((step - 1) as Step)}><ArrowLeft />{t('campaigns.g_back')}</Button>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {step < 3 ? (
              <>
                {step === 1 && !step1Ok && <span className="hidden text-[12px] text-neutral-400 sm:inline">{t(isEmptyRules(rules) ? 'campaigns.g_pick_products' : 'campaigns.g_no_products')}</span>}
                <Button variant="primary" size="lg" onClick={() => setStep((step + 1) as Step)} disabled={!(step === 1 ? step1Ok : step2Ok)}>
                  {t('campaigns.g_next')}<ArrowRight />
                </Button>
              </>
            ) : live ? (
              <Button variant="primary" size="lg" loading={busy === 'save'} disabled={!!busy || !step2Ok} onClick={onSave}>
                {busy !== 'save' && <Check />}{t('campaigns.g_save_live')}
              </Button>
            ) : (
              <>
                {waiting && <span className="hidden max-w-[200px] text-right text-[12px] leading-tight text-neutral-400 md:inline">{t(waiting)}</span>}
                <Button size="lg" loading={busy === 'save'} disabled={!!busy || !step1Ok || !step2Ok} onClick={onSave}>{t('campaigns.g_save_draft')}</Button>
                <Button variant="primary" size="lg" loading={busy === 'launch'} disabled={!!busy || !ready} onClick={onLaunch}>
                  {busy !== 'launch' && <Rocket />}{t(group?.status === 'ended' ? 'campaigns.g_relaunch' : 'campaigns.g_launch')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-[14px] font-semibold text-neutral-900">{title}</h3>
      {hint && <p className="mt-0.5 max-w-2xl text-[13px] leading-relaxed text-neutral-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

// ─── Rezumatul de alături ────────────────────────────────────────────────────

function Summary({ preview: p, name, f, showNotes, className }: { preview: GroupPlan; name: string; f: Formats; showNotes: boolean; className?: string }) {
  const { t } = useT()
  const blockers = p.blockers.filter(b => b.id !== 'empty').length
  const rows = [
    { label: t('campaigns.g_stat_conversions'), value: f.num.format(p.conversions30) },
    { label: t('campaigns.econ_aov'), value: p.economics.aov !== null ? f.money.format(p.economics.aov) : '—' },
    ...(p.type === 'shopping' ? [{ label: t('campaigns.g_stat_cpc'), value: p.cpc_ceiling !== null ? f.money2.format(p.cpc_ceiling) : '—' }] : []),
    { label: t('campaigns.g_stat_budget'), value: p.budget.daily !== null ? f.money.format(p.budget.daily) : '—' },
  ]
  return (
    <aside className={className} aria-label={t('campaigns.g_summary')}>
      <div className="p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">{t('campaigns.g_summary')}</p>
        <p className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug text-neutral-900">{name}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="brand">{t(p.type === 'shopping' ? 'campaigns.g_type_shopping' : 'campaigns.g_type_performance_max')}</Badge>
        </div>

        <div className="mt-5 rounded-xl bg-white p-4 shadow-card ring-1 ring-neutral-200/70">
          <p className="text-[12px] text-neutral-500">{t('campaigns.g_stat_products')}</p>
          <p className="mt-1 text-[30px] font-semibold leading-none tabular-nums tracking-[-0.025em] text-neutral-950">
            <NumberTicker value={p.counts.included} format={n => f.int.format(Math.round(n))} />
          </p>
          <p className="mt-1.5 text-[12px] text-neutral-400">{t(`campaigns.g_basis_${p.basis}`)}</p>
        </div>

        <dl className="mt-4 divide-y divide-neutral-200/60 text-[13px]">
          {rows.map(r => (
            <div key={r.label} className="flex items-center justify-between gap-3 py-2">
              <dt className="text-neutral-500">{r.label}</dt>
              <dd className="font-medium tabular-nums text-neutral-900">{r.value}</dd>
            </div>
          ))}
        </dl>

        {showNotes && (blockers > 0 || p.warnings.length > 0) && (
          <div className="mt-4 space-y-1.5 text-[12px]">
            {blockers > 0 && <p className="flex items-center gap-2 text-red-600"><span className="size-1.5 rounded-full bg-red-500" />{t('campaigns.g_summary_blockers', { count: blockers })}</p>}
            {p.warnings.length > 0 && <p className="flex items-center gap-2 text-amber-700"><span className="size-1.5 rounded-full bg-amber-500" />{t('campaigns.g_summary_warnings', { count: p.warnings.length })}</p>}
          </div>
        )}
      </div>
    </aside>
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
  f: Formats
  currency: string
}

function ProductsStep({ plan, rules, setRules, active, toggleFilter, assigned, groupId, ownerName, preview, toggleOffer, f, currency }: ProductsProps) {
  const { t } = useT()
  const [scope, setScope] = useState<'group' | 'all'>('group')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const categories = useMemo(() => facetOf(plan.offers, 'category'), [plan.offers])
  const brands = useMemo(() => facetOf(plan.offers, 'brand'), [plan.offers])
  const prices = plan.offers.map(o => o.price).filter(p => p > 0)
  const onSale = plan.offers.filter(o => o.on_sale).length

  // Fără filtre (doar produse alese de mână) lista arată tot catalogul
  const forcedAll = active.size === 0 || (active.size === 1 && active.has('manual') && !rules.include.length)
  const shownScope = forcedAll ? 'all' : scope
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
    <div className="space-y-6">
      <Block title={t('campaigns.g_start_from')} hint={t('campaigns.g_start_hint')}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
          {FILTERS.map(({ id, icon: Icon }) => {
            const on = active.has(id)
            const disabled = (id === 'categories' && !categories.length) || (id === 'brands' && !brands.length) || (id === 'sale' && !onSale)
            return (
              <button key={id} onClick={() => toggleFilter(id)} disabled={disabled} aria-pressed={on}
                className={cn('relative flex flex-col items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40',
                  on ? 'border-brand-600 bg-brand-50/40 ring-1 ring-brand-600' : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-card')}>
                <span className={cn('flex size-8 items-center justify-center rounded-lg transition-colors', on ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-500')}>
                  <Icon className="size-4" />
                </span>
                <span className="text-[13px] font-semibold leading-tight text-neutral-900">{t(`campaigns.g_filter_${id}`)}</span>
                {on && (
                  <span className="absolute right-2.5 top-2.5 flex size-4 items-center justify-center rounded-full bg-brand-600 text-white">
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </Block>

      {/* Filtrele alese */}
      {active.has('categories') && (
        <FilterBox icon={FolderTree} title={t('campaigns.g_filter_categories')} hint={t('campaigns.g_categories_hint')}>
          <Chips items={categories} picked={rules.categories} onPick={v => pick('categories', v)} f={f} />
        </FilterBox>
      )}
      {active.has('brands') && (
        <FilterBox icon={Tag} title={t('campaigns.g_filter_brands')} hint={t('campaigns.g_brands_hint')}>
          <Chips items={brands} picked={rules.brands} onPick={v => pick('brands', v)} f={f} />
        </FilterBox>
      )}
      {active.has('price') && (
        <FilterBox icon={Coins} title={t('campaigns.g_filter_price')}
          hint={prices.length ? t('campaigns.g_price_hint', { min: f.money.format(Math.min(...prices)), max: f.money.format(Math.max(...prices)) }) : undefined}>
          <div className="flex items-center gap-2">
            {(['price_min', 'price_max'] as const).map((k, i) => (
              <div key={k} className="flex items-center gap-2">
                {i === 1 && <span className="text-neutral-300">—</span>}
                <Input defaultValue={rules[k] === null ? '' : String(rules[k]).replace('.', ',')} inputMode="decimal" suffix={currency} wrapperClassName="w-36"
                  placeholder={t(k === 'price_min' ? 'campaigns.g_price_min' : 'campaigns.g_price_max')} aria-label={t(k === 'price_min' ? 'campaigns.g_price_min' : 'campaigns.g_price_max')}
                  className="tabular-nums" onChange={e => setPrice(k, e.target.value)} />
              </div>
            ))}
          </div>
        </FilterBox>
      )}
      {active.has('sale') && <FilterBox icon={BadgePercent} title={t('campaigns.g_filter_sale')} hint={t('campaigns.g_sale_hint', { count: onSale })} />}
      {active.has('manual') && <FilterBox icon={ListChecks} title={t('campaigns.g_filter_manual')} hint={t('campaigns.g_manual_hint', { count: rules.include.length })} />}

      {/* Ce prinde campania acum */}
      <section className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white">
        <div className="flex flex-col gap-3 border-b border-neutral-100 bg-neutral-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {forcedAll ? (
            <p className="text-[13px] font-medium text-neutral-700">{t('campaigns.g_scope_all', { count: f.int.format(plan.offers.length) })}</p>
          ) : (
            <Segmented id="group-scope" size="sm" value={shownScope} onChange={k => { setScope(k); setPage(1) }} items={(['group', 'all'] as const).map(k => ({
              value: k, label: t(`campaigns.g_scope_${k}`, { count: f.int.format(k === 'group' ? preview.counts.members : plan.offers.length) }),
            }))} />
          )}
          <Input icon={<Search />} wrapperClassName="sm:w-64" className="h-8" value={search} placeholder={t('campaigns.search_placeholder')}
            onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>

        {/* Pe ecrane mici rezumatul de alături nu încape: cifrele lui, aici */}
        <div className="grid grid-cols-3 gap-px border-b border-neutral-100 bg-neutral-100 lg:hidden">
          {[
            { label: t('campaigns.g_stat_products'), value: f.int.format(preview.counts.included) },
            { label: t('campaigns.g_stat_conversions'), value: f.num.format(preview.conversions30) },
            { label: t('campaigns.g_stat_budget'), value: preview.budget.daily !== null ? f.money.format(preview.budget.daily) : '—' },
          ].map(k => (
            <div key={k.label} className="bg-white px-4 py-2.5">
              <p className="text-[11px] text-neutral-500">{k.label}</p>
              <p className="text-[15px] font-semibold tabular-nums text-neutral-900">{k.value}</p>
            </div>
          ))}
        </div>
        {preview.counts.elsewhere > 0 && (
          <p className="flex items-start gap-2 border-b border-neutral-100 bg-amber-50/50 px-4 py-2.5 text-[12px] text-amber-800">
            <Info className="mt-px size-3.5 shrink-0" />{t('campaigns.g_warn_in_other_group', { count: preview.counts.elsewhere })}
          </p>
        )}

        {visible.length === 0 ? (
          <p className="px-6 py-12 text-center text-[13px] text-neutral-400">{search ? t('catalog.no_results') : t('campaigns.g_list_empty')}</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {visible.map(o => {
              const owner = assigned.get(o.offer_id)
              const inGroup = owner === groupId
              const elsewhere = !!owner && !inGroup
              const blocked = !canRun(o)
              return (
                <li key={o.offer_id} className={cn('flex items-center gap-3 px-4 py-2.5 transition-colors', inGroup ? 'bg-white' : 'bg-neutral-50/40', !elsewhere && 'hover:bg-brand-50/30')}>
                  <button onClick={() => toggleOffer(o, inGroup)} disabled={elsewhere} aria-pressed={inGroup}
                    title={elsewhere ? t('campaigns.g_in_other', { name: ownerName.get(owner!) ?? '' }) : undefined}
                    aria-label={t(inGroup ? 'campaigns.g_remove_product' : 'campaigns.g_add_product')}
                    className={cn('flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-all disabled:cursor-not-allowed disabled:opacity-40',
                      inGroup ? 'border-brand-600 bg-brand-600 text-white' : 'border-neutral-300 bg-white hover:border-brand-500')}>
                    {inGroup && <Check className="size-3" strokeWidth={3} />}
                  </button>
                  <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-50 ring-1 ring-inset ring-neutral-200/70">
                    {o.image_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={o.image_url} alt="" loading="lazy" className="size-full object-cover" />
                      : <ImageIcon className="size-4 text-neutral-300" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('line-clamp-1 text-[13px] font-medium leading-snug', inGroup ? 'text-neutral-900' : 'text-neutral-600')}>
                      {o.title}{o.variant_title ? <span className="text-neutral-400"> · {o.variant_title}</span> : null}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-400">
                      {[o.category, o.brand].filter(Boolean).join(' · ')}
                      {o.on_sale && <Badge tone="red" className="h-[18px] px-1 text-[10px]">{t('campaigns.g_on_sale')}</Badge>}
                      {elsewhere && <Badge className="h-[18px] px-1 text-[10px]">{t('campaigns.g_in_other', { name: ownerName.get(owner!) ?? '' })}</Badge>}
                      {blocked && o.reason && <Badge tone="amber" className="h-[18px] px-1 text-[10px]">{t.has(`campaigns.reason_${o.reason}`) ? t(`campaigns.reason_${o.reason}`) : t('campaigns.reason_generic')}</Badge>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-medium tabular-nums text-neutral-900">{f.money.format(o.price)}</p>
                    <p className="text-[11px] tabular-nums text-neutral-400">
                      {o.units > 0 ? t('catalog.units', { count: Number(o.units) }) : '—'}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-neutral-100 px-4 py-2.5 text-[12px] text-neutral-500">
            <span className="tabular-nums">{t('catalog.page_of', { from: f.int.format((current - 1) * PER_PAGE + 1), to: f.int.format(Math.min(current * PER_PAGE, list.length)), total: f.int.format(list.length) })}</span>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={current === 1} aria-label={t('catalog.prev')}><ChevronLeft /></Button>
              <Button size="icon" variant="ghost" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={current === pages} aria-label={t('catalog.next')}><ChevronRight /></Button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function FilterBox({ icon: Icon, title, hint, children }: { icon: LucideIcon; title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-card">
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0 text-brand-600" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-neutral-900">{title}</p>
          {hint && <p className="mt-0.5 text-[12px] leading-relaxed text-neutral-500">{hint}</p>}
        </div>
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

function Chips({ items, picked, onPick, f }: { items: [string, number][]; picked: string[]; onPick: (v: string) => void; f: Formats }) {
  const { t } = useT()
  const [q, setQ] = useState('')
  const set = new Set(picked.map(p => p.toLocaleLowerCase('ro')))
  const shown = items.filter(([v]) => !q || v.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <div>
      {items.length > 12 && (
        <Input icon={<Search />} value={q} onChange={e => setQ(e.target.value)} placeholder={t('campaigns.g_filter_search')} wrapperClassName="mb-2.5 max-w-xs" className="h-8" />
      )}
      <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
        {shown.map(([v, n]) => {
          const on = set.has(v.toLocaleLowerCase('ro'))
          return (
            <button key={v} onClick={() => onPick(v)} aria-pressed={on}
              className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium ring-1 ring-inset transition-all',
                on ? 'bg-brand-600 text-white ring-brand-600 shadow-[0_1px_2px_rgb(16_24_40/0.14)]' : 'bg-white text-neutral-700 ring-neutral-200 hover:bg-neutral-50 hover:ring-neutral-300')}>
              {on && <Check className="size-3" strokeWidth={3} />}{v}<span className={cn('tabular-nums', on ? 'text-white/70' : 'text-neutral-400')}>{f.int.format(n)}</span>
            </button>
          )
        })}
      </div>
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
  f: Formats
  priceText: (r: GroupRules) => string
}

function ReviewStep({ plan, preview: p, name, account, audit, live, overlap, setOverlap, declareEu, setDeclareEu, f, priceText }: ReviewProps) {
  const { t } = useT()
  const g = p.group
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
      hint: g.campaign_type === 'auto' ? t(p.type === 'shopping' ? 'campaigns.g_type_auto_shopping' : 'campaigns.g_type_auto_pmax', { conversions: f.num.format(p.conversions30) }) : undefined,
    },
    p.type === 'shopping' ? {
      label: t('campaigns.row_bidding'),
      value: p.cpc_ceiling !== null ? t('campaigns.bidding_clicks', { cpc: f.money2.format(p.cpc_ceiling) }) : t('campaigns.bidding_clicks_no_cap'),
      hint: p.cpc_ceiling !== null && p.economics.aov !== null
        ? `${t('campaigns.bidding_clicks_hint', { aov: f.money.format(p.economics.aov) })}${p.cpc_ceiling_low ? ` ${t('campaigns.bidding_cpc_low')}` : ''}`
        : undefined,
    } : {
      label: t('campaigns.row_bidding'),
      value: t('campaigns.bidding_value'),
      hint: t('campaigns.bidding_value_hint'),
    },
    { label: t('campaigns.row_budget'), value: p.budget.daily !== null ? t('campaigns.g_budget_value', { budget: f.money.format(p.budget.daily) }) : '—' },
    {
      label: t('campaigns.g_period'),
      value: g.ends_on ? t(g.starts_on ? 'campaigns.g_period_between' : 'campaigns.g_period_until', { start: g.starts_on ? f.date.format(day(g.starts_on)) : '', end: f.date.format(day(g.ends_on)) }) : t('campaigns.g_period_always'),
    },
    {
      label: t('campaigns.row_safety'),
      value: p.loss_limit ? t('campaigns.safety_value', { none: f.money.format(p.loss_limit.no_conversions), low: f.money.format(p.loss_limit.low_roas) }) : t('campaigns.safety_unknown'),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Cartea de vizită a campaniei */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-600 to-brand-800 p-6 text-white shadow-raised">
        <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.08)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:linear-gradient(to_left,black,transparent_70%)]" />
        <p className="relative text-[11px] font-semibold uppercase tracking-[0.1em] text-white/60">{t(live ? 'campaigns.g_review_live' : 'campaigns.g_review_ready')}</p>
        <p className="relative mt-1.5 text-[20px] font-semibold tracking-[-0.02em]">{name}</p>
        <dl className="relative mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: t('campaigns.g_stat_products'), value: f.int.format(p.counts.included) },
            { label: t('campaigns.g_stat_budget'), value: p.budget.daily !== null ? f.money.format(p.budget.daily) : '—' },
            { label: t('campaigns.econ_aov'), value: p.economics.aov !== null ? f.money.format(p.economics.aov) : '—' },
            { label: t('campaigns.g_stat_conversions'), value: f.num.format(p.conversions30) },
          ].map(k => (
            <div key={k.label}>
              <dt className="text-[11px] text-white/60">{k.label}</dt>
              <dd className="mt-0.5 text-[18px] font-semibold tabular-nums">{k.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <dl className="divide-y divide-neutral-100 rounded-xl border border-neutral-200/80 px-5">
        {rows.map(r => (
          <div key={r.label} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[160px_1fr] sm:gap-6">
            <dt className="text-[13px] text-neutral-500">{r.label}</dt>
            <dd className="min-w-0">
              <div className="text-[13px] font-medium text-neutral-900">{r.value}</div>
              {r.hint && <p className="mt-0.5 text-[12px] leading-relaxed text-neutral-500">{r.hint}</p>}
            </dd>
          </div>
        ))}
      </dl>

      {/* Ce oprește lansarea și ce trebuie știut */}
      {(account.length > 0 || p.blockers.length > 0 || p.warnings.length > 0) && (
        <div className="space-y-2">
          {account.map(b => {
            const params = Object.fromEntries(Object.entries(b.params ?? {}).map(([k, v]) => [k, String(v)]))
            const step = `${b.id}${b.variant ? `_${b.variant}` : ''}`
            const label = t.has(`campaigns.blocker_${step}`) ? t(`campaigns.blocker_${step}`, params) : t.has(`campaigns.blocker_${b.id}`) ? t(`campaigns.blocker_${b.id}`, params) : t('campaigns.blocker_generic')
            return <Callout key={b.id} tone="danger">{label}</Callout>
          })}
          {p.blockers.map(b => <Callout key={b.id} tone="danger">{t(`campaigns.g_block_${b.id}`, noteParams(b.params, f.money))}</Callout>)}
          {p.warnings.map(w => <Callout key={w.id} tone="warning">{t(`campaigns.g_warn_${w.id}`, noteParams(w.params, f.money))}</Callout>)}
        </div>
      )}

      {/* Alegerile din audit (prima lansare în cont, sau dacă omul și-a păstrat campaniile) */}
      {!live && audit?.result && (audit.result.overlap.length > 0 || audit.result.eu_undeclared.length > 0) && (
        <div className="rounded-xl border border-neutral-200/80 p-5">
          <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-neutral-900"><ShieldCheck className="size-4 text-neutral-500" />{t('campaigns.audit_title')}</p>
          <AccountChoices result={audit.result} overlap={overlap} onOverlap={setOverlap} declareEu={declareEu} onDeclareEu={setDeclareEu} />
        </div>
      )}
      {!live && !audit?.result && <Callout tone="danger">{t('campaigns.blocker_audit')}</Callout>}

      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-neutral-500">
        {live ? <CalendarRange className="mt-0.5 size-3.5 shrink-0" /> : <Info className="mt-0.5 size-3.5 shrink-0" />}
        {live ? t('campaigns.g_live_note') : t(plan.counts.included > 0 ? 'campaigns.g_launch_note' : 'campaigns.g_launch_note_alone', { products: f.int.format(p.counts.included) })}
      </p>
    </div>
  )
}
