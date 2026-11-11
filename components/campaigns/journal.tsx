'use client'

import {
  Ban, CalendarRange, Check, CirclePause, CircleStop, FileCheck, PackageX, Pause, Play, RefreshCw, Rocket,
  ShieldAlert, Sparkles, Split, Target, TrendingUp, Wallet, X, type LucideIcon,
} from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { translateStored } from '@/lib/i18n/stored'
import type { TFunction } from '@/lib/i18n/translate'
import { cn } from '@/lib/utils'
import { Badge, type Tone } from '@/components/app/badge'
import { Button } from '@/components/app/button'
import { day, type Formats } from '@/components/app/formats'
import type { ActionItem } from '@/components/campaigns/types'

// =============================================
// Piesele jurnalului pilotului, la un loc: iconița fiecărei acțiuni, ce
// schimbă, de ce, o propunere cu Aprobă / Respinge și un rând din jurnal.
// Le folosesc pagina Campanii → Pilot, Dashboard-ul și săptămâna
// demonstrativă de pe site („De ce Hontrio"), ca să arate peste tot la fel.
// =============================================

export const KIND_ICON: Record<string, LucideIcon> = {
  set_target: Target,
  set_budget: Wallet,
  graduate: TrendingUp,
  segment: Split,
  exclude_products: PackageX,
  add_negatives: Ban,
  pause_loss_limit: ShieldAlert,
  launch: Rocket,
  pause: Pause,
  enable: Play,
  declare_eu: FileCheck,
  pause_existing: CirclePause,
  sync_products: RefreshCw,
  end: CircleStop,
  set_end_date: CalendarRange,
}

export const ACTION_STATUS_TONE: Record<ActionItem['status'], Tone> = {
  proposed: 'outline', applied: 'green', rejected: 'neutral', failed: 'red', expired: 'neutral',
}

/**
 * Motivul salvat al unei acțiuni, în limba omului. Motivele vechi, de când Hontrio lucra cu
 * marje (ținta, împărțirea), nu mai au text: nu se arată deloc, decât cheia brută.
 */
export function reasonOf(t: TFunction, value: string | null | undefined, num: (n: number) => string): string | null {
  if (!value) return null
  const key = value.split('|')[0]
  return /^[a-z0-9_]+(\.[a-z0-9_]+)+$/.test(key) && !t.has(key) ? null : translateStored(t, value, num)
}

/** Ce schimbă o propunere a pilotului, pe scurt, din parametrii ei (și pe Dashboard). */
export function actionDetail(a: ActionItem, t: TFunction, f: Formats): string | null {
  const p = a.params
  const n = (k: string) => Number(p[k])
  switch (a.kind) {
    case 'set_budget': return t('campaigns.detail_budget', { from: f.money.format(n('from')), to: f.money.format(n('to')) })
    case 'graduate': return t('campaigns.detail_graduate', { budget: f.money.format(n('daily_budget')) })
    case 'pause_loss_limit': return t('campaigns.detail_loss', { spend: f.money.format(n('spend')) })
    case 'set_end_date': return typeof p.ends_on === 'string'
      ? t('campaigns.detail_end_date', { date: f.date.format(day(p.ends_on)) })
      : t('campaigns.detail_no_end_date')
    default: return null
  }
}

/** Produsele sau căutările dintr-o propunere (cel mult 10), fiecare cu cât a cheltuit. */
export function actionItems(a: ActionItem, t: TFunction, f: Formats): { key: string; text: string; note: string }[] {
  if (a.kind === 'exclude_products') {
    const list = (a.params.products as { item_id: string; title: string; cost: number; conversions: number; roas: number | null; why: string }[] | undefined) ?? []
    return list.slice(0, 10).map(p => ({
      key: p.item_id,
      text: p.title,
      note: p.why === 'no_sales'
        ? t('campaigns.item_no_sales', { spend: f.money.format(p.cost) })
        : t('campaigns.item_below_cost', { spend: f.money.format(p.cost), roas: f.num.format(p.roas ?? 0) }),
    }))
  }
  if (a.kind === 'add_negatives') {
    const list = (a.params.terms as { term: string; cost: number; clicks: number }[] | undefined) ?? []
    return list.slice(0, 10).map(x => ({ key: x.term, text: t('campaigns.item_term_text', { term: x.term }), note: t('campaigns.item_term', { spend: f.money.format(x.cost), clicks: f.num.format(x.clicks) }) }))
  }
  return []
}

/** Clasele rândului (`li`) unei propuneri; înăuntru stă `ProposalItem`. Lățimea rândului alege așezarea, nu ecranul. */
export const PROPOSAL_ROW = '@container rounded-xl border border-neutral-200/80 bg-white p-4 transition-shadow hover:shadow-card'

/** O propunere a pilotului: ce, cât, de ce, când, cu Respinge / Aprobă. */
export function ProposalItem({ a, label, time, f, busy = false, onDecide }: {
  a: ActionItem
  /** Campania la care se referă, când sunt mai multe. */
  label: string | null
  time: string
  f: Formats
  busy?: boolean
  onDecide: (decision: 'approve' | 'reject') => void
}) {
  const { t } = useT()
  const Icon = KIND_ICON[a.kind] ?? Sparkles
  const detail = actionDetail(a, t, f)
  const reason = reasonOf(t, a.reason, n => f.num.format(n))
  const list = actionItems(a, t, f)
  return (
    <>
      <div className="flex flex-col gap-3 @lg:flex-row @lg:items-start @lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100"><Icon className="size-4" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[14px] font-semibold text-neutral-900">{t(`campaigns.kind_action_${a.kind}`)}</p>
              {label && <Badge>{label}</Badge>}
            </div>
            {detail && <p className="mt-1 text-[14px] font-medium tabular-nums text-neutral-800">{detail}</p>}
            {reason && <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{reason}</p>}
            <p className="mt-2 text-[12px] text-neutral-400">{time}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 @lg:pt-0.5">
          <Button size="sm" disabled={busy} onClick={() => onDecide('reject')}><X />{t('campaigns.reject')}</Button>
          <Button size="sm" variant="primary" loading={busy} onClick={() => onDecide('approve')}>
            {!busy && <Check />}{t('campaigns.approve')}
          </Button>
        </div>
      </div>
      {list.length > 0 && (
        <ul className="mt-3 divide-y divide-neutral-100 overflow-hidden rounded-lg bg-neutral-50/70 ring-1 ring-inset ring-neutral-200/60 @lg:ml-12">
          {list.map(x => (
            <li key={x.key} className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]">
              <span className="truncate text-neutral-800">{x.text}</span>
              <span className="shrink-0 tabular-nums text-neutral-500">{x.note}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** Clasele unui rând (`li`) din jurnal; înăuntru stă `JournalEntry`. */
export const JOURNAL_ROW = 'relative flex gap-3 pb-5 last:pb-0'

/** Un rând din jurnal: ce s-a schimbat, cum s-a încheiat, pe ce campanie, de ce, când și cine. */
export function JournalEntry({ a, label, time, timeTitle, f, last }: {
  a: ActionItem
  label: string | null
  time: string
  /** Data întreagă, la trecerea mouse-ului peste timpul relativ. */
  timeTitle?: string
  f: Formats
  /** Ultimul rând: fără linia care coboară spre următorul. */
  last: boolean
}) {
  const { t } = useT()
  const Icon = KIND_ICON[a.kind] ?? Sparkles
  const num = (n: number) => f.num.format(n)
  const note = a.error ? translateStored(t, a.error, num) : [actionDetail(a, t, f), reasonOf(t, a.reason, num)].filter(Boolean).join(' · ')
  return (
    <>
      {!last && <span className="absolute bottom-0 left-[13px] top-8 w-px bg-neutral-200" />}
      <span className={cn('relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-1',
        a.status === 'failed' ? 'bg-red-50 text-red-500 ring-red-200' : a.status === 'applied' ? 'bg-white text-neutral-600 ring-neutral-200' : 'bg-neutral-50 text-neutral-400 ring-neutral-200')}>
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[13px] font-medium text-neutral-900">{t(`campaigns.kind_action_${a.kind}`)}</p>
          <Badge tone={ACTION_STATUS_TONE[a.status]}>{t(`campaigns.action_status_${a.status}`)}</Badge>
          {label && <span className="text-[12px] text-neutral-500">{label}</span>}
        </div>
        {note && <p className={cn('mt-0.5 text-[12px] leading-relaxed', a.error ? 'text-red-600' : 'text-neutral-500')}>{note}</p>}
        <p className="mt-1 text-[12px] text-neutral-400">
          <time dateTime={a.created_at} title={timeTitle}>{time}</time>
          {' · '}{t(a.source === 'user' ? 'campaigns.by_you' : 'campaigns.by_pilot')}
        </p>
      </div>
    </>
  )
}
