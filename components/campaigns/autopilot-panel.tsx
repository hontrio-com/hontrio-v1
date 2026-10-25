'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import { Bot, Check, CheckCircle2, Loader2, X } from 'lucide-react'
import type { Mode } from '@/lib/campaigns/plan'

// =============================================
// Pilotul: cum lucrează (cu aprobare sau automat), până unde poate urca
// bugetul singur, propunerile care așteaptă răspunsul omului și jurnalul cu
// tot ce s-a schimbat în cont.
// =============================================

export type ActionItem = {
  id: string
  ad_campaign_id: string | null
  kind: string
  params: Record<string, unknown>
  reason: string | null
  status: 'proposed' | 'applied' | 'rejected' | 'failed' | 'expired'
  source: 'autopilot' | 'user'
  error: string | null
  created_at: string
}

type Props = {
  mode: Mode
  maxDailyBudget: number | null
  currency: string
  proposals: ActionItem[]
  journal: ActionItem[]
  fmt: Intl.NumberFormat
  fmtNum: Intl.NumberFormat
  onSaveSettings: (body: { mode?: Mode; max_daily_budget?: number | null }) => Promise<boolean>
  onChanged: () => Promise<unknown>
  onError: (text: string) => void
}

const STATUS_STYLE: Record<ActionItem['status'], string> = {
  proposed: 'bg-sky-50 text-sky-700',
  applied: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-neutral-100 text-neutral-500',
  failed: 'bg-red-50 text-red-600',
  expired: 'bg-neutral-100 text-neutral-400',
}

export function AutopilotPanel({ mode, maxDailyBudget, currency, proposals, journal, fmt, fmtNum, onSaveSettings, onChanged, onError }: Props) {
  const { t, intlLocale } = useT()
  const [deciding, setDeciding] = useState<string | null>(null)
  const [savingMode, setSavingMode] = useState<Mode | null>(null)
  const [maxText, setMaxText] = useState(maxDailyBudget === null ? '' : String(maxDailyBudget).replace('.', ','))
  const timeFmt = new Intl.DateTimeFormat(intlLocale, { dateStyle: 'short', timeStyle: 'short' })
  const num = (n: number) => fmtNum.format(n)

  async function decide(a: ActionItem, decision: 'approve' | 'reject') {
    setDeciding(a.id)
    try {
      const r = await fetch('/api/campaigns/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, decision }) })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) onError(body.error || t('campaigns.save_error'))
      await onChanged()
    } catch {
      onError(t('campaigns.save_error'))
    } finally {
      setDeciding(null)
    }
  }

  async function chooseMode(m: Mode) {
    if (m === mode || savingMode) return
    setSavingMode(m)
    await onSaveSettings({ mode: m })
    setSavingMode(null)
  }

  async function saveMax() {
    const raw = maxText.trim().replace(/\s/g, '').replace(',', '.')
    const value = raw ? Number(raw) : null
    if (value !== null && (!Number.isFinite(value) || value <= 0)) { onError(t('campaigns.budget_invalid')); return }
    if (value === maxDailyBudget) return
    await onSaveSettings({ max_daily_budget: value === null ? null : Math.round(value * 100) / 100 })
  }

  /** Ce schimbă propunerea, pe scurt, din parametrii ei. */
  function detail(a: ActionItem): string | null {
    const p = a.params
    const n = (k: string) => Number(p[k])
    switch (a.kind) {
      case 'set_target': return t('campaigns.detail_target', { from: fmtNum.format(n('from')), to: fmtNum.format(n('to')) })
      case 'set_budget': return t('campaigns.detail_budget', { from: fmt.format(n('from')), to: fmt.format(n('to')) })
      case 'graduate': return t('campaigns.detail_graduate', { roas: fmtNum.format(n('target_roas')), budget: fmt.format(n('daily_budget')) })
      case 'segment': return t('campaigns.detail_segment', { high: fmtNum.format(n('high_target')), rest: fmtNum.format(n('rest_target')) })
      case 'pause_loss_limit': return t('campaigns.detail_loss', { spend: fmt.format(n('spend')) })
      default: return null
    }
  }

  function items(a: ActionItem) {
    if (a.kind === 'exclude_products') {
      const list = (a.params.products as { item_id: string; title: string; cost: number; conversions: number; roas: number | null; why: string }[] | undefined) ?? []
      return list.slice(0, 10).map(p => ({
        key: p.item_id,
        text: p.title,
        note: p.why === 'no_sales'
          ? t('campaigns.item_no_sales', { spend: fmt.format(p.cost) })
          : t('campaigns.item_unprofitable', { spend: fmt.format(p.cost), roas: fmtNum.format(p.roas ?? 0) }),
      }))
    }
    if (a.kind === 'add_negatives') {
      const list = (a.params.terms as { term: string; cost: number; clicks: number }[] | undefined) ?? []
      return list.slice(0, 10).map(x => ({ key: x.term, text: `„${x.term}"`, note: t('campaigns.item_term', { spend: fmt.format(x.cost), clicks: String(x.clicks) }) }))
    }
    return []
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-5">
      <div className="flex items-start gap-2">
        <Bot className="h-5 w-5 text-neutral-500 mt-0.5" />
        <div>
          <p className="text-[15px] font-semibold text-neutral-900">{t('campaigns.pilot_title')}</p>
          <p className="text-[12px] text-neutral-400 mt-0.5 leading-relaxed">{t('campaigns.pilot_hint')}</p>
        </div>
      </div>

      {/* Modul și plafonul bugetului */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {(['approve', 'auto'] as Mode[]).map(m => {
          const active = (savingMode ?? mode) === m
          return (
            <button key={m} onClick={() => chooseMode(m)} disabled={!!savingMode} aria-pressed={active}
              className={`text-left p-3.5 rounded-xl border transition-all disabled:cursor-wait ${active ? 'border-neutral-900 ring-1 ring-neutral-900' : 'border-neutral-200 hover:border-neutral-300'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-neutral-900">{t(`campaigns.mode_${m}`)}</p>
                {savingMode === m ? <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" /> : active && <CheckCircle2 className="h-4 w-4 text-neutral-900" />}
              </div>
              <p className="mt-1 text-[11px] text-neutral-500 leading-relaxed">{t(`campaigns.mode_${m}_desc`)}</p>
            </button>
          )
        })}
        <div className="p-3.5 rounded-xl border border-neutral-200">
          <p className="text-[13px] font-semibold text-neutral-900">{t('campaigns.max_budget_title')}</p>
          <div className="mt-2 relative">
            <input value={maxText} inputMode="decimal" aria-label={t('campaigns.max_budget_title')} placeholder={t('campaigns.max_budget_none')}
              onChange={e => setMaxText(e.target.value)} onBlur={saveMax} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
              className="w-full h-9 pl-3 pr-12 rounded-xl border border-neutral-200 bg-white text-[13px] tabular-nums placeholder:text-neutral-300 focus:outline-none focus:border-neutral-400" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 pointer-events-none">{currency}</span>
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-500 leading-relaxed">{t('campaigns.max_budget_hint')}</p>
        </div>
      </div>
      <p className="text-[11px] text-neutral-400 leading-relaxed">{t('campaigns.pilot_protective')}</p>

      {/* Propunerile */}
      <div>
        <p className="text-[13px] font-semibold text-neutral-900">{t('campaigns.proposals_title', { count: String(proposals.length) })}</p>
        {proposals.length === 0 ? (
          <p className="mt-1 text-[12px] text-neutral-400">{t('campaigns.proposals_empty')}</p>
        ) : (
          <div className="mt-2 space-y-2">
            {proposals.map(a => (
              <div key={a.id} className="rounded-lg border border-sky-100 bg-sky-50/40 p-3.5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-neutral-900">{t(`campaigns.kind_action_${a.kind}`)}</p>
                    {a.reason && <p className="mt-0.5 text-[12px] text-neutral-600 leading-relaxed">{translateStored(t, a.reason, num)}</p>}
                    {detail(a) && <p className="mt-0.5 text-[12px] font-medium text-neutral-800 tabular-nums">{detail(a)}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => decide(a, 'reject')} disabled={deciding === a.id}
                      className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-neutral-200 bg-white text-[11px] font-medium text-neutral-600 hover:border-neutral-300 disabled:opacity-50">
                      <X className="h-3 w-3" />{t('campaigns.reject')}
                    </button>
                    <button onClick={() => decide(a, 'approve')} disabled={deciding === a.id}
                      className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-neutral-900 text-white text-[11px] font-medium hover:bg-neutral-800 disabled:opacity-50">
                      {deciding === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}{t('campaigns.approve')}
                    </button>
                  </div>
                </div>
                {items(a).length > 0 && (
                  <ul className="mt-2 divide-y divide-sky-100/80 rounded-md bg-white/70">
                    {items(a).map(x => (
                      <li key={x.key} className="flex items-center justify-between gap-3 px-2.5 py-1.5 text-[11px]">
                        <span className="truncate text-neutral-800">{x.text}</span>
                        <span className="shrink-0 text-neutral-500 tabular-nums">{x.note}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Jurnalul */}
      <div>
        <p className="text-[13px] font-semibold text-neutral-900">{t('campaigns.journal_title')}</p>
        {journal.length === 0 ? (
          <p className="mt-1 text-[12px] text-neutral-400">{t('campaigns.journal_empty')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100">
            {journal.map(a => (
              <li key={a.id} className="py-2 flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-3">
                <span className="shrink-0 w-32 text-[11px] text-neutral-400 tabular-nums">{timeFmt.format(new Date(a.created_at))}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-neutral-800">
                    <span className={`mr-1.5 inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-md ${STATUS_STYLE[a.status]}`}>{t(`campaigns.action_status_${a.status}`)}</span>
                    {t(`campaigns.kind_action_${a.kind}`)}
                    <span className="text-neutral-400"> · {t(a.source === 'user' ? 'campaigns.by_you' : 'campaigns.by_pilot')}</span>
                  </p>
                  {(a.error || a.reason || detail(a)) && (
                    <p className={`text-[11px] leading-relaxed ${a.error ? 'text-red-600' : 'text-neutral-500'}`}>
                      {a.error ? translateStored(t, a.error, num) : [a.reason ? translateStored(t, a.reason, num) : null, detail(a)].filter(Boolean).join(' ')}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
