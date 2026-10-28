'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, AlertTriangle, ArrowRight, CircleCheck, CircleDashed, ExternalLink, Info, RefreshCw, Rocket, ShieldCheck } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import { cn } from '@/lib/utils'
import { Card } from '@/components/app/surface'
import { Button } from '@/components/app/button'
import { Callout } from '@/components/app/feedback'
import { InfoTip } from '@/components/app/info-tip'
import { AccountChoices, choicesDone as choicesMade, type Overlap } from '@/components/campaigns/account-choices'
import type { AuditData } from '@/components/campaigns/types'
import type { Formats } from '@/components/app/formats'
import type { Plan } from '@/lib/campaigns/plan'
import type { AuditCheck } from '@/lib/google/audit'

// =============================================
// Lansarea campaniei principale: ce mai lipsește (cu linkul spre locul unde
// se face), auditul contului Google Ads (citit de Hontrio înainte de orice
// modificare), alegerile omului (campaniile existente, declarația UE) și
// butonul de lansare.
// =============================================

const LEVEL = {
  blocker: { icon: AlertCircle, cls: 'text-red-500' },
  choice: { icon: AlertTriangle, cls: 'text-amber-500' },
  warning: { icon: AlertTriangle, cls: 'text-amber-500' },
  info: { icon: Info, cls: 'text-neutral-400' },
} as const

export function LaunchCard({ plan, audit, f, onChanged, onLaunched }: {
  plan: Plan
  audit: AuditData | null
  f: Formats
  onChanged: () => Promise<unknown>
  /** După lansare: mesajul de arătat în pagină. */
  onLaunched: (text: string) => void
}) {
  const { t } = useT()
  const [auditing, setAuditing] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [overlap, setOverlap] = useState<Overlap>(null)
  const [declareEu, setDeclareEu] = useState(false)
  const [error, setError] = useState<{ text: string; details?: string[] } | null>(null)

  const result = audit?.result ?? null
  const hasAccount = !!plan.campaign.account
  const ready = plan.blockers.length === 0 && !!result && !audit?.error
  const choicesDone = choicesMade(result, overlap, declareEu)
  const starter = plan.stage.id === 'starter'
  const checks = (result?.checks ?? []).filter(c => c.id !== 'currency_mismatch')

  async function runAudit() {
    setAuditing(true)
    setError(null)
    try {
      const r = await fetch('/api/campaigns/audit', { method: 'POST' })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) setError({ text: body.error || t('campaigns.audit_failed') })
      await onChanged()
    } catch {
      setError({ text: t('campaigns.audit_failed') })
    } finally {
      setAuditing(false)
    }
  }

  async function launch() {
    setLaunching(true)
    setError(null)
    try {
      const r = await fetch('/api/campaigns/launch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overlap, declare_eu: declareEu }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        const details = (body.details as { code: string | null; path: string | null; message: string }[] | undefined ?? [])
          .map(d => [d.code, d.path, d.message].filter(Boolean).join(' · '))
        setError({ text: body.error || t('campaigns.launch_failed'), details })
        await onChanged()
      } else {
        // Întâi datele noi (campania lansată), apoi mesajul: pagina trece la prezentare
        await onChanged()
        onLaunched([t('campaigns.launch_done'), ...(body.warnings ?? [])].join(' '))
      }
    } catch {
      setError({ text: t('campaigns.launch_failed') })
    } finally {
      setLaunching(false)
    }
  }

  const blockerLabel = (b: Plan['blockers'][number]) => {
    const params = Object.fromEntries(Object.entries(b.params ?? {}).map(([k, v]) => [k, String(v)]))
    const step = `${b.id}${b.variant ? `_${b.variant}` : ''}`
    return t.has(`campaigns.blocker_${step}`) ? t(`campaigns.blocker_${step}`, params)
      : t.has(`campaigns.blocker_${b.id}`) ? t(`campaigns.blocker_${b.id}`, params) : t('campaigns.blocker_generic')
  }

  // De ce butonul nu merge încă
  const waiting = launching ? null
    : plan.blockers.length ? 'campaigns.launch_wait_steps'
    : !result || audit?.error ? 'campaigns.launch_wait_audit'
    : !choicesDone ? 'campaigns.launch_wait_choices' : null

  return (
    <Card id="launch" className="scroll-mt-24 overflow-hidden">
      {/* Starea lansării */}
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl ring-1',
            ready && choicesDone ? 'bg-brand-600 text-white ring-brand-600' : 'bg-brand-50 text-brand-600 ring-brand-100')}>
            <Rocket className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-900">
              {plan.blockers.length ? t('campaigns.blockers_title', { count: String(plan.blockers.length) }) : t('campaigns.ready_title')}
            </h3>
            <p className="mt-0.5 max-w-xl text-[13px] leading-relaxed text-neutral-500">
              {t(starter ? 'campaigns.launch_card_starter' : 'campaigns.launch_card_growth', {
                products: f.int.format(plan.counts.included),
                budget: plan.budget.daily !== null ? f.money.format(plan.budget.daily) : '—',
              })}
              {' '}
              <InfoTip>{t(starter ? 'campaigns.stage_starter_hint' : 'campaigns.stage_growth_hint', { conversions: String(Math.round(plan.stage.conversions30)) })}</InfoTip>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:items-end">
          <Button variant="primary" size="lg" loading={launching} disabled={!ready || !choicesDone} onClick={launch}>
            {!launching && <Rocket />}{t(starter ? 'campaigns.launch_starter' : 'campaigns.launch_growth')}
          </Button>
          {waiting && <p className="text-[12px] text-neutral-400 sm:text-right">{t(waiting)}</p>}
        </div>
      </div>

      {/* Ce lipsește */}
      {plan.blockers.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 border-t border-neutral-100 px-5 py-4 sm:grid-cols-2">
          {plan.blockers.map(b => {
            const inner = (
              <span className="group flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 transition-all hover:border-neutral-300 hover:shadow-card">
                <CircleDashed className="size-4 shrink-0 text-neutral-300" />
                <span className="flex-1 text-[13px] text-neutral-800">{blockerLabel(b)}</span>
                {b.external
                  ? <ExternalLink className="size-3.5 text-neutral-300 group-hover:text-neutral-500" />
                  : <ArrowRight className="size-3.5 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-500" />}
              </span>
            )
            return (
              <li key={b.id}>
                {b.external ? <a href={b.href} target="_blank" rel="noopener">{inner}</a> : <Link href={b.href}>{inner}</Link>}
              </li>
            )
          })}
        </ul>
      )}

      {/* Auditul contului Google Ads */}
      {hasAccount && (
        <div id="audit" className="border-t border-neutral-100 bg-neutral-50/50 px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="size-4 text-neutral-500" />
              <p className="text-[13px] font-semibold text-neutral-900">{t('campaigns.audit_title')}</p>
              <InfoTip>{t('campaigns.audit_hint')}</InfoTip>
              {audit && <span className="text-[12px] text-neutral-400">{t('campaigns.audit_checked', { when: f.dateTime.format(new Date(audit.checked_at)) })}</span>}
            </div>
            <Button size="sm" loading={auditing} onClick={runAudit}>
              {!auditing && <RefreshCw />}{t(audit ? 'campaigns.audit_again' : 'campaigns.audit_run')}
            </Button>
          </div>

          {audit?.error && <Callout tone="danger" className="mt-3">{translateStored(t, audit.error)}</Callout>}

          {result && (
            <div className="mt-3 space-y-2">
              {!checks.length && <p className="flex items-center gap-2 text-[13px] text-emerald-700"><CircleCheck className="size-4" />{t('campaigns.audit_all_ok')}</p>}
              {checks.map(c => <CheckRow key={c.id} check={c} />)}
              <p className="text-[12px] leading-relaxed text-neutral-400">
                {t('campaigns.audit_history', {
                  conversions: String(Math.round(result.history.conversions30)),
                  campaigns: String(result.campaigns.filter(c => c.status === 'ENABLED').length),
                })}
              </p>
            </div>
          )}

          {/* Alegerile omului, înainte de lansare */}
          {result && (result.overlap.length > 0 || result.eu_undeclared.length > 0) && (
            <div className="mt-4 rounded-xl bg-white p-4 ring-1 ring-neutral-200/80">
              <AccountChoices result={result} overlap={overlap} onOverlap={setOverlap} declareEu={declareEu} onDeclareEu={setDeclareEu} />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="border-t border-neutral-100 px-5 py-4">
          <Callout tone="danger" onClose={() => setError(null)}>
            <p>{error.text}</p>
            {error.details?.map(d => <p key={d} className="mt-1 break-all font-mono text-[11px] opacity-80">{d}</p>)}
          </Callout>
        </div>
      )}
    </Card>
  )
}

function CheckRow({ check }: { check: AuditCheck }) {
  const { t } = useT()
  const { icon: Icon, cls } = LEVEL[check.level]
  const params = Object.fromEntries(Object.entries(check.params ?? {}).map(([k, v]) => [k, String(v)]))
  return (
    <p className="flex items-start gap-2 text-[13px] leading-relaxed text-neutral-700">
      <Icon className={cn('mt-0.5 size-4 shrink-0', cls)} />
      <span>{t.has(`campaigns.check_${check.id}`) ? t(`campaigns.check_${check.id}`, params) : check.id}</span>
    </p>
  )
}
