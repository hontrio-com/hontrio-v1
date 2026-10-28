'use client'

import { useState, type ReactNode } from 'react'
import { useT } from '@/lib/i18n/context'
import {
  AlertCircle, AlertTriangle, ArrowDown, BadgePercent, CalendarRange, Coins, FolderTree, Layers, ListChecks, Loader2, Pencil,
  Plus, Rocket, Square, Tag, Trash2, type LucideIcon,
} from 'lucide-react'
import type { Plan } from '@/lib/campaigns/plan'
import { MAX_GROUPS, type GroupPlan, type GroupRules } from '@/lib/campaigns/groups'
import { isRunning, LiveCampaignItem, type LiveCampaign } from '@/components/campaigns/live-campaigns'
import { noteParams, type Step } from '@/components/campaigns/group-editor'

// =============================================
// „Campaniile tale": campania principală (tot ce nu e într-o grupă) și
// campaniile pe grupe de produse făcute de om, fiecare cu campaniile ei din
// Google Ads (cifre, pauză) sau, până la lansare, cu planul pe scurt.
// =============================================

type Props = {
  plan: Plan
  groups: GroupPlan[]
  campaigns: LiveCampaign[]
  fmt: Intl.NumberFormat
  fmt2: Intl.NumberFormat
  fmtNum: Intl.NumberFormat
  fmtInt: Intl.NumberFormat
  onNew: () => void
  onEdit: (g: GroupPlan, step?: Step) => void
  onShowPlan: () => void
  onChanged: () => Promise<unknown>
  onError: (text: string) => void
}

/** Iconița grupei, după ce o definește mai întâi. */
function iconOf(r: GroupRules): LucideIcon {
  if (r.categories.length) return FolderTree
  if (r.brands.length) return Tag
  if (r.on_sale) return BadgePercent
  if (r.price_min !== null || r.price_max !== null) return Coins
  return ListChecks
}

const short = (xs: string[]) => (xs.length <= 2 ? xs.join(', ') : `${xs.slice(0, 2).join(', ')} +${xs.length - 2}`)

export function CampaignBoard({ plan, groups, campaigns, fmt, fmt2, fmtNum, fmtInt, onNew, onEdit, onShowPlan, onChanged, onError }: Props) {
  const { t } = useT()
  // Campaniile unei grupe șterse (încheiate, deci) nu sunt ale campaniei principale: cifrele lor rămân în Rapoarte
  const main = campaigns.filter(c => !c.group_id && c.segment !== 'group').sort((a, b) => Number(isRunning(b)) - Number(isRunning(a)))
  const open = groups.filter(g => g.group.status !== 'ended').length
  const full = open >= MAX_GROUPS
  const anyLive = campaigns.some(isRunning)
  const item = (c: LiveCampaign) => (
    <LiveCampaignItem key={c.id} campaign={c} breakEven={plan.economics.break_even} fmt={fmt} fmt2={fmt2} fmtNum={fmtNum} onChanged={onChanged} onError={onError} />
  )

  return (
    <section className="space-y-3" aria-labelledby="board-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="board-title" className="text-[15px] font-semibold text-neutral-900">{t('campaigns.board_title')}</h2>
          <p className="text-[12px] text-neutral-400 mt-0.5">{t('campaigns.board_hint')}</p>
        </div>
        <button onClick={onNew} disabled={full} title={full ? t('campaigns.group_limit', { max: MAX_GROUPS }) : undefined}
          className="self-start inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-neutral-900 text-white text-[12px] font-medium shadow-sm hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed">
          <Plus className="h-4 w-4" />{t('campaigns.board_new')}
        </button>
      </div>

      {/* Campania principală */}
      <Block icon={Layers} title={t('campaigns.board_main')} subtitle={t(groups.length ? 'campaigns.board_main_rest' : 'campaigns.board_main_all')}
        pill={main.length ? null : <Pill tone="neutral">{t('campaigns.board_not_launched')}</Pill>}>
        {main.length ? (
          <div className="space-y-2">{main.map(item)}</div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-neutral-600 leading-relaxed">
              {plan.counts.included > 0
                ? t('campaigns.board_main_draft', {
                  products: fmtInt.format(plan.counts.included),
                  type: t(plan.structure.type === 'shopping' ? 'campaigns.g_type_shopping' : 'campaigns.g_type_performance_max'),
                  budget: plan.budget.daily !== null ? fmt.format(plan.budget.daily) : '—',
                })
                : t('campaigns.blocker_no_offers_groups')}
            </p>
            {plan.counts.included > 0 && (
              <button onClick={onShowPlan} className="shrink-0 self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-neutral-200 bg-white text-[12px] font-medium text-neutral-700 hover:border-neutral-300">
                {t('campaigns.board_see_plan')}<ArrowDown className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </Block>

      {/* Grupele */}
      {groups.map(g => (
        <GroupBlock key={g.group.id} plan={g} campaigns={campaigns.filter(c => c.group_id === g.group.id)} item={item}
          fmt={fmt} fmt2={fmt2} fmtNum={fmtNum} fmtInt={fmtInt} onEdit={onEdit} onChanged={onChanged} onError={onError} />
      ))}

      {/* O campanie nouă */}
      {!full && (
        <button onClick={onNew}
          className="group w-full rounded-2xl border border-dashed border-neutral-300 bg-white p-5 text-left transition-all hover:border-neutral-400 hover:bg-neutral-50/60">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 transition-all group-hover:bg-neutral-900 group-hover:text-white"><Plus className="h-4 w-4" /></span>
            <div>
              <p className="text-[13px] font-semibold text-neutral-900">{t('campaigns.board_new_title')}</p>
              <p className="mt-0.5 text-[12px] text-neutral-500 leading-relaxed">{t('campaigns.board_new_desc')}</p>
            </div>
          </div>
        </button>
      )}

      {anyLive && <p className="text-[11px] text-neutral-400 leading-relaxed">{t('campaigns.live_footer')}</p>}
    </section>
  )
}

function Block({ icon: Icon, title, subtitle, pill, chips, actions, children }: {
  icon: LucideIcon; title: string; subtitle?: string; pill?: ReactNode; chips?: ReactNode; actions?: ReactNode; children?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700"><Icon className="h-4 w-4" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[14px] font-semibold text-neutral-900 truncate">{title}</p>
              {pill}
            </div>
            {subtitle && <p className="mt-0.5 text-[12px] text-neutral-500 leading-relaxed">{subtitle}</p>}
            {chips && <div className="mt-2 flex flex-wrap gap-1.5">{chips}</div>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}

function Pill({ tone, children }: { tone: 'green' | 'amber' | 'neutral' | 'sky'; children: ReactNode }) {
  const cls = { green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', neutral: 'bg-neutral-100 text-neutral-500', sky: 'bg-sky-50 text-sky-700' }[tone]
  return <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md ${cls}`}>{children}</span>
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-neutral-50 ring-1 ring-neutral-100 text-[11px] text-neutral-600">{children}</span>
}

type GroupProps = {
  plan: GroupPlan
  campaigns: LiveCampaign[]
  item: (c: LiveCampaign) => ReactNode
  fmt: Intl.NumberFormat
  fmt2: Intl.NumberFormat
  fmtNum: Intl.NumberFormat
  fmtInt: Intl.NumberFormat
  onEdit: (g: GroupPlan, step?: Step) => void
  onChanged: () => Promise<unknown>
  onError: (text: string) => void
}

function GroupBlock({ plan: p, campaigns, item, fmt, fmt2, fmtNum, fmtInt, onEdit, onChanged, onError }: GroupProps) {
  const { t, intlLocale } = useT()
  const g = p.group
  const [confirm, setConfirm] = useState<'end' | 'delete' | null>(null)
  const [busy, setBusy] = useState(false)
  const running = campaigns.filter(isRunning)
  const paused = running.length > 0 && running.every(c => c.status === 'paused')
  const dateFmt = new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' })
  const day = (d: string) => dateFmt.format(new Date(`${d}T12:00:00`))

  async function act(kind: 'end' | 'delete') {
    if (confirm !== kind) { setConfirm(kind); return }
    setBusy(true)
    try {
      const r = await fetch(`/api/campaigns/groups/${g.id}`, kind === 'delete'
        ? { method: 'DELETE' }
        : { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ended' }) })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) onError(body.error || t('campaigns.save_error'))
      await onChanged()
    } catch {
      onError(t('campaigns.save_error'))
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  const pill = g.status === 'live'
    ? <Pill tone={paused ? 'amber' : 'green'}>{t(paused ? 'campaigns.status_paused' : 'campaigns.status_active')}</Pill>
    : g.status === 'ended' ? <Pill tone="neutral">{t('campaigns.status_ended')}</Pill>
    : <Pill tone="sky">{t('campaigns.g_status_draft')}</Pill>

  const rules = g.rules
  const chips = (
    <>
      <Chip>{t(p.type === 'shopping' ? 'campaigns.g_type_shopping' : 'campaigns.g_type_performance_max')}{g.campaign_type === 'auto' ? ` · ${t('campaigns.g_auto')}` : ''}</Chip>
      <Chip>{t(`campaigns.goal_${g.goal}`)}</Chip>
      {rules.categories.length > 0 && <Chip>{t('campaigns.rule_categories', { list: short(rules.categories) })}</Chip>}
      {rules.brands.length > 0 && <Chip>{t('campaigns.rule_brands', { list: short(rules.brands) })}</Chip>}
      {(rules.price_min !== null || rules.price_max !== null) && (
        <Chip>{rules.price_min !== null && rules.price_max !== null
          ? t('campaigns.g_price_between', { min: fmt.format(rules.price_min), max: fmt.format(rules.price_max) })
          : rules.price_min !== null ? t('campaigns.g_price_from', { min: fmt.format(rules.price_min) }) : t('campaigns.g_price_to', { max: fmt.format(rules.price_max ?? 0) })}</Chip>
      )}
      {rules.on_sale && <Chip>{t('campaigns.rule_sale')}</Chip>}
      {rules.include.length > 0 && <Chip>{t('campaigns.rule_include', { count: rules.include.length })}</Chip>}
      {g.ends_on && <Chip><CalendarRange className="h-3 w-3" />{t(g.starts_on ? 'campaigns.g_period_between' : 'campaigns.g_period_until', { start: g.starts_on ? day(g.starts_on) : '', end: day(g.ends_on) })}</Chip>}
    </>
  )

  const button = 'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium disabled:opacity-50'
  const actions = (
    <>
      {g.status !== 'live' && (
        <button onClick={() => onEdit(p, 3)} disabled={busy} className={`${button} bg-neutral-900 text-white hover:bg-neutral-800`}>
          <Rocket className="h-3.5 w-3.5" />{t(g.status === 'ended' ? 'campaigns.g_relaunch' : 'campaigns.g_launch')}
        </button>
      )}
      <button onClick={() => onEdit(p, g.status === 'live' ? 2 : 1)} disabled={busy} className={`${button} border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300`}>
        <Pencil className="h-3.5 w-3.5" />{t('campaigns.g_edit')}
      </button>
      {g.status === 'live' ? (
        <button onClick={() => act('end')} disabled={busy} className={`${button} border ${confirm === 'end' ? 'border-red-200 bg-red-50 text-red-700' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'}`}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}{t(confirm === 'end' ? 'campaigns.g_end_confirm' : 'campaigns.g_end')}
        </button>
      ) : (
        <button onClick={() => act('delete')} disabled={busy} aria-label={t('campaigns.g_delete')}
          className={`${button} border ${confirm === 'delete' ? 'border-red-200 bg-red-50 text-red-700' : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'}`}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}{confirm === 'delete' ? t('campaigns.g_delete_confirm') : null}
        </button>
      )}
    </>
  )

  const firstNote = p.blockers[0] ? { level: 'blocker' as const, text: t(`campaigns.g_block_${p.blockers[0].id}`, noteParams(p.blockers[0].params, fmt)) }
    : p.warnings[0] ? { level: 'warning' as const, text: t(`campaigns.g_warn_${p.warnings[0].id}`, noteParams(p.warnings[0].params, fmt)) } : null

  return (
    <Block icon={iconOf(rules)} title={g.name} pill={pill} chips={chips} actions={actions}>
      {g.status === 'live' && campaigns.length > 0 ? (
        <div className="space-y-2">{[...campaigns].sort((a, b) => Number(isRunning(b)) - Number(isRunning(a))).map(item)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: t('campaigns.g_stat_products'), value: fmtInt.format(p.counts.included) },
              { label: t('campaigns.g_stat_conversions'), value: fmtNum.format(p.conversions30) },
              p.type === 'shopping'
                ? { label: t('campaigns.g_stat_cpc'), value: p.cpc_ceiling !== null ? fmt2.format(p.cpc_ceiling) : '—' }
                : { label: t('campaigns.econ_target'), value: p.start_target !== null ? fmtNum.format(p.start_target) : t('campaigns.g_no_target_short') },
              { label: t('campaigns.g_stat_budget'), value: p.budget.daily !== null ? fmt.format(p.budget.daily) : '—' },
            ].map(k => (
              <div key={k.label} className="rounded-lg bg-neutral-50 px-3 py-2">
                <p className="text-[10px] text-neutral-400">{k.label}</p>
                <p className="text-[14px] font-semibold text-neutral-900 tabular-nums">{k.value}</p>
              </div>
            ))}
          </div>
          {firstNote && (
            <p className={`mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed ${firstNote.level === 'blocker' ? 'text-red-600' : 'text-amber-700'}`}>
              {firstNote.level === 'blocker' ? <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />}
              {firstNote.text}
            </p>
          )}
          {g.status === 'ended' && campaigns.length > 0 && <div className="mt-3 space-y-2">{campaigns.map(item)}</div>}
        </>
      )}
    </Block>
  )
}
