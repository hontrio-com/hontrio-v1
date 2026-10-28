'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import {
  AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, Circle, ExternalLink, Info, Loader2, RefreshCw, Rocket, ShieldCheck,
} from 'lucide-react'
import type { Plan } from '@/lib/campaigns/plan'
import type { AuditCheck, AuditResult } from '@/lib/google/audit'
import { AccountChoices, choicesDone as choicesMade, type Overlap } from '@/components/campaigns/account-choices'

// =============================================
// Lansarea: ce mai lipsește, auditul contului Google Ads (verificat de
// Hontrio înainte de orice modificare), alegerile pe care le face omul
// (campaniile existente, declarația UE) și butonul de lansare.
// =============================================

export type AuditData = { checked_at: string; fresh: boolean; error: string | null; result: AuditResult | null }

type Props = {
  plan: Plan
  audit: AuditData | null
  hasAccount: boolean
  onChanged: () => Promise<unknown>
}

const LEVEL_ICON = {
  blocker: { icon: AlertCircle, cls: 'text-red-500' },
  choice: { icon: AlertTriangle, cls: 'text-amber-500' },
  warning: { icon: AlertTriangle, cls: 'text-amber-500' },
  info: { icon: Info, cls: 'text-neutral-400' },
} as const

export function LaunchPanel({ plan, audit, hasAccount, onChanged }: Props) {
  const { t, intlLocale } = useT()
  const [auditing, setAuditing] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [overlap, setOverlap] = useState<Overlap>(null)
  const [declareEu, setDeclareEu] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string; details?: string[] } | null>(null)

  const result = audit?.result ?? null
  const ready = plan.blockers.length === 0 && !!result && !audit?.error
  const choicesDone = choicesMade(result, overlap, declareEu)

  async function runAudit() {
    setAuditing(true)
    setMessage(null)
    try {
      const r = await fetch('/api/campaigns/audit', { method: 'POST' })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) setMessage({ kind: 'error', text: body.error || t('campaigns.audit_failed') })
      await onChanged()
    } catch {
      setMessage({ kind: 'error', text: t('campaigns.audit_failed') })
    } finally {
      setAuditing(false)
    }
  }

  async function launch() {
    setLaunching(true)
    setMessage(null)
    try {
      const r = await fetch('/api/campaigns/launch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overlap, declare_eu: declareEu }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        const details = (body.details as { code: string | null; path: string | null; message: string }[] | undefined ?? [])
          .map(d => [d.code, d.path, d.message].filter(Boolean).join(' · '))
        setMessage({ kind: 'error', text: body.error || t('campaigns.launch_failed'), details })
      } else {
        setMessage({ kind: 'ok', text: [t('campaigns.launch_done'), ...(body.warnings ?? [])].join(' ') })
      }
      await onChanged()
    } catch {
      setMessage({ kind: 'error', text: t('campaigns.launch_failed') })
    } finally {
      setLaunching(false)
    }
  }

  const checkedAt = audit ? new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(audit.checked_at)) : null
  const shownChecks = (result?.checks ?? []).filter(c => c.id !== 'currency_mismatch')

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
      {/* Starea lansării */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[15px] font-semibold text-neutral-900">
            {plan.blockers.length ? t('campaigns.blockers_title', { count: String(plan.blockers.length) }) : t('campaigns.ready_title')}
          </p>
          <p className="text-[12px] text-neutral-400 mt-0.5 max-w-xl leading-relaxed">
            {t(plan.stage.id === 'starter' ? 'campaigns.stage_starter_hint' : 'campaigns.stage_growth_hint', {
              conversions: String(Math.round(plan.stage.conversions30)),
            })}
          </p>
        </div>
        <button onClick={launch} disabled={!ready || !choicesDone || launching}
          className="shrink-0 self-start inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-neutral-900 text-white text-[12px] font-medium hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed">
          {launching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
          {t(plan.stage.id === 'starter' ? 'campaigns.launch_starter' : 'campaigns.launch_growth')}
        </button>
      </div>

      {/* Ce lipsește */}
      {plan.blockers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {plan.blockers.map(b => {
            const params = Object.fromEntries(Object.entries(b.params ?? {}).map(([k, v]) => [k, String(v)]))
            const step = `${b.id}${b.variant ? `_${b.variant}` : ''}`
            const label = t.has(`campaigns.blocker_${step}`) ? t(`campaigns.blocker_${step}`, params)
              : t.has(`campaigns.blocker_${b.id}`) ? t(`campaigns.blocker_${b.id}`, params)
              : t('campaigns.blocker_generic')
            const inner = (
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-neutral-200 hover:border-neutral-300 bg-white transition-all">
                <Circle className="h-4 w-4 text-neutral-300 shrink-0" />
                <span className="flex-1 text-[13px] text-neutral-800">{label}</span>
                {b.external ? <ExternalLink className="h-3.5 w-3.5 text-neutral-300" /> : <ArrowRight className="h-3.5 w-3.5 text-neutral-300" />}
              </div>
            )
            return b.external
              ? <a key={b.id} href={b.href} target="_blank" rel="noopener">{inner}</a>
              : <Link key={b.id} href={b.href}>{inner}</Link>
          })}
        </div>
      )}

      {/* Auditul contului Google Ads */}
      {hasAccount && (
        <div id="audit" className="rounded-lg border border-neutral-100 bg-neutral-50/60 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-neutral-500" />
              <p className="text-[13px] font-semibold text-neutral-900">{t('campaigns.audit_title')}</p>
              {checkedAt && <span className="text-[11px] text-neutral-400">{t('campaigns.audit_checked', { when: checkedAt })}</span>}
            </div>
            <button onClick={runAudit} disabled={auditing}
              className="self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-neutral-200 bg-white text-[12px] font-medium text-neutral-700 hover:border-neutral-300 disabled:opacity-50">
              {auditing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {t(audit ? 'campaigns.audit_again' : 'campaigns.audit_run')}
            </button>
          </div>
          <p className="mt-1 text-[12px] text-neutral-500 leading-relaxed">{t('campaigns.audit_hint')}</p>

          {audit?.error && (
            <p className="mt-3 flex items-start gap-2 text-[12px] text-red-600 leading-relaxed"><AlertCircle className="h-4 w-4 shrink-0 mt-px" />{translateStored(t, audit.error)}</p>
          )}

          {result && (
            <div className="mt-3 space-y-1.5">
              {!shownChecks.length && (
                <p className="flex items-center gap-2 text-[12px] text-emerald-700"><CheckCircle2 className="h-4 w-4" />{t('campaigns.audit_all_ok')}</p>
              )}
              {shownChecks.map(c => <CheckRow key={c.id} check={c} />)}
              <p className="pt-1 text-[11px] text-neutral-400 leading-relaxed">
                {t('campaigns.audit_history', {
                  conversions: String(Math.round(result.history.conversions30)),
                  campaigns: String(result.campaigns.filter(c => c.status === 'ENABLED').length),
                })}
              </p>
            </div>
          )}

          {/* Alegerile omului, înainte de lansare */}
          {result && (result.overlap.length > 0 || result.eu_undeclared.length > 0) && (
            <div className="mt-4 space-y-4">
              <AccountChoices result={result} overlap={overlap} onOverlap={setOverlap} declareEu={declareEu} onDeclareEu={setDeclareEu} />
            </div>
          )}
        </div>
      )}

      {message && (
        <div className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-[12px] leading-relaxed border ${message.kind === 'ok' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-700'}`}>
          {message.kind === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-px" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-px" />}
          <div>
            <p>{message.text}</p>
            {message.details?.map(d => <p key={d} className="mt-1 font-mono text-[11px] opacity-80 break-all">{d}</p>)}
          </div>
        </div>
      )}
    </div>
  )
}

function CheckRow({ check }: { check: AuditCheck }) {
  const { t } = useT()
  const { icon: Icon, cls } = LEVEL_ICON[check.level]
  const params = Object.fromEntries(Object.entries(check.params ?? {}).map(([k, v]) => [k, String(v)]))
  return (
    <p className="flex items-start gap-2 text-[12px] text-neutral-700 leading-relaxed">
      <Icon className={`h-4 w-4 shrink-0 mt-px ${cls}`} />
      <span>{t.has(`campaigns.check_${check.id}`) ? t(`campaigns.check_${check.id}`, params) : check.id}</span>
    </p>
  )
}
