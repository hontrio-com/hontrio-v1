'use client'

import { useId, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleCheck, ExternalLink, Info, Loader2, Lock, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import { cn } from '@/lib/utils'
import { Button, linkStyles, textActionStyles } from '@/components/app/button'
import { Callout } from '@/components/app/feedback'
import { InfoTip } from '@/components/app/info-tip'
import { NumberTicker } from '@/components/app/motion'
import { Surface } from '@/components/app/surface'
import { SlideCommit } from '@/components/app/fx/controls'
import { LaunchSteps } from '@/components/app/fx/feedback'
import { AccountChoices, choicesDone as choicesMade, type Overlap } from '@/components/campaigns/account-choices'
import type { AuditData } from '@/components/campaigns/types'
import type { Formats } from '@/components/app/formats'
import { DAYS_PER_MONTH, GOAL_KEEP, GOALS, MIN_COST_COVERAGE, forecastFor, niceBudget, type Goal, type Plan } from '@/lib/campaigns/plan'
import { FROM_AUDIT, STEPS, blockerText, customerId, setupOf, type Blocker, type SetupStep, type StepId } from '@/components/dashboard/setup'

// =============================================
// Asistentul de lansare, pe suprafața mare a Dashboard-ului (ca „Create new
// clips" la Bezeno): sus, ce urmează și cât mai e; pașii într-o pastilă gri, cu
// cel ales pe negru; dedesubt, acțiunea pasului (un rând înalt și butonul mare,
// negru) și, în dreapta, pe negru, ce schimbă: marja și pragul la costuri,
// profitul pe lună la buget, recalculat cât tragi de glisor. Lansarea se face
// glisând, nu dintr-un clic scăpat.
// =============================================

const EASE = [0.22, 1, 0.36, 1] as const

/** Butonul mare, negru, al acțiunii unui pas (Bezeno · „Get clips"). */
const bigButton = 'group flex h-14 shrink-0 items-center justify-center gap-2 rounded-2xl bg-black px-7 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_28px_-12px_rgba(0,0,0,0.6)] transition hover:bg-neutral-800 disabled:pointer-events-none disabled:opacity-50'
/** Rândul înalt în care stă acțiunea (Bezeno · câmpul linkului). */
const field = 'flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-neutral-50/60 px-4 py-3'
const chip = 'rounded-full border border-line bg-white px-2.5 py-0.5 text-xs text-neutral-500'

/** Magazinul, pentru primul pas; `orders` null = pagina nu-l știe (nu se arată). */
export type WizardStore = { name: string | null; offers: number; orders: number | null }
type Note = { tone: 'success' | 'warning' | 'danger'; text: string; details?: string[] }
type Busy = 'recheck' | 'audit' | 'costs' | 'goal' | 'budget' | 'launch' | null

export function LaunchWizard({ plan, audit, store, f, picked: pickedProp, onPick, onChanged, onLaunched }: {
  plan: Plan
  audit: AuditData | null
  store: WizardStore
  f: Formats
  /** Pasul deschis, când îl ține pagina (null = pasul de acum). */
  picked?: StepId | null
  onPick?: (id: StepId | null) => void
  /** Recitește planul (și restul paginii) după o schimbare; întoarce planul nou (null = n-a mers). */
  onChanged: () => Promise<Plan | null>
  /** Campania a pornit: pagina trece la cifrele ei. */
  onLaunched: (text: string) => void
}) {
  const { t, intlLocale } = useT()
  const reduce = useReducedMotion()
  const uid = useId()
  const [ownPick, setOwnPick] = useState<StepId | null>(null)
  const picked = pickedProp !== undefined ? pickedProp : ownPick
  const pick = onPick ?? setOwnPick
  const [busy, setBusy] = useState<Busy>(null)
  const [note, setNote] = useState<Note | null>(null)
  const [overlap, setOverlap] = useState<Overlap>(null)
  const [declareEu, setDeclareEu] = useState(false)
  const [percent, setPercent] = useState(60)
  // Bugetul tras pe glisor, încă nesalvat: estimarea din dreapta îl urmează
  const [budgetDraft, setBudgetDraft] = useState<number | null>(null)

  const setup = setupOf(plan)
  const shown = picked ?? setup.current
  const step = setup.steps.find(s => s.id === shown) ?? setup.steps[0]
  const text = (b: Blocker) => blockerText(t, b)
  const title = setup.left <= 1 ? t('wizard.title_ready') : t('wizard.title_left', { count: setup.left })

  async function recheck(stepId: StepId, withAudit: boolean) {
    setBusy('recheck')
    setNote(null)
    try {
      if (withAudit) {
        const r = await fetch('/api/campaigns/audit', { method: 'POST' })
        if (!r.ok) {
          const body = await r.json().catch(() => ({}))
          setNote({ tone: 'warning', text: body.error || t('campaigns.audit_failed') })
          return
        }
      }
      const next = await onChanged()
      pick(null)
      const ids = STEPS.find(s => s.id === stepId)?.blockers ?? []
      if (next && next.blockers.some(b => ids.includes(b.id))) setNote({ tone: 'warning', text: t('wizard.still_missing') })
    } catch {
      setNote({ tone: 'danger', text: t('campaigns.audit_failed') })
    } finally {
      setBusy(null)
    }
  }

  async function runAudit() {
    setBusy('audit')
    setNote(null)
    try {
      const r = await fetch('/api/campaigns/audit', { method: 'POST' })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) setNote({ tone: 'warning', text: body.error || t('campaigns.audit_failed') })
      await onChanged()
    } catch {
      setNote({ tone: 'danger', text: t('campaigns.audit_failed') })
    } finally {
      setBusy(null)
    }
  }

  async function estimateCosts() {
    setBusy('costs')
    setNote(null)
    try {
      const r = await fetch('/api/catalog/cost/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percent, only_missing: true }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) { setNote({ tone: 'danger', text: body.error || t('wizard.costs_failed') }); return }
      await onChanged()
      pick(null)
      setNote({ tone: 'success', text: t('wizard.costs_applied', { count: Number(body.updated) || 0 }) })
    } catch {
      setNote({ tone: 'danger', text: t('wizard.costs_failed') })
    } finally {
      setBusy(null)
    }
  }

  async function saveSettings(kind: 'goal' | 'budget', body: { goal?: Goal; daily_budget?: number | null }) {
    setBusy(kind)
    setNote(null)
    try {
      const r = await fetch('/api/campaigns/plan', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!r.ok) throw new Error()
      await onChanged()
    } catch {
      setNote({ tone: 'danger', text: t('campaigns.save_error') })
    } finally {
      setBusy(null)
      if (kind === 'budget') setBudgetDraft(null)
    }
  }

  /** Lansarea: întoarce o promisiune, ca butonul glisant să arate cât lucrează și să tremure la eșec. */
  async function launch(): Promise<void> {
    setBusy('launch')
    setNote(null)
    // Pașii lansării rămân pe ecran măcar puțin, ca să se poată citi, chiar dacă Google răspunde repede
    const minimum = new Promise(resolve => setTimeout(resolve, 1600))
    try {
      const r = await fetch('/api/campaigns/launch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overlap, declare_eu: declareEu }),
      })
      const body = await r.json().catch(() => ({}))
      await minimum
      if (!r.ok) {
        const details = (body.details as { code: string | null; path: string | null; message: string }[] | undefined ?? [])
          .map(d => [d.code, d.path, d.message].filter(Boolean).join(' · '))
        setNote({ tone: 'danger', text: body.error || t('campaigns.launch_failed'), details })
        onChanged()
        throw new Error('launch')
      }
      onLaunched([t('campaigns.launch_done'), ...(body.warnings ?? [])].join(' '))
    } catch (err) {
      if (!(err instanceof Error && err.message === 'launch')) setNote({ tone: 'danger', text: t('campaigns.launch_failed') })
      throw err
    } finally {
      setBusy(null)
    }
  }

  const backToCurrent = picked && picked !== setup.current && (
    <button type="button" onClick={() => pick(null)} className={cn(textActionStyles, 'text-[13px]')}>
      <ArrowLeft />{t('wizard.back_to_current')}
    </button>
  )
  const recheckButton = (withAudit: boolean) => (
    <Button onClick={() => recheck(step.id, withAudit)} loading={busy === 'recheck'} disabled={!!busy && busy !== 'recheck'}>
      {busy !== 'recheck' && <RefreshCw />}{busy === 'recheck' ? t('wizard.rechecking') : t('wizard.recheck')}
    </Button>
  )

  return (
    <Surface dotted id="setup-panel" className="scroll-mt-24">
      <div className="p-5 sm:p-7">
        {/* Ce urmează */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-neutral-950">{title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-neutral-500">{t('wizard.subtitle')}</p>
          </div>
          <span className="flex shrink-0 items-center gap-2.5 self-start rounded-full border border-line bg-white px-3 py-1.5 text-sm sm:self-auto">
            <span className="flex gap-0.5">
              {setup.steps.map(s => <span key={s.id} className={cn('h-1.5 w-3 rounded-full', s.state === 'done' ? 'bg-black' : s.state === 'current' ? 'bg-neutral-400' : 'bg-neutral-200')} />)}
            </span>
            <span className="font-medium tabular-nums">{t('wizard.progress', { done: String(setup.done), total: String(setup.total) })}</span>
          </span>
        </div>

        {/* Pașii */}
        <nav aria-label={t('wizard.eyebrow')} className="mt-6 flex gap-1 overflow-x-auto rounded-2xl bg-neutral-100 p-1 [scrollbar-width:none]">
          {setup.steps.map(s => {
            const active = s.id === shown
            // Titlurile lungi au o variantă scurtă pentru bara de pași
            const short = `wizard.${s.id}_short`
            const label = t.has(short) ? t(short) : t(`wizard.${s.id}_title`)
            return (
              <button key={s.id} type="button" onClick={() => pick(s.id === setup.current ? null : s.id)} aria-current={active ? 'step' : undefined}
                className={cn('relative flex min-w-[124px] flex-1 basis-0 flex-col items-center justify-center overflow-hidden rounded-xl px-2.5 py-2 text-sm font-medium transition-colors',
                  active ? 'text-white' : 'text-neutral-500 hover:text-black')}>
                {active && <motion.span layoutId={`${uid}-step`} className="absolute inset-0 rounded-xl bg-black shadow-sm" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 36 }} />}
                <span className="relative flex max-w-full items-center gap-1.5" title={t(`wizard.${s.id}_title`)}>
                  {s.state === 'done'
                    ? <Check className="size-3.5 shrink-0" strokeWidth={3} />
                    : <span className={cn('shrink-0 font-mono text-[11px]', active ? 'text-white/60' : 'text-neutral-400')}>{s.index + 1}</span>}
                  <span className="truncate">{label}</span>
                </span>
                <span className={cn('relative text-[10px]', active ? 'text-white/60' : 'text-neutral-400')}>
                  {t(`wizard.state_${s.state}`)}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Ce faci */}
          <div className="min-w-0">
            {note && (
              <Callout tone={note.tone} onClose={() => setNote(null)} className="mb-5">
                <p>{note.text}</p>
                {note.details?.map(d => <p key={d} className="mt-1 break-all font-mono text-[11px] opacity-80">{d}</p>)}
              </Callout>
            )}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={shown}
                initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: EASE }}>
                <h3 className="text-lg font-semibold tracking-tight text-neutral-950">{t(`wizard.${step.id}_title`)}</h3>
                {step.id === 'store' && <StoreStep step={step} store={store} />}
                {step.id === 'google' && <GoogleStep plan={plan} step={step} text={text} recheckButton={recheckButton} />}
                {step.id === 'tracking' && <TrackingStep plan={plan} step={step} text={text} recheckButton={recheckButton} />}
                {step.id === 'costs' && (
                  <CostsStep plan={plan} step={step} percent={percent} onPercent={setPercent} busy={busy === 'costs'} disabled={!!busy && busy !== 'costs'}
                    f={f} text={text} onApply={estimateCosts} />
                )}
                {step.id === 'launch' && (
                  <LaunchStep plan={plan} audit={audit} setup={setup} f={f} intlLocale={intlLocale} busy={busy}
                    overlap={overlap} onOverlap={setOverlap} declareEu={declareEu} onDeclareEu={setDeclareEu}
                    onGoTo={() => pick(null)} onGoal={g => { if (g !== plan.goal && !busy) saveSettings('goal', { goal: g }) }}
                    budgetDraft={budgetDraft} onBudgetDraft={setBudgetDraft}
                    onBudget={value => {
                      if (value === undefined) setBudgetDraft(null)
                      else saveSettings('budget', { daily_budget: value })
                    }} onAudit={runAudit} onLaunch={launch} />
                )}
                {backToCurrent && <div className="mt-5">{backToCurrent}</div>}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Ce schimbă, pe negru */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={shown} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: EASE }}>
              <Aside step={step.id} plan={plan} store={store} percent={percent} budgetDraft={budgetDraft} f={f} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <LaunchSteps open={busy === 'launch'} title={t('wizard.launching_title')} hint={t('wizard.launching_wait')}
        steps={[t('wizard.launching_1'), t('wizard.launching_2'), t('wizard.launching_3'), t('wizard.launching_4')]} />
    </Surface>
  )
}

// ── Bucăți comune ────────────────────────────────────────────────────────────

function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-1 max-w-2xl text-sm leading-relaxed text-neutral-500">{children}</p>
}

/** Rândul unui lucru gata: bifă neagră și ce s-a făcut. */
function DoneRow({ children }: { children: ReactNode }) {
  return (
    <div className={cn(field, 'mt-5')}>
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-black text-white"><Check className="size-4" strokeWidth={3} /></span>
      <span className="text-[15px] text-neutral-800">{children}</span>
    </div>
  )
}

function Chips({ items }: { items: ReactNode[] }) {
  return <div className="mt-4 flex flex-wrap items-center gap-2">{items.map((c, i) => <span key={i} className={chip}>{c}</span>)}</div>
}

// ── Pașii ─────────────────────────────────────────────────────────────────────

function StoreStep({ step, store }: { step: SetupStep; store: WizardStore }) {
  const { t } = useT()
  return (
    <>
      <Lead>{step.state === 'done' ? t('wizard.store_done', { store: store.name || '—' }) : t('wizard.store_todo')}</Lead>
      {step.state === 'done'
        ? <DoneRow>{store.name || '—'}</DoneRow>
        : (
          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <div className={cn(field, 'flex-1 text-[15px] text-neutral-500')}>{t('wizard.store_todo')}</div>
            <Link href="/settings?tab=integrations" className={bigButton}>{t('wizard.store_action')}<ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></Link>
          </div>
        )}
    </>
  )
}

function GoogleStep({ plan, step, text, recheckButton }: { plan: Plan; step: SetupStep; text: (b: Blocker) => string; recheckButton: (withAudit: boolean) => ReactNode }) {
  const { t } = useT()
  const b = step.open[0] ?? null
  return (
    <>
      <Lead>{t('wizard.google_desc')}</Lead>
      {b ? (
        <>
          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <div className={cn(field, 'flex-1 text-[15px] text-neutral-800')}>{text(b)}</div>
            {FROM_AUDIT.includes(b.id) ? recheckButton(true) : (
              <Link href="/settings?tab=integrations" className={bigButton}>
                {t(b.id === 'google_ads' ? 'wizard.google_connect' : b.id === 'ads_account' ? 'wizard.google_choose' : 'wizard.google_fix')}
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
          {b.id === 'google_ads' && (
            <a href="https://ads.google.com/" target="_blank" rel="noopener" className={cn(linkStyles, 'mt-4 inline-flex items-center gap-1 text-[13px]')}>
              {t('wizard.google_no_account')}<ExternalLink className="size-3.5" />
            </a>
          )}
        </>
      ) : (
        <DoneRow>{t('wizard.google_done', { account: plan.campaign.account ? (plan.campaign.account.name || customerId(plan.campaign.account.customer_id)) : '—' })}</DoneRow>
      )}
    </>
  )
}

function TrackingStep({ plan, step, text, recheckButton }: { plan: Plan; step: SetupStep; text: (b: Blocker) => string; recheckButton: (withAudit: boolean) => ReactNode }) {
  const { t } = useT()
  const rows = (['merchant', 'conversion'] as const).map(id => {
    const ids = id === 'merchant'
      ? ['merchant', 'merchant_not_linked', 'merchant_other', 'merchant_choose']
      : ['conversion', 'purchase_missing', 'purchase_not_primary', 'purchase_no_value']
    return { id, status: plan.campaign[id], blocker: step.open.find(b => ids.includes(b.id)) ?? null }
  })
  return (
    <>
      <Lead>{t('wizard.tracking_desc')}</Lead>
      <div className="mt-5 space-y-2.5">
        {rows.map(r => {
          const ok = !r.blocker && r.status.status === 'ok'
          return (
            <div key={r.id} className={cn('flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center', r.blocker ? 'border-black bg-white shadow-sm' : 'border-line bg-neutral-50')}>
              <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', r.blocker ? 'border-2 border-dashed border-neutral-300' : ok ? 'bg-black text-white' : 'bg-neutral-200 text-neutral-600')}>
                {!r.blocker && <Check className="size-4" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-neutral-950">{t(`wizard.tracking_${r.id}`)}</span>
                <span className="block text-xs leading-relaxed text-neutral-500">
                  {r.blocker ? text(r.blocker) : ok ? (r.status.via ? t('wizard.tracking_ok_via', { via: r.status.via }) : t('wizard.tracking_ok')) : t('wizard.tracking_unverified')}
                </span>
              </span>
              {r.blocker && !FROM_AUDIT.includes(r.blocker.id) && (
                <Button asChild size="sm" variant="primary" className="self-start sm:self-auto">
                  {r.blocker.external
                    ? <a href={r.blocker.href} target="_blank" rel="noopener">{t('wizard.tracking_fix')}<ExternalLink /></a>
                    : <Link href={r.blocker.href}>{t('wizard.tracking_fix')}<ArrowRight /></Link>}
                </Button>
              )}
            </div>
          )
        })}
      </div>
      {step.open.length > 0 && <div className="mt-5">{recheckButton(step.open.some(b => FROM_AUDIT.includes(b.id)))}</div>}
    </>
  )
}

function CostsStep({ plan, step, percent, onPercent, busy, disabled, f, text, onApply }: {
  plan: Plan; step: SetupStep; percent: number; onPercent: (n: number) => void; busy: boolean; disabled: boolean
  f: Formats; text: (b: Blocker) => string; onApply: () => void
}) {
  const { t } = useT()
  const econ = plan.economics
  const coverage = Math.round(econ.cost_coverage * 100)
  const missing = plan.offers.filter(o => o.cost_price === null && o.price > 0).length
  const costsBlocker = step.open.find(b => b.id === 'costs') ?? null
  const other = step.open.filter(b => b.id !== 'costs')

  return (
    <>
      <Lead>{t('wizard.costs_desc')}</Lead>

      {other.map(b => (
        <Callout key={b.id} tone="warning" className="mt-5" action={<Button asChild size="sm"><Link href={b.href}>{t('wizard.tracking_fix')}<ArrowRight /></Link></Button>}>
          {text(b)}
        </Callout>
      ))}

      {costsBlocker || missing > 0 ? (
        <>
          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-stretch">
            <div className={cn(field, 'flex-1 flex-col items-stretch gap-1.5 py-3')}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] text-neutral-800">{t('wizard.costs_estimate_value', { pct: String(percent) })}</span>
                <span className="font-mono text-[13px] font-semibold text-neutral-950">{percent}%</span>
              </div>
              <input type="range" min={10} max={90} step={5} value={percent} onChange={e => onPercent(Number(e.target.value))}
                aria-label={t('wizard.costs_estimate_slider')} disabled={disabled || busy}
                className="range-mono h-6 w-full" style={{ '--pct': `${((percent - 10) / 80) * 100}%` } as React.CSSProperties} />
            </div>
            <button type="button" onClick={onApply} disabled={disabled || busy || missing === 0} className={bigButton}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {missing > 0 ? t('wizard.costs_apply', { count: missing }) : t('wizard.costs_apply_none')}
              {!busy && <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />}
            </button>
          </div>
          <Chips items={[
            t(econ.cost_basis === 'catalog' ? 'wizard.costs_coverage_catalog' : 'wizard.costs_coverage_sales', { pct: String(coverage) }),
            t('wizard.costs_needed'),
            <Link key="exact" href="/products?view=no_cost" className="text-neutral-700 hover:text-black">{t('wizard.costs_exact')} →</Link>,
          ]} />
          <p className="mt-3 text-xs text-neutral-400">{t('wizard.costs_estimate_hint')}</p>
        </>
      ) : null}

      {!costsBlocker && econ.margin !== null && econ.break_even !== null && (
        <DoneRow>{t('wizard.costs_done', { pct: String(Math.round(econ.margin * 100)), roas: f.num.format(econ.break_even) })}</DoneRow>
      )}

      {/* Acoperirea, cu pragul de 50% */}
      <div className="mt-5 max-w-md">
        <div className="relative h-1.5 overflow-hidden rounded-full bg-neutral-200">
          <motion.div className="h-full rounded-full bg-black" initial={{ width: 0 }} animate={{ width: `${Math.min(100, coverage)}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
          <span aria-hidden className="absolute inset-y-0 w-px bg-neutral-500" style={{ left: `${MIN_COST_COVERAGE * 100}%` }} />
        </div>
      </div>
    </>
  )
}

function LaunchStep({ plan, audit, setup, f, intlLocale, busy, overlap, onOverlap, declareEu, onDeclareEu, onGoTo, onGoal, budgetDraft, onBudgetDraft, onBudget, onAudit, onLaunch }: {
  plan: Plan; audit: AuditData | null; setup: ReturnType<typeof setupOf>; f: Formats; intlLocale: string; busy: Busy
  overlap: Overlap; onOverlap: (v: 'pause' | 'keep') => void; declareEu: boolean; onDeclareEu: (v: boolean) => void
  onGoTo: () => void; onGoal: (g: Goal) => void
  budgetDraft: number | null; onBudgetDraft: (n: number) => void
  /** null = bugetul propus de Hontrio; undefined = nimic de salvat (glisorul a rămas pe valoarea salvată). */
  onBudget: (value: number | null | undefined) => void
  onAudit: () => void; onLaunch: () => Promise<void>
}) {
  const { t } = useT()
  const uid = useId()
  const reduce = useReducedMotion()
  const locked = setup.blocking
  const result = audit?.result ?? null
  const hasAccount = !!plan.campaign.account
  const choicesDone = choicesMade(result, overlap, declareEu)
  const ready = !locked && plan.blockers.length === 0 && !!result && !audit?.error && choicesDone
  const waiting = locked ? null : !result || audit?.error ? t('wizard.launch_wait_audit') : !choicesDone ? t('wizard.launch_wait_choices') : null
  // Blocajele au pașii lor; campaniile suprapuse și declarația UE au întrebările de mai jos
  const asked = new Set([...(result?.overlap.length ? ['overlap'] : []), ...(result?.eu_undeclared.length ? ['eu_undeclared'] : [])])
  const checks = (result?.checks ?? []).filter(c => c.id !== 'currency_mismatch' && c.level !== 'blocker' && !asked.has(c.id))
  const place = placeOf(plan, intlLocale)

  return (
    <>
      <Lead>{t('wizard.launch_desc')}</Lead>

      {locked && (
        <div className={cn(field, 'mt-5 flex-col items-start gap-3 border-dashed sm:flex-row sm:items-center')}>
          <span className="flex flex-1 items-center gap-2.5 text-sm text-neutral-700"><Lock className="size-4 shrink-0 text-neutral-400" />{t('wizard.launch_locked', { step: t(`wizard.${locked}_title`) })}</span>
          <Button size="sm" onClick={onGoTo}>{t('wizard.launch_go')}<ArrowRight /></Button>
        </div>
      )}

      {/* Obiectivul (Bezeno · alegerea în pastilă, cu un rând sub fiecare variantă) */}
      <div className="mt-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-neutral-500">
          {t('wizard.goal_label')}{busy === 'goal' && <Loader2 className="size-3 animate-spin" />}
        </div>
        <div className="flex flex-wrap gap-1 rounded-2xl bg-neutral-100 p-1">
          {GOALS.map(g => {
            const active = plan.goal === g
            const target = plan.targets[g]
            return (
              <button key={g} type="button" onClick={() => onGoal(g)} disabled={!!busy} aria-pressed={active}
                title={t(`campaigns.goal_${g}_desc`, { keep: String(Math.round(GOAL_KEEP[g] * 100)) })}
                className={cn('relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-2.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed',
                  active ? 'text-white' : 'text-neutral-500 hover:text-black')}>
                {active && <motion.span layoutId={`${uid}-goal`} className="absolute inset-0 rounded-xl bg-black shadow-sm" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 36 }} />}
                <span className="relative flex items-center gap-1.5 whitespace-nowrap">
                  {t(`campaigns.goal_${g}`)}{g === 'balanced' && <span className={cn('size-1.5 rounded-full', active ? 'bg-white' : 'bg-black')} />}
                </span>
                <span className={cn('relative text-[10px]', active ? 'text-white/60' : 'text-neutral-400')}>
                  {target !== null ? t('wizard.goal_target', { roas: f.num.format(target) }) : t(`campaigns.goal_${g}`)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Bugetul */}
      <BudgetSlider plan={plan} f={f} draft={budgetDraft} onDraft={onBudgetDraft} saving={busy === 'budget'} disabled={!!busy && busy !== 'budget'} onSave={onBudget} />

      {/* Ce se lansează */}
      <Chips items={[
        t(plan.stage.id === 'starter' ? 'campaigns.type_shopping' : 'campaigns.type_pmax'),
        t('wizard.summary_products', { count: f.int.format(plan.counts.included) }),
        ...(place ? [place] : []),
      ]} />

      {/* Verificarea contului (Bezeno · cardul de opțiune, cu comutatorul în dreapta) */}
      {hasAccount && !locked && (
        <div className={cn('mt-5 rounded-2xl border p-4', result && !audit?.error ? 'border-line bg-neutral-50' : 'border-black bg-white shadow-sm')}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-neutral-900 text-white"><ShieldCheck className="size-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-neutral-950">
                {t('wizard.audit_title')}
                {audit && !audit.error && <span className="text-xs font-normal text-neutral-400">{t('wizard.audit_checked', { when: f.dateTime.format(new Date(audit.checked_at)) })}</span>}
              </span>
              <span className="block text-xs leading-relaxed text-neutral-500">{t('wizard.audit_desc')}</span>
            </span>
            <Button size="sm" variant={result ? 'secondary' : 'primary'} loading={busy === 'audit'} disabled={!!busy && busy !== 'audit'} onClick={onAudit} className="shrink-0 self-start sm:self-auto">
              {busy !== 'audit' && <RefreshCw />}{busy === 'audit' ? t('wizard.audit_running') : result ? t('campaigns.audit_again') : t('wizard.audit_run')}
            </Button>
          </div>
          {audit?.error && <Callout tone="danger" className="mt-3">{translateStored(t, audit.error)}</Callout>}
          {result && !audit?.error && (
            <div className="mt-3 space-y-2 border-t border-line pt-3">
              {!checks.length && !asked.size && <p className="flex items-center gap-2 text-[13px] text-emerald-700"><CircleCheck className="size-4" />{t('wizard.audit_ok')}</p>}
              {checks.map(c => (
                <p key={c.id} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-neutral-600">
                  {c.level === 'info' ? <Info className="mt-0.5 size-3.5 shrink-0 text-neutral-400" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />}
                  <span>{t.has(`campaigns.check_${c.id}`) ? t(`campaigns.check_${c.id}`, Object.fromEntries(Object.entries(c.params ?? {}).map(([k, v]) => [k, String(v)]))) : c.id}</span>
                </p>
              ))}
              {asked.size > 0 && (
                <div className="pt-2">
                  <AccountChoices result={result} overlap={overlap} onOverlap={onOverlap} declareEu={declareEu} onDeclareEu={onDeclareEu} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Lansarea, glisând */}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-xs leading-relaxed text-neutral-500">{waiting ?? t('wizard.launch_note')}</p>
        <SlideCommit label={t('wizard.slide_label')} doneLabel={t('wizard.slide_done')} errorLabel={t('wizard.slide_error')} workingLabel={t('wizard.launching_title')}
          disabled={!ready || (!!busy && busy !== 'launch')} onConfirm={onLaunch} width={300} height={56} radius={16} />
      </div>
    </>
  )
}

/** Bugetul pe zi, dintr-un glisor: estimarea din dreapta se schimbă cât tragi; se salvează când lași mânerul. */
function BudgetSlider({ plan, f, draft, onDraft, saving, disabled, onSave }: {
  plan: Plan; f: Formats; draft: number | null; onDraft: (n: number) => void; saving: boolean; disabled: boolean
  onSave: (value: number | null | undefined) => void
}) {
  const { t } = useT()
  const { budget } = plan
  const anchor = budget.daily ?? budget.suggested
  if (anchor === null) {
    return <p className={cn(field, 'mt-5 text-sm text-neutral-500')}>{t('wizard.budget_after_costs')}</p>
  }
  const base = budget.suggested ?? anchor
  const max = niceBudget(Math.max(base * 3, 30))
  const min = Math.max(1, niceBudget(base * 0.2))
  const step = max > 400 ? 10 : max > 80 ? 5 : 1
  const value = Math.min(max, Math.max(min, draft ?? anchor))
  const pct = ((value - min) / (max - min || 1)) * 100
  const suggestedPct = budget.suggested !== null ? ((budget.suggested - min) / (max - min || 1)) * 100 : null
  const commit = () => {
    if (draft === null) return
    if (value === budget.daily) { onSave(undefined); return }
    onSave(budget.suggested !== null && value === budget.suggested ? null : value)
  }

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-neutral-500">
        {t('wizard.budget_label')}{saving && <Loader2 className="size-3 animate-spin" />}
      </div>
      <div className={cn(field, 'flex-col items-stretch gap-2 py-3.5')}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-2xl font-bold tabular-nums tracking-[-0.04em] text-neutral-950">{f.money.format(value)}<span className="ml-1.5 text-sm font-medium tracking-normal text-neutral-500">{t('wizard.budget_per_day')}</span></span>
          <span className="text-xs text-neutral-500">{t('wizard.budget_month', { amount: f.money.format(value * DAYS_PER_MONTH) })}</span>
        </div>
        <div className="relative">
          <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
            aria-label={t('wizard.budget_label')} aria-valuetext={f.money.format(value)}
            onChange={e => onDraft(Number(e.target.value))}
            onPointerUp={commit} onKeyUp={commit} onBlur={commit}
            className="range-mono h-6 w-full" style={{ '--pct': `${pct}%` } as React.CSSProperties} />
          {suggestedPct !== null && (
            <span aria-hidden className="pointer-events-none absolute top-[26px] -translate-x-1/2 text-[10px] font-medium text-neutral-500" style={{ left: `${suggestedPct}%` }}>
              {t('wizard.budget_suggested_mark')}
            </span>
          )}
        </div>
        <div className="mt-3 flex justify-between font-mono text-[10px] text-neutral-400"><span>{f.money.format(min)}</span><span>{f.money.format(max)}</span></div>
      </div>
    </div>
  )
}

/** „România · română", din codurile campaniei, în limba paginii. */
function placeOf(plan: Plan, locale: string): string {
  const name = (type: 'region' | 'language', code: string | null) => {
    if (!code) return null
    try { return new Intl.DisplayNames([locale], { type }).of(code) ?? code } catch { return code }
  }
  return [name('region', plan.campaign.country), name('language', plan.campaign.language)].filter(Boolean).join(' · ')
}

// ── Dreapta, pe negru: ce schimbă pasul (Bezeno · cardul „Profile strength") ─

function DarkPanel({ label, value, bar, children }: { label: string; value?: ReactNode; bar?: number | null; children?: ReactNode }) {
  return (
    <div className="rounded-[1.4rem] bg-black p-5 text-white shadow-[0_24px_50px_-28px_rgba(0,0,0,0.8)] lg:sticky lg:top-6">
      <p className="text-xs text-white/60">{label}</p>
      {value !== undefined && <p className="mt-1 text-4xl font-bold leading-none tracking-[-0.05em] tabular-nums">{value}</p>}
      {bar !== undefined && bar !== null && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
          <motion.div className="h-full rounded-full bg-white" initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, bar))}%` }} transition={{ duration: 0.8, ease: EASE }} />
        </div>
      )}
      {children && <div className="mt-4 text-sm leading-relaxed text-white/60">{children}</div>}
    </div>
  )
}

function Facts({ facts }: { facts: string[] }) {
  return (
    <ul className="space-y-3">
      {facts.map((fact, i) => (
        <li key={fact} className="flex gap-3">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/10 font-mono text-[10px] text-white">{i + 1}</span>
          <span>{fact}</span>
        </li>
      ))}
    </ul>
  )
}

function Aside({ step, plan, store, percent, budgetDraft, f }: { step: StepId; plan: Plan; store: WizardStore; percent: number; budgetDraft: number | null; f: Formats }) {
  const { t } = useT()
  switch (step) {
    case 'store':
      return (
        <DarkPanel label={t('wizard.aside_store_title')} value={<NumberTicker value={store.offers} format={n => f.int.format(Math.round(n))} />}>
          <p className="text-white">{t('wizard.store_products')}{store.orders !== null ? ` · ${f.int.format(store.orders)} ${t('wizard.store_orders').toLowerCase()}` : ''}</p>
          <p className="mt-2">{t('wizard.aside_store_desc')}</p>
        </DarkPanel>
      )
    case 'google':
      return <DarkPanel label={t('wizard.aside_google_title')}><Facts facts={[t('wizard.aside_google_1'), t('wizard.aside_google_2'), t('wizard.aside_google_3')]} /></DarkPanel>
    case 'tracking':
      return <DarkPanel label={t('wizard.aside_tracking_title')}><Facts facts={[t('wizard.aside_tracking_1'), t('wizard.aside_tracking_2'), t('wizard.aside_tracking_3')]} /></DarkPanel>
    case 'costs': {
      const econ = plan.economics
      // Ca în planul campaniei: profitul vânzării, fără TVA și reduceri, față de valoarea raportată
      const margin = 1 - percent / 100
      const net = margin - econ.discount_pct / 100
      const be = net > 0 ? ((1 + econ.vat_pct / 100) * econ.value_ratio) / net : null
      return (
        <DarkPanel label={t('wizard.aside_costs_title', { pct: String(percent) })} value={be === null ? '—' : `≈ ${f.num.format(Math.round(be * 10) / 10)}`} bar={margin * 100}>
          <p className="text-white">{t('wizard.aside_costs_be')} · {t('wizard.aside_costs_margin').toLowerCase()} {Math.round(margin * 100)}%</p>
          <p className="mt-2">{t('wizard.aside_costs_desc')}</p>
        </DarkPanel>
      )
    }
    case 'launch': {
      const { target_roas: target, economics } = plan
      const forecast = budgetDraft !== null && target !== null && economics.break_even !== null
        ? forecastFor(budgetDraft, target, economics.break_even, economics.aov)
        : plan.forecast
      if (!forecast) {
        return (
          <DarkPanel label={t('wizard.forecast_title')}>
            {t('campaigns.econ_need_costs', { pct: String(Math.round(plan.economics.cost_coverage * 100)) })}
          </DarkPanel>
        )
      }
      return (
        <DarkPanel label={t('wizard.forecast_profit')} value={<NumberTicker value={forecast.profit} format={n => f.money.format(Math.round(n))} />}
          bar={forecast.revenue > 0 ? (forecast.profit / forecast.revenue) * 100 * 4 : 0}>
          <p className="text-white/80">{t('wizard.forecast_per_month')}</p>
          <dl className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
            {[
              { label: t('wizard.forecast_revenue'), value: f.money.format(forecast.revenue) },
              { label: t('wizard.forecast_spend'), value: f.money.format(forecast.spend) },
              ...(forecast.orders !== null ? [{ label: t('wizard.forecast_orders'), value: `~${f.int.format(forecast.orders)}` }] : []),
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between gap-3">
                <dt>{r.label}</dt><dd className="font-semibold tabular-nums text-white">{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 flex gap-2 text-xs text-white/45"><InfoTip>{t('wizard.forecast_note')}</InfoTip>{t('wizard.forecast_title')}</p>
        </DarkPanel>
      )
    }
  }
}
