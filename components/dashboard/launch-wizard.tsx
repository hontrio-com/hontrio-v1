'use client'

import { useId, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleCheck, ExternalLink, Info, Loader2, Lock, RefreshCw, ShieldCheck } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import { cn } from '@/lib/utils'
import { Button, linkStyles, textActionStyles } from '@/components/app/button'
import { Callout } from '@/components/app/feedback'
import { NumberTicker } from '@/components/app/motion'
import { Surface } from '@/components/app/surface'
import { SlideCommit } from '@/components/app/fx/controls'
import { LaunchSteps } from '@/components/app/fx/feedback'
import { AccountChoices, choicesDone as choicesMade, type Overlap } from '@/components/campaigns/account-choices'
import type { AuditData } from '@/components/campaigns/types'
import type { Formats } from '@/components/app/formats'
import { DAYS_PER_MONTH, niceBudget, type Plan } from '@/lib/campaigns/plan'
import { FROM_AUDIT, STEPS, blockerText, customerId, setupOf, type Blocker, type SetupStep, type StepId } from '@/components/dashboard/setup'

// =============================================
// Asistentul de lansare, pe suprafața mare a Dashboard-ului (ca „Create new
// clips" la Bezeno): sus, ce urmează și cât mai e; pașii într-o pastilă gri, cu
// cel ales pe negru; dedesubt, acțiunea pasului (un rând înalt și butonul mare,
// negru) și, în dreapta, pe negru, ce înseamnă pasul: la lansare, cât se
// cheltuie pe lună, recalculat cât tragi de glisor. Lansarea se face glisând,
// nu dintr-un clic scăpat.
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
type Busy = 'recheck' | 'audit' | 'budget' | 'launch' | null

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
  // Bugetul tras pe glisor, încă nesalvat: cheltuiala pe lună din dreapta îl urmează
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

  async function saveBudget(daily: number | null) {
    setBusy('budget')
    setNote(null)
    try {
      const r = await fetch('/api/campaigns/plan', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ daily_budget: daily }) })
      if (!r.ok) throw new Error()
      await onChanged()
    } catch {
      setNote({ tone: 'danger', text: t('campaigns.save_error') })
    } finally {
      setBusy(null)
      setBudgetDraft(null)
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
        // Tipul arătat aici: dacă între timp planul spune altul, serverul nu lansează
        body: JSON.stringify({ overlap, declare_eu: declareEu, expected_type: plan.structure.type }),
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
                {step.id === 'launch' && (
                  <LaunchStep plan={plan} audit={audit} setup={setup} step={step} f={f} intlLocale={intlLocale} busy={busy} text={text}
                    overlap={overlap} onOverlap={setOverlap} declareEu={declareEu} onDeclareEu={setDeclareEu}
                    onGoTo={() => pick(null)}
                    budgetDraft={budgetDraft} onBudgetDraft={setBudgetDraft}
                    onBudget={value => {
                      if (value === undefined) setBudgetDraft(null)
                      else saveBudget(value)
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
              <Aside step={step.id} plan={plan} store={store} budgetDraft={budgetDraft} f={f} />
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

function LaunchStep({ plan, audit, setup, step, f, intlLocale, busy, text, overlap, onOverlap, declareEu, onDeclareEu, onGoTo, budgetDraft, onBudgetDraft, onBudget, onAudit, onLaunch }: {
  plan: Plan; audit: AuditData | null; setup: ReturnType<typeof setupOf>; step: SetupStep; f: Formats; intlLocale: string; busy: Busy
  text: (b: Blocker) => string
  overlap: Overlap; onOverlap: (v: 'pause' | 'keep') => void; declareEu: boolean; onDeclareEu: (v: boolean) => void
  onGoTo: () => void
  budgetDraft: number | null; onBudgetDraft: (n: number) => void
  /** null = bugetul propus de Hontrio; undefined = nimic de salvat (glisorul a rămas pe valoarea salvată). */
  onBudget: (value: number | null | undefined) => void
  onAudit: () => void; onLaunch: () => Promise<void>
}) {
  const { t } = useT()
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
  // Ce se repară din Produse (niciun produs de vândut, prea multe excluderi); auditul are cardul lui
  const products = step.open.filter(b => b.id !== 'audit')

  return (
    <>
      <Lead>{t('wizard.launch_desc')}</Lead>

      {locked && (
        <div className={cn(field, 'mt-5 flex-col items-start gap-3 border-dashed sm:flex-row sm:items-center')}>
          <span className="flex flex-1 items-center gap-2.5 text-sm text-neutral-700"><Lock className="size-4 shrink-0 text-neutral-400" />{t('wizard.launch_locked', { step: t(`wizard.${locked}_title`) })}</span>
          <Button size="sm" onClick={onGoTo}>{t('wizard.launch_go')}<ArrowRight /></Button>
        </div>
      )}

      {products.map(b => (
        <Callout key={b.id} tone="warning" className="mt-5" action={<Button asChild size="sm"><Link href={b.href}>{t('wizard.tracking_fix')}<ArrowRight /></Link></Button>}>
          {text(b)}
        </Callout>
      ))}

      {/* Bugetul */}
      <BudgetSlider plan={plan} f={f} draft={budgetDraft} onDraft={onBudgetDraft} saving={busy === 'budget'} disabled={!!busy && busy !== 'budget'} onSave={onBudget} />

      {/* Ce se lansează */}
      <Chips items={[
        t(plan.structure.type === 'shopping' ? 'campaigns.type_shopping' : 'campaigns.type_pmax'),
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

/** Bugetul pe zi, dintr-un glisor: cheltuiala pe lună din dreapta se schimbă cât tragi; se salvează când lași mânerul. */
function BudgetSlider({ plan, f, draft, onDraft, saving, disabled, onSave }: {
  plan: Plan; f: Formats; draft: number | null; onDraft: (n: number) => void; saving: boolean; disabled: boolean
  onSave: (value: number | null | undefined) => void
}) {
  const { t } = useT()
  const { budget } = plan
  const anchor = budget.daily ?? budget.suggested
  if (anchor === null) {
    return <p className={cn(field, 'mt-5 text-sm text-neutral-500')}>{t('wizard.budget_none')}</p>
  }
  const base = budget.suggested ?? anchor
  const max = niceBudget(Math.max(base * 3, 30))
  const step = max > 400 ? 10 : max > 80 ? 5 : 1
  // Glisorul merge doar pe min + k × pas: cu minimul multiplu de pas, bugetul propus (rotunjit la fel) se poate alege exact
  const min = Math.max(step, Math.round(niceBudget(base * 0.2) / step) * step)
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
      {budget.basis && budget.suggested !== null && (
        <p className="mt-2 text-xs text-neutral-400">{t(budget.basis === 'history' ? 'wizard.budget_basis_history' : plan.economics.aov_basis === 'prices' ? 'wizard.budget_basis_prices' : 'wizard.budget_basis_aov', { amount: f.money.format(budget.suggested) })}</p>
      )}
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

function Aside({ step, plan, store, budgetDraft, f }: { step: StepId; plan: Plan; store: WizardStore; budgetDraft: number | null; f: Formats }) {
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
    case 'launch': {
      const daily = budgetDraft ?? plan.budget.daily
      return (
        <DarkPanel label={t('wizard.aside_launch_title')} value={daily === null ? '—' : <NumberTicker value={daily * DAYS_PER_MONTH} format={n => f.money.format(Math.round(n))} />}>
          <Facts facts={[t('wizard.aside_launch_1'), t('wizard.aside_launch_2'), t('wizard.aside_launch_3')]} />
        </DarkPanel>
      )
    }
  }
}
