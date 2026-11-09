'use client'

import { useId, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleCheck, ExternalLink, Info, Loader2, Lock, RefreshCw, ShieldCheck } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import { cn } from '@/lib/utils'
import { Button, linkStyles, textActionStyles } from '@/components/app/button'
import { Badge } from '@/components/app/badge'
import { Callout } from '@/components/app/feedback'
import { InfoTip } from '@/components/app/info-tip'
import { NumberTicker } from '@/components/app/motion'
import { BorderBeam } from '@/components/app/fx/cards'
import { DotPattern } from '@/components/app/fx/backgrounds'
import { SlideCommit } from '@/components/app/fx/controls'
import { DrawnCheck, LaunchSteps } from '@/components/app/fx/feedback'
import { AccountChoices, choicesDone as choicesMade, type Overlap } from '@/components/campaigns/account-choices'
import type { AuditData } from '@/components/campaigns/types'
import type { Formats } from '@/components/app/formats'
import { DAYS_PER_MONTH, GOAL_KEEP, GOALS, MIN_COST_COVERAGE, forecastFor, niceBudget, type Goal, type Plan } from '@/lib/campaigns/plan'
import { FROM_AUDIT, STEPS, blockerText, customerId, setupOf, type Blocker, type SetupStep, type StepId, type StepState } from '@/components/dashboard/setup'

// =============================================
// Panoul cu pașii până la prima campanie: sus, cei cinci pași (o linie alunecă
// sub pasul deschis); în stânga, ce faci la pasul ăsta, cu o singură acțiune;
// în dreapta, ce schimbă: marja și pragul de profit la costuri, profitul pe
// lună la buget. Lansarea se face glisând, nu dintr-un clic scăpat. Pe
// Dashboard pasul deschis îl alege și harta din antet (`picked`).
// =============================================

const EASE = [0.21, 0.47, 0.32, 0.98] as const

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
    <section id="setup-panel" className="relative scroll-mt-24 overflow-hidden rounded-[22px] border border-neutral-200/80 bg-white shadow-card">
      {/* Pașii */}
      <nav aria-label={t('wizard.eyebrow')} className="border-b border-neutral-100 px-2 pt-2">
        <ol className="flex overflow-x-auto [scrollbar-width:none]">
          {setup.steps.map(s => {
            const active = s.id === shown
            return (
              <li key={s.id} className="min-w-[148px] flex-1">
                <button type="button" onClick={() => pick(s.id === setup.current ? null : s.id)} aria-current={active ? 'step' : undefined}
                  className={cn('group relative flex w-full items-center gap-2.5 rounded-xl px-3 pb-4 pt-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-neutral-900/15',
                    !active && 'hover:bg-neutral-50')}>
                  <StepDot state={s.state} n={s.index + 1} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className={cn('truncate text-[13px] font-medium', active ? 'text-neutral-950' : s.state === 'done' ? 'text-neutral-500' : 'text-neutral-700')}>{t(`wizard.${s.id}_title`)}</span>
                      {s.state === 'current' && <span className="shrink-0 rounded-full bg-neutral-950 px-1.5 py-px text-[10px] font-semibold text-white">{t('wizard.state_current')}</span>}
                    </span>
                    <span className="block truncate text-[11.5px] text-neutral-400">{t(`wizard.${s.id}_short`)}</span>
                  </span>
                  {active && (
                    <motion.span aria-hidden layoutId={`${uid}-underline`} className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-neutral-950"
                      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42 }} />
                  )}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Ce faci */}
        <div className="min-w-0 p-6 sm:p-8">
          {note && (
            <Callout tone={note.tone} onClose={() => setNote(null)} className="mb-6">
              <p>{note.text}</p>
              {note.details?.map(d => <p key={d} className="mt-1 break-all font-mono text-[11px] opacity-80">{d}</p>)}
            </Callout>
          )}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={shown}
              initial={reduce ? false : { opacity: 0, x: 16, filter: 'blur(4px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={reduce ? undefined : { opacity: 0, x: -16, filter: 'blur(4px)' }}
              transition={{ duration: 0.26, ease: EASE }}>
              <StepHeader step={step} total={setup.total} />
              {step.id === 'store' && (
                <>
                  <Lead>{step.state === 'done' ? t('wizard.store_done', { store: store.name || '—' }) : t('wizard.store_todo')}</Lead>
                  {step.state !== 'done' && (
                    <ActionBox beam>
                      <Button asChild variant="primary" size="lg"><Link href="/settings?tab=integrations">{t('wizard.store_action')}<ArrowRight /></Link></Button>
                    </ActionBox>
                  )}
                </>
              )}

              {step.id === 'google' && <GoogleStep plan={plan} step={step} text={text} recheckButton={recheckButton} />}

              {step.id === 'tracking' && (
                <>
                  <Lead>{t('wizard.tracking_desc')}</Lead>
                  <TrackingRows plan={plan} step={step} text={text} />
                  {step.open.length > 0 && <Actions>{recheckButton(step.open.some(b => FROM_AUDIT.includes(b.id)))}</Actions>}
                </>
              )}

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

              {backToCurrent && <Actions>{backToCurrent}</Actions>}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Ce schimbă */}
        <aside className="relative overflow-hidden border-t border-neutral-100 bg-neutral-50/70 p-6 sm:p-7 lg:border-l lg:border-t-0">
          <DotPattern className="text-neutral-300/60 [mask-image:radial-gradient(240px_circle_at_top_right,white,transparent)]" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={shown} className="relative"
              initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: EASE }}>
              <Aside step={step.id} plan={plan} store={store} percent={percent} budgetDraft={budgetDraft} f={f} />
            </motion.div>
          </AnimatePresence>
        </aside>
      </div>

      <LaunchSteps open={busy === 'launch'} title={t('wizard.launching_title')} hint={t('wizard.launching_wait')}
        steps={[t('wizard.launching_1'), t('wizard.launching_2'), t('wizard.launching_3'), t('wizard.launching_4')]} />
    </section>
  )
}

// ── Bucăți comune ────────────────────────────────────────────────────────────

function StepDot({ state, n }: { state: StepState; n: number }) {
  const reduce = useReducedMotion()
  return (
    <span className="relative flex size-7 shrink-0 items-center justify-center">
      {state === 'current' && !reduce && (
        <motion.span aria-hidden className="absolute inset-0 rounded-full bg-neutral-900/15"
          animate={{ scale: [1, 1.6], opacity: [0.55, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }} />
      )}
      {state === 'done' ? (
        <span className="flex size-7 items-center justify-center rounded-full bg-neutral-950 text-white"><DrawnCheck className="size-3.5" /></span>
      ) : (
        <span className={cn('flex size-7 items-center justify-center rounded-full bg-white text-[12px] font-semibold tabular-nums',
          state === 'current' ? 'text-neutral-950 ring-2 ring-neutral-950' : 'text-neutral-400 ring-1 ring-neutral-300')}>{n}</span>
      )}
    </span>
  )
}

function StepHeader({ step, total }: { step: SetupStep; total: number }) {
  const { t } = useT()
  const Icon = step.icon
  return (
    <div className="flex items-center gap-4">
      <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl [&_svg]:size-5',
        step.state === 'done' ? 'bg-neutral-100 text-neutral-500 ring-1 ring-inset ring-neutral-200' : 'bg-neutral-950 text-white shadow-[0_12px_28px_-12px_rgb(0_0_0/0.6)]')}>
        <Icon />
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[12px] font-medium text-neutral-400">
          {t('wizard.step_of', { n: String(step.index + 1), total: String(total) })}
          {step.state === 'done' && <span className="inline-flex items-center gap-1 text-emerald-600"><Check className="size-3" strokeWidth={3} />{t('wizard.state_done')}</span>}
        </p>
        <h3 className="text-[21px] font-semibold tracking-[-0.025em] text-neutral-950">{t(`wizard.${step.id}_title`)}</h3>
      </div>
    </div>
  )
}

function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-neutral-600">{children}</p>
}

function Label({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-neutral-400">{children}</p>
      {aside}
    </div>
  )
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">{children}</div>
}

/** Locul acțiunii de acum: conturat, cu raza care îl înconjoară ca să atragă privirea. */
function ActionBox({ beam, className, children }: { beam: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={cn('relative mt-6 overflow-hidden rounded-2xl border bg-white p-5', beam ? 'border-neutral-300 shadow-raised' : 'border-neutral-200', className)}>
      {children}
      {beam && <BorderBeam />}
    </div>
  )
}

function DoneRow({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3.5 text-[13.5px] text-neutral-700">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white"><DrawnCheck className="size-3.5" /></span>
      {children}
    </p>
  )
}

// ── Pașii ─────────────────────────────────────────────────────────────────────

function GoogleStep({ plan, step, text, recheckButton }: { plan: Plan; step: SetupStep; text: (b: Blocker) => string; recheckButton: (withAudit: boolean) => ReactNode }) {
  const { t } = useT()
  const b = step.open[0] ?? null
  return (
    <>
      <Lead>{t('wizard.google_desc')}</Lead>
      {b ? (
        <ActionBox beam={step.state === 'current'}>
          <p className="text-[14.5px] font-medium text-neutral-900">{text(b)}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
            {FROM_AUDIT.includes(b.id) ? recheckButton(true) : (
              <Button asChild variant="primary" size="lg">
                <Link href="/settings?tab=integrations">
                  {t(b.id === 'google_ads' ? 'wizard.google_connect' : b.id === 'ads_account' ? 'wizard.google_choose' : 'wizard.google_fix')}<ArrowRight />
                </Link>
              </Button>
            )}
            {b.id === 'google_ads' && (
              <a href="https://ads.google.com/" target="_blank" rel="noopener" className={cn(linkStyles, 'inline-flex items-center gap-1 text-[13px]')}>
                {t('wizard.google_no_account')}<ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </ActionBox>
      ) : (
        <DoneRow>{t('wizard.google_done', { account: plan.campaign.account ? (plan.campaign.account.name || customerId(plan.campaign.account.customer_id)) : '—' })}</DoneRow>
      )}
    </>
  )
}

function TrackingRows({ plan, step, text }: { plan: Plan; step: SetupStep; text: (b: Blocker) => string }) {
  const { t } = useT()
  const rows = (['merchant', 'conversion'] as const).map(id => {
    const ids = id === 'merchant'
      ? ['merchant', 'merchant_not_linked', 'merchant_other', 'merchant_choose']
      : ['conversion', 'purchase_missing', 'purchase_not_primary', 'purchase_no_value']
    return { id, status: plan.campaign[id], blocker: step.open.find(b => ids.includes(b.id)) ?? null }
  })
  return (
    <ActionBox beam={step.state === 'current'} className="p-0">
      <ul className="divide-y divide-neutral-100">
        {rows.map(r => {
          const ok = !r.blocker && r.status.status === 'ok'
          return (
            <li key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                {r.blocker
                  ? <span className="mt-0.5 size-6 shrink-0 rounded-full border-2 border-dashed border-neutral-300" />
                  : <span className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full', ok ? 'bg-neutral-950 text-white' : 'bg-neutral-200 text-neutral-600')}><DrawnCheck className="size-3.5" /></span>}
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-neutral-900">{t(`wizard.tracking_${r.id}`)}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-neutral-500">
                    {r.blocker ? text(r.blocker)
                      : ok ? (r.status.via ? t('wizard.tracking_ok_via', { via: r.status.via }) : t('wizard.tracking_ok'))
                      : t('wizard.tracking_unverified')}
                  </p>
                </div>
              </div>
              {r.blocker && !FROM_AUDIT.includes(r.blocker.id) && (
                <Button asChild size="sm" variant={step.state === 'current' ? 'primary' : 'secondary'} className="self-start sm:self-auto">
                  {r.blocker.external
                    ? <a href={r.blocker.href} target="_blank" rel="noopener">{t('wizard.tracking_fix')}<ExternalLink /></a>
                    : <Link href={r.blocker.href}>{t('wizard.tracking_fix')}<ArrowRight /></Link>}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </ActionBox>
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
      <div className="mt-6 max-w-xl">
        <div className="flex items-baseline justify-between gap-3 text-[13px]">
          <span className="font-medium text-neutral-800">{t(econ.cost_basis === 'catalog' ? 'wizard.costs_coverage_catalog' : 'wizard.costs_coverage_sales', { pct: String(coverage) })}</span>
          <span className="text-[12px] text-neutral-400">{t('wizard.costs_needed')}</span>
        </div>
        <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
          <motion.div className="h-full rounded-full bg-neutral-950" initial={{ width: 0 }} animate={{ width: `${Math.min(100, coverage)}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
          <span aria-hidden className="absolute inset-y-0 w-px bg-neutral-400" style={{ left: `${MIN_COST_COVERAGE * 100}%` }} />
        </div>
      </div>

      {other.map(b => (
        <Callout key={b.id} tone="warning" className="mt-5" action={<Button asChild size="sm"><Link href={b.href}>{t('wizard.tracking_fix')}<ArrowRight /></Link></Button>}>
          {text(b)}
        </Callout>
      ))}

      {costsBlocker || missing > 0 ? (
        <ActionBox beam={step.state === 'current' && !!costsBlocker}>
          <Label aside={<span className="text-[26px] font-semibold tabular-nums tracking-[-0.03em] text-neutral-950">{percent}%</span>}>
            {t('wizard.costs_estimate_title')}
          </Label>
          <p className="mt-1 text-[13.5px] text-neutral-600">{t('wizard.costs_estimate_value', { pct: String(percent) })}</p>
          <input type="range" min={10} max={90} step={5} value={percent} onChange={e => onPercent(Number(e.target.value))}
            aria-label={t('wizard.costs_estimate_slider')} disabled={disabled || busy}
            className="range-mono mt-5 h-6 w-full" style={{ '--pct': `${((percent - 10) / 80) * 100}%` } as React.CSSProperties} />
          <div className="mt-1 flex justify-between text-[11px] tabular-nums text-neutral-400"><span>10%</span><span>50%</span><span>90%</span></div>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button variant="primary" size="lg" loading={busy} disabled={disabled || missing === 0} onClick={onApply}>
              {!busy && <Check />}{missing > 0 ? t('wizard.costs_apply', { count: missing }) : t('wizard.costs_apply_none')}
            </Button>
            <Link href="/products?view=no_cost" className={cn(textActionStyles, 'text-[13px]')}>{t('wizard.costs_exact')}<ArrowRight /></Link>
          </div>
          <p className="mt-3 text-[12px] text-neutral-400">{t('wizard.costs_estimate_hint')}</p>
        </ActionBox>
      ) : null}

      {!costsBlocker && econ.margin !== null && econ.break_even !== null && (
        <DoneRow>{t('wizard.costs_done', { pct: String(Math.round(econ.margin * 100)), roas: f.num.format(econ.break_even) })}</DoneRow>
      )}
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
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2.5 text-[13px] text-neutral-700"><Lock className="size-4 shrink-0 text-neutral-400" />{t('wizard.launch_locked', { step: t(`wizard.${locked}_title`) })}</p>
          <Button size="sm" onClick={onGoTo}>{t('wizard.launch_go')}<ArrowRight /></Button>
        </div>
      )}

      {/* Obiectivul */}
      <div className="mt-7">
        <Label aside={busy === 'goal' ? <Loader2 className="size-3.5 animate-spin text-neutral-400" /> : undefined}>{t('wizard.goal_label')}</Label>
        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {GOALS.map(g => {
            const active = plan.goal === g
            const target = plan.targets[g]
            return (
              <button key={g} type="button" onClick={() => onGoal(g)} disabled={!!busy} aria-pressed={active}
                className={cn('group relative flex flex-col rounded-2xl border p-4 text-left transition-[border-color,box-shadow] duration-150 disabled:cursor-not-allowed',
                  active ? 'border-transparent' : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-card')}>
                {active && (
                  <motion.span aria-hidden layoutId={`${uid}-goal`} className="absolute inset-0 rounded-2xl bg-neutral-950 shadow-[0_14px_30px_-14px_rgb(0_0_0/0.6)]"
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 40 }} />
                )}
                <span className="relative flex items-center justify-between gap-2">
                  <span className={cn('text-[14px] font-semibold', active ? 'text-white' : 'text-neutral-900')}>{t(`campaigns.goal_${g}`)}</span>
                  {g === 'balanced' && <Badge tone={active ? 'neutral' : 'brand'}>{t('campaigns.recommended')}</Badge>}
                </span>
                <span className={cn('relative mt-1.5 text-[12px] leading-relaxed', active ? 'text-white/65' : 'text-neutral-500')}>
                  {t(`campaigns.goal_${g}_desc`, { keep: String(Math.round(GOAL_KEEP[g] * 100)) })}
                </span>
                {target !== null && (
                  <span className={cn('relative mt-auto pt-3 text-[12px] font-semibold tabular-nums', active ? 'text-white' : 'text-neutral-700')}>
                    {t('wizard.goal_target', { roas: f.num.format(target) })}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Bugetul */}
      <BudgetSlider plan={plan} f={f} draft={budgetDraft} onDraft={onBudgetDraft} saving={busy === 'budget'} disabled={!!busy && busy !== 'budget'} onSave={onBudget} />

      {/* Ce se lansează */}
      <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-neutral-500">
        <span className="font-medium text-neutral-700">{t('wizard.summary_title')}:</span>
        <span>{t(plan.stage.id === 'starter' ? 'campaigns.type_shopping' : 'campaigns.type_pmax')}</span>
        <span className="text-neutral-300">·</span>
        <span>{t('wizard.summary_products', { count: f.int.format(plan.counts.included) })}</span>
        {place && <><span className="text-neutral-300">·</span><span>{t('wizard.summary_where', { place })}</span></>}
        <InfoTip>{t(plan.stage.id === 'starter' ? 'campaigns.launch_card_starter' : 'campaigns.launch_card_growth', {
          products: f.int.format(plan.counts.included),
          budget: plan.budget.daily !== null ? f.money.format(plan.budget.daily) : '—',
        })}</InfoTip>
      </p>

      {/* Verificarea contului */}
      {hasAccount && !locked && (
        <div className="mt-7 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-neutral-500" />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 text-[14px] font-semibold text-neutral-900">
                  {t('wizard.audit_title')}
                  {audit && !audit.error && <span className="text-[12px] font-normal text-neutral-400">{t('wizard.audit_checked', { when: f.dateTime.format(new Date(audit.checked_at)) })}</span>}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-neutral-500">{t('wizard.audit_desc')}</p>
              </div>
            </div>
            <Button size="sm" variant={result ? 'secondary' : 'primary'} loading={busy === 'audit'} disabled={!!busy && busy !== 'audit'} onClick={onAudit} className="shrink-0 self-start">
              {busy !== 'audit' && <RefreshCw />}{busy === 'audit' ? t('wizard.audit_running') : result ? t('campaigns.audit_again') : t('wizard.audit_run')}
            </Button>
          </div>
          {audit?.error && <Callout tone="danger" className="mt-3">{translateStored(t, audit.error)}</Callout>}
          {result && !audit?.error && (
            <div className="mt-3 space-y-2 border-t border-neutral-200/70 pt-3">
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
      <div className="mt-8 flex flex-col gap-4 border-t border-neutral-100 pt-7 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-[12.5px] leading-relaxed text-neutral-500">{waiting ?? t('wizard.launch_note')}</p>
        <SlideCommit label={t('wizard.slide_label')} doneLabel={t('wizard.slide_done')} errorLabel={t('wizard.slide_error')} workingLabel={t('wizard.launching_title')}
          disabled={!ready || (!!busy && busy !== 'launch')} onConfirm={onLaunch} width={300} />
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
    return (
      <div className="mt-7">
        <Label>{t('wizard.budget_label')}</Label>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">{t('wizard.budget_after_costs')}</p>
      </div>
    )
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
    <div className="mt-7">
      <Label aside={saving ? <Loader2 className="size-3.5 animate-spin text-neutral-400" /> : undefined}>{t('wizard.budget_label')}</Label>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[32px] font-semibold tabular-nums leading-none tracking-[-0.035em] text-neutral-950">{f.money.format(value)}</span>
        <span className="text-[13px] text-neutral-500">{t('wizard.budget_per_day')} · {t('wizard.budget_month', { amount: f.money.format(value * DAYS_PER_MONTH) })}</span>
      </div>
      <div className="relative mt-5">
        <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
          aria-label={t('wizard.budget_label')} aria-valuetext={f.money.format(value)}
          onChange={e => onDraft(Number(e.target.value))}
          onPointerUp={commit} onKeyUp={commit} onBlur={commit}
          className="range-mono h-6 w-full" style={{ '--pct': `${pct}%` } as React.CSSProperties} />
        {suggestedPct !== null && (
          <span aria-hidden className="pointer-events-none absolute top-[30px] -translate-x-1/2 text-[10.5px] font-medium text-neutral-500" style={{ left: `${suggestedPct}%` }}>
            <span className="mx-auto mb-0.5 block h-1.5 w-px bg-neutral-400" />{t('wizard.budget_suggested_mark')}
          </span>
        )}
      </div>
      <div className="mt-7 flex justify-between text-[11px] tabular-nums text-neutral-400"><span>{f.money.format(min)}</span><span>{f.money.format(max)}</span></div>
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

// ── Dreapta: ce schimbă pasul ────────────────────────────────────────────────

function Aside({ step, plan, store, percent, budgetDraft, f }: { step: StepId; plan: Plan; store: WizardStore; percent: number; budgetDraft: number | null; f: Formats }) {
  const { t } = useT()
  switch (step) {
    case 'store':
      return (
        <AsideBlock title={t('wizard.aside_store_title')}>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <BigStat label={t('wizard.store_products')} value={<NumberTicker value={store.offers} format={n => f.int.format(Math.round(n))} />} />
            {store.orders !== null && <BigStat label={t('wizard.store_orders')} value={<NumberTicker value={store.orders} format={n => f.int.format(Math.round(n))} />} />}
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed text-neutral-500">{t('wizard.aside_store_desc')}</p>
        </AsideBlock>
      )
    case 'google':
      return <AsideFacts title={t('wizard.aside_google_title')} facts={[t('wizard.aside_google_1'), t('wizard.aside_google_2'), t('wizard.aside_google_3')]} />
    case 'tracking':
      return <AsideFacts title={t('wizard.aside_tracking_title')} facts={[t('wizard.aside_tracking_1'), t('wizard.aside_tracking_2'), t('wizard.aside_tracking_3')]} />
    case 'costs': {
      const econ = plan.economics
      // Ca în planul campaniei: profitul vânzării, fără TVA și reduceri, față de valoarea raportată
      const margin = 1 - percent / 100
      const net = margin - econ.discount_pct / 100
      const be = net > 0 ? ((1 + econ.vat_pct / 100) * econ.value_ratio) / net : null
      return (
        <AsideBlock title={t('wizard.aside_costs_title', { pct: String(percent) })}>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <BigStat label={t('wizard.aside_costs_margin')} value={`${Math.round(margin * 100)}%`} />
            <BigStat label={t('wizard.aside_costs_be')} value={be === null ? '—' : `≈ ${f.num.format(Math.round(be * 10) / 10)}`} />
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed text-neutral-500">{t('wizard.aside_costs_desc')}</p>
        </AsideBlock>
      )
    }
    case 'launch':
      return <ForecastAside plan={plan} draft={budgetDraft} f={f} />
  }
}

function AsideBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-neutral-400">{title}</p>
      {children}
    </div>
  )
}

function AsideFacts({ title, facts }: { title: string; facts: string[] }) {
  return (
    <AsideBlock title={title}>
      <ul className="mt-4 space-y-3.5">
        {facts.map((fact, i) => (
          <li key={fact} className="flex gap-3 text-[13px] leading-relaxed text-neutral-600">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-neutral-500 ring-1 ring-neutral-200">{i + 1}</span>
            {fact}
          </li>
        ))}
      </ul>
    </AsideBlock>
  )
}

function BigStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-3.5 ring-1 ring-neutral-200/80">
      <p className="text-[11.5px] text-neutral-500">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums leading-tight tracking-[-0.03em] text-neutral-950">{value}</p>
    </div>
  )
}

/** Estimarea pe lună: urmează glisorul de buget (din plan, cât nu e tras). */
function ForecastAside({ plan, draft, f }: { plan: Plan; draft: number | null; f: Formats }) {
  const { t } = useT()
  const { target_roas: target, economics } = plan
  const forecast = draft !== null && target !== null && economics.break_even !== null
    ? forecastFor(draft, target, economics.break_even, economics.aov)
    : plan.forecast
  return (
    <AsideBlock title={t('wizard.forecast_title')}>
      {forecast ? (
        <>
          <div className="relative mt-4 overflow-hidden rounded-2xl bg-neutral-950 p-4 text-white shadow-[0_18px_40px_-20px_rgb(0_0_0/0.7)]">
            <DotPattern className="text-white/[0.08] [mask-image:radial-gradient(220px_circle_at_top_right,white,transparent)]" />
            <p className="relative text-[11.5px] text-white/55">{t('wizard.forecast_profit')}</p>
            <p className="relative mt-1 text-[30px] font-semibold tabular-nums leading-none tracking-[-0.035em]">
              <NumberTicker value={forecast.profit} format={n => f.money.format(Math.round(n))} />
            </p>
            <p className="relative mt-1 text-[11.5px] text-white/45">{t('wizard.forecast_per_month')}</p>
          </div>
          <dl className="mt-3 space-y-2 text-[13px]">
            {[
              { label: t('wizard.forecast_revenue'), value: f.money.format(forecast.revenue) },
              { label: t('wizard.forecast_spend'), value: f.money.format(forecast.spend) },
              ...(forecast.orders !== null ? [{ label: t('wizard.forecast_orders'), value: `~${f.int.format(forecast.orders)}` }] : []),
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between gap-3">
                <dt className="text-neutral-500">{r.label}</dt>
                <dd className="font-medium tabular-nums text-neutral-900">{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 flex gap-2 text-[11.5px] leading-relaxed text-neutral-400"><Info className="mt-px size-3.5 shrink-0" />{t('wizard.forecast_note')}</p>
        </>
      ) : (
        <p className="mt-4 text-[13px] leading-relaxed text-neutral-500">{t('campaigns.econ_need_costs', { pct: String(Math.round(plan.economics.cost_coverage * 100)) })}</p>
      )}
    </AsideBlock>
  )
}

