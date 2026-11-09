'use client'

import { useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertTriangle, ArrowLeft, ArrowRight, Calculator, Check, CircleCheck, ExternalLink, Info, Lock, Megaphone, Pencil, RefreshCw,
  Rocket, ScanBarcode, ShieldCheck, Store, type LucideIcon,
} from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import { cn } from '@/lib/utils'
import { Card } from '@/components/app/surface'
import { Button, linkStyles, textActionStyles } from '@/components/app/button'
import { Badge } from '@/components/app/badge'
import { Callout } from '@/components/app/feedback'
import { Input } from '@/components/app/input'
import { InfoTip } from '@/components/app/info-tip'
import { NumberTicker } from '@/components/app/motion'
import { BorderBeam, ConfettiBurst, DotPattern, DrawnCheck, LaunchSteps, ProgressCircle, ShimmerButton } from '@/components/app/effects'
import { AccountChoices, choicesDone as choicesMade, type Overlap } from '@/components/campaigns/account-choices'
import type { AuditData } from '@/components/campaigns/types'
import type { Formats } from '@/components/app/formats'
import { DAYS_PER_MONTH, GOAL_KEEP, GOALS, MIN_COST_COVERAGE, type BlockerId, type Goal, type Plan } from '@/lib/campaigns/plan'

// =============================================
// Asistentul de lansare de pe Dashboard: drumul de la magazinul conectat la
// prima campanie, într-un singur loc. Cinci pași, în ordinea în care se fac;
// pasul de acum e deschis și are un singur buton, cei făcuți au bifă, iar
// ultimul (obiectivul, bugetul, verificarea contului și lansarea) se face
// chiar aici. Pașii se citesc din planul campaniei (`plan.blockers`), deci
// spun același lucru ca pagina Campanii.
// =============================================

type StepId = 'store' | 'google' | 'tracking' | 'costs' | 'launch'

const STEPS: { id: StepId; icon: LucideIcon; blockers: readonly BlockerId[] }[] = [
  { id: 'store', icon: Store, blockers: ['store'] },
  { id: 'google', icon: Megaphone, blockers: ['google_ads', 'ads_account', 'currency', 'account_manager'] },
  {
    id: 'tracking', icon: ScanBarcode,
    blockers: ['merchant', 'merchant_not_linked', 'merchant_other', 'merchant_choose', 'conversion', 'purchase_missing', 'purchase_not_primary', 'purchase_no_value'],
  },
  { id: 'costs', icon: Calculator, blockers: ['costs', 'no_offers', 'too_many_exclusions'] },
  { id: 'launch', icon: Rocket, blockers: ['audit'] },
]

/** Pașii pe care îi spune auditul contului: după reparație, verificarea se reface ca să se vadă. */
const FROM_AUDIT: readonly BlockerId[] = ['account_manager', 'merchant_not_linked', 'merchant_other', 'merchant_choose', 'purchase_missing', 'purchase_not_primary', 'purchase_no_value']

type Blocker = Plan['blockers'][number]
type StepState = 'done' | 'current' | 'next'
type Note = { tone: 'success' | 'warning' | 'danger'; text: string; details?: string[] }

const EASE = [0.21, 0.47, 0.32, 0.98] as const

/** Magazinul, pentru primul pas; `orders` null = pagina nu-l știe (nu se arată). */
export type WizardStore = { name: string | null; offers: number; orders: number | null }

export function LaunchWizard({ plan, audit, store, f, continueLabel, onChanged, onLaunched }: {
  plan: Plan
  audit: AuditData | null
  store: WizardStore
  f: Formats
  /** Butonul de după lansare (implicit „Vezi Dashboard-ul"). */
  continueLabel?: string
  /** Recitește planul (și restul paginii) după o schimbare; întoarce planul nou (null = n-a mers). */
  onChanged: () => Promise<Plan | null>
  /** După ce omul vede reușita: pagina trece la cifrele campaniei. */
  onLaunched: (text: string) => void
}) {
  const { t, intlLocale } = useT()
  const reduce = useReducedMotion()
  const [picked, setPicked] = useState<StepId | null>(null)
  const [busy, setBusy] = useState<'recheck' | 'audit' | 'costs' | 'goal' | 'launch' | null>(null)
  const [note, setNote] = useState<Note | null>(null)
  const [overlap, setOverlap] = useState<Overlap>(null)
  const [declareEu, setDeclareEu] = useState(false)
  const [launched, setLaunched] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const steps = STEPS.map(s => ({ ...s, open: plan.blockers.filter(b => s.blockers.includes(b.id)) }))
  // Lansarea e mereu ultima: pasul de acum e primul de pregătire neterminat, altfel lansarea
  const firstOpen = steps.find(s => s.id !== 'launch' && s.open.length > 0) ?? null
  const current: StepId = firstOpen?.id ?? 'launch'
  const shown = picked ?? current
  const done = steps.filter(s => s.id !== 'launch' && !s.open.length).length
  const left = STEPS.length - done
  const stateOf = (id: StepId, open: number): StepState => (id === current ? 'current' : id !== 'launch' && !open ? 'done' : 'next')

  const blockerText = (b: Blocker) => {
    const params = Object.fromEntries(Object.entries(b.params ?? {}).map(([k, v]) => [k, String(v)]))
    const step = `${b.id}${b.variant ? `_${b.variant}` : ''}`
    return t.has(`campaigns.blocker_${step}`) ? t(`campaigns.blocker_${step}`, params)
      : t.has(`campaigns.blocker_${b.id}`) ? t(`campaigns.blocker_${b.id}`, params) : t('campaigns.blocker_generic')
  }

  /**
   * Omul spune că a reparat pasul în altă parte (Setări, Edinio, Google Ads): datele noi
   * și, dacă pasul vine din auditul contului, un audit nou. Dacă tot lipsește, o spunem.
   */
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
      setPicked(null)
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

  async function estimateCosts(percent: number) {
    setBusy('costs')
    setNote(null)
    try {
      const r = await fetch('/api/catalog/cost/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percent, only_missing: true }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        setNote({ tone: 'danger', text: body.error || t('wizard.costs_failed') })
        return
      }
      await onChanged()
      setPicked(null)
      setNote({ tone: 'success', text: t('wizard.costs_applied', { count: Number(body.updated) || 0 }) })
    } catch {
      setNote({ tone: 'danger', text: t('wizard.costs_failed') })
    } finally {
      setBusy(null)
    }
  }

  async function saveSettings(body: { goal?: Goal; daily_budget?: number | null }): Promise<boolean> {
    setNote(null)
    try {
      const r = await fetch('/api/campaigns/plan', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!r.ok) throw new Error()
      await onChanged()
      return true
    } catch {
      setNote({ tone: 'danger', text: t('campaigns.save_error') })
      return false
    }
  }

  async function chooseGoal(goal: Goal) {
    if (goal === plan.goal || busy) return
    setBusy('goal')
    await saveSettings({ goal })
    setBusy(null)
  }

  async function launch() {
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
        await onChanged()
        return
      }
      // Reușita rămâne pe ecran până trece omul mai departe; atunci pagina se reîncarcă
      setLaunched([t('campaigns.launch_done'), ...(body.warnings ?? [])].join(' '))
      requestAnimationFrame(() => cardRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }))
    } catch {
      setNote({ tone: 'danger', text: t('campaigns.launch_failed') })
    } finally {
      setBusy(null)
    }
  }

  const title = left <= 1 ? t('wizard.title_ready') : t('wizard.title_left', { count: left })

  if (launched) {
    return (
      <Card ref={cardRef} className="relative scroll-mt-24 overflow-hidden">
        <ConfettiBurst />
        <DotPattern className="text-neutral-300/60 [mask-image:radial-gradient(520px_circle_at_center,white,transparent)]" />
        <div className="relative flex flex-col items-center px-6 py-14 text-center">
          <motion.span initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="flex size-14 items-center justify-center rounded-2xl bg-neutral-950 text-white shadow-[0_18px_40px_-12px_rgb(0_0_0/0.5)]">
            <Rocket className="size-6" />
          </motion.span>
          <h2 className="mt-5 text-[24px] font-semibold tracking-[-0.025em] text-neutral-950">{t('wizard.launched_title')}</h2>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-neutral-500">{t('wizard.launched_desc')}</p>
          <Button variant="primary" size="lg" className="mt-6" onClick={() => onLaunched(launched)}>
            {continueLabel ?? t('wizard.launched_continue')}<ArrowRight />
          </Button>
        </div>
      </Card>
    )
  }

  const panel = (() => {
    const index = STEPS.findIndex(s => s.id === shown)
    const step = steps[index]
    const state = stateOf(step.id, step.open.length)
    const header = (
      <PanelHeader icon={step.icon} n={index + 1} total={STEPS.length} title={t(`wizard.${step.id}_title`)} state={state} />
    )
    const backToCurrent = picked && picked !== current && (
      <button onClick={() => setPicked(null)} className={cn(textActionStyles, 'text-[13px]')}>
        <ArrowLeft />{t('wizard.back_to_current')}
      </button>
    )
    const recheckButton = (withAudit: boolean) => (
      <Button onClick={() => recheck(step.id, withAudit)} loading={busy === 'recheck'} disabled={!!busy && busy !== 'recheck'}>
        {busy !== 'recheck' && <RefreshCw />}{busy === 'recheck' ? t('wizard.rechecking') : t('wizard.recheck')}
      </Button>
    )

    switch (step.id) {
      case 'store':
        return (
          <>
            {header}
            <Lead>{state === 'done' ? t('wizard.store_done', { store: store.name || '—' }) : t('wizard.store_todo')}</Lead>
            <dl className={cn('mt-5 grid gap-px overflow-hidden rounded-xl bg-neutral-200/70 ring-1 ring-neutral-200/70', store.orders === null ? 'max-w-[180px] grid-cols-1' : 'max-w-sm grid-cols-2')}>
              {[{ label: t('wizard.store_products'), value: store.offers }, ...(store.orders === null ? [] : [{ label: t('wizard.store_orders'), value: store.orders }])].map(s => (
                <div key={s.label} className="bg-white px-4 py-3">
                  <dt className="text-[12px] text-neutral-500">{s.label}</dt>
                  <dd className="mt-0.5 text-[20px] font-semibold tabular-nums tracking-[-0.02em] text-neutral-950">
                    <NumberTicker value={s.value} format={n => f.int.format(Math.round(n))} />
                  </dd>
                </div>
              ))}
            </dl>
            <Actions>
              {state !== 'done' && <Button asChild variant="primary" size="lg"><Link href="/settings?tab=integrations">{t('wizard.store_action')}<ArrowRight /></Link></Button>}
              {backToCurrent}
            </Actions>
          </>
        )

      case 'google': {
        const b = step.open[0] ?? null
        const fromAudit = !!b && FROM_AUDIT.includes(b.id)
        return (
          <>
            {header}
            <Lead>{t('wizard.google_desc')}</Lead>
            {b ? (
              <ActionBox beam={state === 'current'}>
                <p className="text-[14px] font-medium text-neutral-900">{blockerText(b)}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {fromAudit ? recheckButton(true) : (
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
            {backToCurrent && <Actions>{backToCurrent}</Actions>}
          </>
        )
      }

      case 'tracking': {
        const rows = (['merchant', 'conversion'] as const).map(id => {
          const status = plan.campaign[id]
          const ids: readonly BlockerId[] = id === 'merchant'
            ? ['merchant', 'merchant_not_linked', 'merchant_other', 'merchant_choose']
            : ['conversion', 'purchase_missing', 'purchase_not_primary', 'purchase_no_value']
          return { id, status, blocker: step.open.find(b => ids.includes(b.id)) ?? null }
        })
        const needsAudit = step.open.some(b => FROM_AUDIT.includes(b.id))
        return (
          <>
            {header}
            <Lead>{t('wizard.tracking_desc')}</Lead>
            <ActionBox beam={state === 'current'} className="p-0">
              <ul className="divide-y divide-neutral-100">
                {rows.map(r => {
                  const ok = !r.blocker && r.status.status === 'ok'
                  const unverified = !r.blocker && r.status.status === 'unverified'
                  return (
                    <li key={r.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <StatusIcon tone={r.blocker ? 'todo' : unverified ? 'soft' : 'done'} />
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-medium text-neutral-900">{t(`wizard.tracking_${r.id}`)}</p>
                          <p className="mt-0.5 text-[12.5px] leading-relaxed text-neutral-500">
                            {r.blocker ? blockerText(r.blocker)
                              : ok ? (r.status.via ? t('wizard.tracking_ok_via', { via: r.status.via }) : t('wizard.tracking_ok'))
                              : t('wizard.tracking_unverified')}
                          </p>
                        </div>
                      </div>
                      {r.blocker && !FROM_AUDIT.includes(r.blocker.id) && (
                        <Button asChild size="sm" variant={state === 'current' ? 'primary' : 'secondary'} className="self-start sm:self-auto">
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
            <Actions>
              {step.open.length > 0 && recheckButton(needsAudit)}
              {backToCurrent}
            </Actions>
          </>
        )
      }

      case 'costs':
        return (
          <>
            {header}
            <Lead>{t('wizard.costs_desc')}</Lead>
            <CostsStep plan={plan} open={step.open} beam={state === 'current'} busy={busy === 'costs'} disabled={!!busy && busy !== 'costs'}
              f={f} blockerText={blockerText} onEstimate={estimateCosts} />
            {backToCurrent && <Actions>{backToCurrent}</Actions>}
          </>
        )

      case 'launch': {
        const locked = firstOpen
        const result = audit?.result ?? null
        const hasAccount = !!plan.campaign.account
        const choicesDone = choicesMade(result, overlap, declareEu)
        const ready = !locked && plan.blockers.length === 0 && !!result && !audit?.error && choicesDone
        const waiting = locked ? null
          : !result || audit?.error ? t('wizard.launch_wait_audit')
          : !choicesDone ? t('wizard.launch_wait_choices') : null
        // Blocajele au pașii lor; campaniile suprapuse și declarația UE au întrebările de mai jos
        const asked = new Set([...(result?.overlap.length ? ['overlap'] : []), ...(result?.eu_undeclared.length ? ['eu_undeclared'] : [])])
        const checks = (result?.checks ?? []).filter(c => c.id !== 'currency_mismatch' && c.level !== 'blocker' && !asked.has(c.id))
        const place = placeOf(plan, intlLocale)
        return (
          <>
            {header}
            <Lead>{t('wizard.launch_desc')}</Lead>

            {locked && (
              <div className="mt-5 flex flex-col gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2.5 text-[13px] text-neutral-700">
                  <Lock className="size-4 shrink-0 text-neutral-400" />
                  {t('wizard.launch_locked', { step: t(`wizard.${locked.id}_title`) })}
                </p>
                <Button size="sm" onClick={() => setPicked(null)}>{t('wizard.launch_go')}<ArrowRight /></Button>
              </div>
            )}

            {/* Obiectivul */}
            <section className="mt-6">
              <SectionLabel>{t('wizard.goal_label')}</SectionLabel>
              <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {GOALS.map(g => {
                  const active = plan.goal === g
                  const target = plan.targets[g]
                  return (
                    <button key={g} type="button" onClick={() => chooseGoal(g)} disabled={!!busy} aria-pressed={active}
                      className={cn('group relative flex flex-col rounded-xl border bg-white p-3.5 text-left transition-[border-color,box-shadow] duration-150 disabled:cursor-not-allowed',
                        active ? 'border-neutral-950 ring-1 ring-neutral-950' : 'border-neutral-200 hover:border-neutral-300 hover:shadow-card')}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[13.5px] font-semibold text-neutral-900">{t(`campaigns.goal_${g}`)}</span>
                        {g === 'balanced'
                          ? <Badge tone="brand">{t('campaigns.recommended')}</Badge>
                          : active && <span className="flex size-4 items-center justify-center rounded-full bg-neutral-950 text-white"><Check className="size-2.5" strokeWidth={3.5} /></span>}
                      </span>
                      <span className="mt-1 text-[12px] leading-relaxed text-neutral-500">{t(`campaigns.goal_${g}_desc`, { keep: String(Math.round(GOAL_KEEP[g] * 100)) })}</span>
                      {target !== null && (
                        <span className="mt-auto pt-2.5 text-[12px] font-medium tabular-nums text-neutral-700">{t('wizard.goal_target', { roas: f.num.format(target) })}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Bugetul și ce ar aduce */}
            <section className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <BudgetCard plan={plan} f={f} disabled={!!busy} onSave={value => saveSettings({ daily_budget: value })} />
              <ForecastCard plan={plan} f={f} />
            </section>

            {/* Ce se lansează */}
            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-neutral-500">
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

            {/* Verificarea contului Google Ads, înainte de lansare */}
            {hasAccount && !locked && (
              <section className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-neutral-500" />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 text-[13.5px] font-semibold text-neutral-900">
                        {t('wizard.audit_title')}
                        {audit && !audit.error && <span className="text-[12px] font-normal text-neutral-400">{t('wizard.audit_checked', { when: f.dateTime.format(new Date(audit.checked_at)) })}</span>}
                      </p>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-neutral-500">{t('wizard.audit_desc')}</p>
                    </div>
                  </div>
                  <Button size="sm" variant={result ? 'secondary' : 'primary'} loading={busy === 'audit'} disabled={!!busy && busy !== 'audit'} onClick={runAudit} className="shrink-0 self-start">
                    {busy !== 'audit' && <RefreshCw />}{busy === 'audit' ? t('wizard.audit_running') : result ? t('campaigns.audit_again') : t('wizard.audit_run')}
                  </Button>
                </div>
                {audit?.error && <Callout tone="danger" className="mt-3">{translateStored(t, audit.error)}</Callout>}
                {result && !audit?.error && (
                  <div className="mt-3 space-y-2 border-t border-neutral-200/70 pt-3">
                    {!checks.length && <p className="flex items-center gap-2 text-[13px] text-emerald-700"><CircleCheck className="size-4" />{t('wizard.audit_ok')}</p>}
                    {checks.map(c => (
                      <p key={c.id} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-neutral-600">
                        {c.level === 'info' ? <Info className="mt-0.5 size-3.5 shrink-0 text-neutral-400" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />}
                        <span>{t.has(`campaigns.check_${c.id}`) ? t(`campaigns.check_${c.id}`, Object.fromEntries(Object.entries(c.params ?? {}).map(([k, v]) => [k, String(v)]))) : c.id}</span>
                      </p>
                    ))}
                    {(result.overlap.length > 0 || result.eu_undeclared.length > 0) && (
                      <div className="pt-2">
                        <AccountChoices result={result} overlap={overlap} onOverlap={setOverlap} declareEu={declareEu} onDeclareEu={setDeclareEu} />
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Lansarea */}
            <div className="mt-6 flex flex-col gap-3 border-t border-neutral-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-[12.5px] leading-relaxed text-neutral-500">{waiting ?? t('wizard.launch_note')}</p>
              <ShimmerButton onClick={launch} disabled={!ready || !!busy} className="w-full sm:w-auto">
                <Rocket className="size-4" />{t('wizard.launch_button')}
              </ShimmerButton>
            </div>
            {backToCurrent && <Actions>{backToCurrent}</Actions>}
          </>
        )
      }
    }
  })()

  return (
    <Card ref={cardRef} className="relative scroll-mt-24 overflow-hidden">
      {/* Antetul: unde e omul pe drum */}
      <div className="relative overflow-hidden border-b border-neutral-100 px-5 py-6 sm:px-7">
        <DotPattern className="text-neutral-300/70 [mask-image:radial-gradient(460px_circle_at_top_right,white,transparent)]" />
        <div className="relative flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500 backdrop-blur-sm">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-neutral-900 opacity-40 motion-reduce:animate-none" />
                <span className="relative inline-flex size-1.5 rounded-full bg-neutral-900" />
              </span>
              {t('wizard.eyebrow')}
            </p>
            <h2 className="mt-3 text-[22px] font-semibold leading-tight tracking-[-0.025em] text-neutral-950 sm:text-[26px]">{title}</h2>
            <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-neutral-500">{t('wizard.subtitle')}</p>
          </div>
          <ProgressCircle value={done} max={STEPS.length} label={t('wizard.progress', { done: String(done), total: String(STEPS.length) })} className="hidden sm:flex" />
        </div>
      </div>

      <div className="grid lg:grid-cols-[288px_minmax(0,1fr)]">
        {/* Pașii */}
        <nav aria-label={t('wizard.eyebrow')} className="border-b border-neutral-100 p-3 lg:border-b-0 lg:border-r">
          <ol className="space-y-0.5">
            {steps.map((s, i) => {
              const state = stateOf(s.id, s.open.length)
              const active = shown === s.id
              return (
                <li key={s.id} className="relative">
                  {i < steps.length - 1 && (
                    <span aria-hidden className="absolute bottom-[-10px] left-[27px] top-[44px] w-px overflow-hidden bg-neutral-200">
                      <motion.span className="block w-full bg-neutral-900" initial={false} animate={{ height: state === 'done' ? '100%' : '0%' }}
                        transition={{ duration: reduce ? 0 : 0.5, ease: EASE }} />
                    </span>
                  )}
                  <button type="button" onClick={() => setPicked(s.id === current ? null : s.id)} aria-current={active ? 'step' : undefined}
                    className={cn('relative flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-600/20',
                      active ? 'bg-neutral-100/80' : 'hover:bg-neutral-50')}>
                    <StepDot state={state} n={i + 1} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn('text-[13.5px] font-medium leading-snug', state === 'done' && !active ? 'text-neutral-500' : 'text-neutral-900')}>{t(`wizard.${s.id}_title`)}</span>
                        {state === 'current' && <span className="shrink-0 rounded-full bg-neutral-950 px-1.5 py-px text-[10.5px] font-semibold text-white">{t('wizard.state_current')}</span>}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-neutral-500">{t(`wizard.${s.id}_short`)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        {/* Pasul deschis */}
        <div className="min-w-0 p-5 sm:p-7">
          {note && (
            <Callout tone={note.tone} onClose={() => setNote(null)} className="mb-5">
              <p>{note.text}</p>
              {note.details?.map(d => <p key={d} className="mt-1 break-all font-mono text-[11px] opacity-80">{d}</p>)}
            </Callout>
          )}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={shown}
              initial={reduce ? false : { opacity: 0, x: 14, filter: 'blur(3px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={reduce ? undefined : { opacity: 0, x: -14, filter: 'blur(3px)' }}
              transition={{ duration: 0.24, ease: EASE }}>
              {panel}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <LaunchSteps open={busy === 'launch'} title={t('wizard.launching_title')} hint={t('wizard.launching_wait')}
        steps={[t('wizard.launching_1'), t('wizard.launching_2'), t('wizard.launching_3'), t('wizard.launching_4')]} />
    </Card>
  )
}

// ── Bucățile pașilor ──────────────────────────────────────────────────────────

/** 1234567890 → 123-456-7890, cum îl arată Google Ads. */
function customerId(id: string): string {
  return id.length === 10 ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id
}

/** „România · română", din codurile campaniei, în limba paginii. */
function placeOf(plan: Plan, locale: string): string {
  const name = (type: 'region' | 'language', code: string | null) => {
    if (!code) return null
    try { return new Intl.DisplayNames([locale], { type }).of(code) ?? code } catch { return code }
  }
  return [name('region', plan.campaign.country), name('language', plan.campaign.language)].filter(Boolean).join(' · ')
}

function PanelHeader({ icon: Icon, n, total, title, state }: { icon: LucideIcon; n: number; total: number; title: string; state: StepState }) {
  const { t } = useT()
  return (
    <div className="flex items-center gap-4">
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl',
        state === 'done' ? 'bg-neutral-100 text-neutral-500 ring-1 ring-inset ring-neutral-200' : 'bg-neutral-950 text-white shadow-[0_10px_24px_-10px_rgb(0_0_0/0.55)]')}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[12px] font-medium text-neutral-400">
          {t('wizard.step_of', { n: String(n), total: String(total) })}
          {state === 'done' && <span className="inline-flex items-center gap-1 text-emerald-600"><Check className="size-3" strokeWidth={3} />{t('wizard.state_done')}</span>}
        </p>
        <h3 className="text-[19px] font-semibold tracking-[-0.02em] text-neutral-950">{title}</h3>
      </div>
    </div>
  )
}

function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-neutral-600">{children}</p>
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-neutral-400">{children}</p>
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">{children}</div>
}

/** Locul unde se face pasul de acum: conturat, cu raza care îl înconjoară ca să atragă privirea. */
function ActionBox({ beam, className, children }: { beam: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={cn('relative mt-5 overflow-hidden rounded-xl border bg-white p-4', beam ? 'border-neutral-300 shadow-raised' : 'border-neutral-200', className)}>
      {children}
      {beam && <BorderBeam />}
    </div>
  )
}

function DoneRow({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50/70 px-4 py-3 text-[13.5px] text-neutral-700">
      <StatusIcon tone="done" />{children}
    </p>
  )
}

function StatusIcon({ tone }: { tone: 'done' | 'soft' | 'todo' }) {
  if (tone === 'todo') return <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-neutral-300" />
  return (
    <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full', tone === 'done' ? 'bg-neutral-950 text-white' : 'bg-neutral-200 text-neutral-600')}>
      <Check className="size-3" strokeWidth={3} />
    </span>
  )
}

/** Cercul pasului din listă: bifă (gata), număr cu puls (acum) sau număr stins (urmează). */
function StepDot({ state, n }: { state: StepState; n: number }) {
  const reduce = useReducedMotion()
  return (
    <span className="relative z-10 mt-px flex size-[26px] shrink-0 items-center justify-center">
      {state === 'current' && !reduce && (
        <motion.span aria-hidden className="absolute inset-0 rounded-full bg-neutral-900/15"
          animate={{ scale: [1, 1.55], opacity: [0.6, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }} />
      )}
      <AnimatePresence mode="wait" initial={false}>
        {state === 'done' ? (
          <motion.span key="done" initial={reduce ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            className="flex size-[26px] items-center justify-center rounded-full bg-neutral-950 text-white">
            <DrawnCheck className="size-3.5" />
          </motion.span>
        ) : (
          <motion.span key="n" initial={false}
            className={cn('flex size-[26px] items-center justify-center rounded-full bg-white text-[12px] font-semibold tabular-nums',
              state === 'current' ? 'text-neutral-950 ring-2 ring-neutral-950' : 'text-neutral-400 ring-1 ring-neutral-300')}>
            {n}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

// ── Costurile ─────────────────────────────────────────────────────────────────

function CostsStep({ plan, open, beam, busy, disabled, f, blockerText, onEstimate }: {
  plan: Plan
  open: Blocker[]
  beam: boolean
  busy: boolean
  disabled: boolean
  f: Formats
  blockerText: (b: Blocker) => string
  onEstimate: (percent: number) => void
}) {
  const { t } = useT()
  const [percent, setPercent] = useState(60)
  const econ = plan.economics
  const coverage = Math.round(econ.cost_coverage * 100)
  const missing = plan.offers.filter(o => o.cost_price === null && o.price > 0).length
  const costsBlocker = open.find(b => b.id === 'costs') ?? null
  const other = open.filter(b => b.id !== 'costs')

  return (
    <>
      {/* Cât din vânzări are cost */}
      <div className="mt-5 max-w-xl">
        <div className="flex items-baseline justify-between gap-3 text-[13px]">
          <span className="font-medium text-neutral-800">
            {t(econ.cost_basis === 'catalog' ? 'wizard.costs_coverage_catalog' : 'wizard.costs_coverage_sales', { pct: String(coverage) })}
          </span>
          <span className="text-[12px] text-neutral-400">{t('wizard.costs_needed')}</span>
        </div>
        <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
          <motion.div className="h-full rounded-full bg-neutral-950" initial={{ width: 0 }} animate={{ width: `${Math.min(100, coverage)}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
          <span aria-hidden className="absolute inset-y-0 w-px bg-neutral-400" style={{ left: `${MIN_COST_COVERAGE * 100}%` }} />
        </div>
      </div>

      {other.map(b => (
        <Callout key={b.id} tone="warning" className="mt-4"
          action={<Button asChild size="sm"><Link href={b.href}>{t('wizard.tracking_fix')}<ArrowRight /></Link></Button>}>
          {blockerText(b)}
        </Callout>
      ))}

      {costsBlocker || missing > 0 ? (
        <ActionBox beam={beam && !!costsBlocker}>
          <p className="text-[14px] font-semibold text-neutral-900">{t('wizard.costs_estimate_title')}</p>
          <div className="mt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[13.5px] text-neutral-700">
                {t('wizard.costs_estimate_value', { pct: String(percent) })}
                <span className="text-neutral-400"> · {t('wizard.costs_estimate_margin', { pct: String(100 - percent) })}</span>
              </p>
              <span className="text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-neutral-950">{percent}%</span>
            </div>
            <input type="range" min={10} max={90} step={5} value={percent} onChange={e => setPercent(Number(e.target.value))}
              aria-label={t('wizard.costs_estimate_slider')} disabled={disabled || busy}
              className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-neutral-950 disabled:cursor-not-allowed" />
            <div className="mt-1 flex justify-between text-[11px] tabular-nums text-neutral-400"><span>10%</span><span>50%</span><span>90%</span></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button variant="primary" size="lg" loading={busy} disabled={disabled || missing === 0} onClick={() => onEstimate(percent)}>
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

// ── Bugetul și estimarea ──────────────────────────────────────────────────────

function parseAmount(text: string): number | null | 'invalid' {
  const raw = text.trim().replace(/\s/g, '').replace(',', '.')
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 'invalid'
}

function BudgetCard({ plan, f, disabled, onSave }: { plan: Plan; f: Formats; disabled: boolean; onSave: (value: number | null) => Promise<boolean> }) {
  const { t } = useT()
  const { budget } = plan
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')
  const custom = budget.chosen !== null

  async function save() {
    const value = parseAmount(text)
    if (value === 'invalid') { setState('error'); return }
    setState('saving')
    const ok = await onSave(value)
    setState('idle')
    if (ok) setEditing(false)
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{t('wizard.budget_label')}</SectionLabel>
        {!editing && (
          <button type="button" onClick={() => { setText(budget.daily !== null ? String(budget.daily).replace('.', ',') : ''); setState('idle'); setEditing(true) }}
            disabled={disabled} className={cn(textActionStyles, 'text-[12.5px] disabled:opacity-50')}>
            <Pencil />{t('wizard.budget_edit')}
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <Input autoFocus value={text} inputMode="decimal" aria-label={t('wizard.budget_label')} aria-invalid={state === 'error'} suffix={plan.campaign.currency}
              wrapperClassName="w-40" className="font-medium tabular-nums" placeholder={budget.suggested !== null ? String(budget.suggested) : ''}
              onChange={e => { setText(e.target.value); setState('idle') }}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }} />
            <Button size="sm" variant="primary" loading={state === 'saving'} onClick={save}>{t('wizard.budget_save')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>{t('wizard.budget_cancel')}</Button>
          </div>
          {state === 'error' && <p className="mt-1.5 text-[12px] text-red-600">{t('wizard.budget_invalid')}</p>}
        </div>
      ) : budget.daily === null ? (
        <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">{t('wizard.budget_after_costs')}</p>
      ) : (
        <>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-[28px] font-semibold tabular-nums leading-none tracking-[-0.03em] text-neutral-950">{f.money.format(budget.daily)}</span>
            <span className="text-[12px] text-neutral-500">{t(custom ? 'wizard.budget_custom' : 'wizard.budget_suggested')}</span>
          </p>
          {budget.daily !== null && <p className="mt-1.5 text-[12.5px] text-neutral-500">{t('wizard.budget_month', { amount: f.money.format(budget.daily * DAYS_PER_MONTH) })}</p>}
          {custom && budget.suggested !== null && budget.chosen !== budget.suggested && (
            <button type="button" onClick={() => onSave(null)} disabled={disabled} className={cn(linkStyles, 'mt-2 text-[12px]')}>
              {t('wizard.budget_reset', { budget: f.money.format(budget.suggested) })}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function ForecastCard({ plan, f }: { plan: Plan; f: Formats }) {
  const { t } = useT()
  const forecast = plan.forecast
  return (
    <div className="relative overflow-hidden rounded-xl bg-neutral-950 p-4 text-white">
      <DotPattern className="text-white/[0.07] [mask-image:radial-gradient(260px_circle_at_top_right,white,transparent)]" />
      <div className="relative">
        <div className="flex items-center gap-1.5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-white/50">{t('wizard.forecast_title')}</p>
          <InfoTip>{t('wizard.forecast_note')}</InfoTip>
        </div>
        {forecast ? (
          <>
            <p className="mt-2 text-[28px] font-semibold tabular-nums leading-none tracking-[-0.03em]">
              <NumberTicker value={forecast.profit} format={n => f.money.format(Math.round(n))} />
            </p>
            <p className="mt-1 text-[12px] text-white/50">{t('wizard.forecast_profit')}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3 text-[12.5px]">
              <div><dt className="text-white/50">{t('wizard.forecast_revenue')}</dt><dd className="mt-0.5 font-medium tabular-nums">{f.money.format(forecast.revenue)}</dd></div>
              <div><dt className="text-white/50">{t('wizard.forecast_spend')}</dt><dd className="mt-0.5 font-medium tabular-nums">{f.money.format(forecast.spend)}</dd></div>
            </dl>
          </>
        ) : (
          <p className="mt-3 text-[13px] leading-relaxed text-white/60">{t('campaigns.econ_need_costs', { pct: String(Math.round(plan.economics.cost_coverage * 100)) })}</p>
        )}
      </div>
    </div>
  )
}
