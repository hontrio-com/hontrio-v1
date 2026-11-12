'use client'

import { createElement, useState, type ReactNode } from 'react'
import { ArrowRight, CalendarRange, Pencil, Rocket, Square, Trash2 } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Sheet, SheetHeader } from '@/components/app/sheet'
import { Badge } from '@/components/app/badge'
import { Button, textActionStyles } from '@/components/app/button'
import { Callout } from '@/components/app/feedback'
import { TrendChart, CHART } from '@/components/app/charts'
import { LiveCampaignItem } from '@/components/campaigns/live-campaigns'
import { STATUS, iconOf, useViewLabels } from '@/components/campaigns/campaign-table'
import { noteParams, type Step } from '@/components/campaigns/group-editor'
import { day, type Formats } from '@/components/app/formats'
import type { CampaignView } from '@/components/campaigns/views'
import type { GroupPlan, GroupRules } from '@/lib/campaigns/groups'
import type { Plan } from '@/lib/campaigns/plan'

// =============================================
// Fișa unei campanii, într-un panou lateral: starea și acțiunile ei, cifrele
// pe 30 de zile cu evoluția, ce produse vinde și campaniile din Google Ads
// din spatele ei (cu pauza și repornirea).
// =============================================

type Props = {
  view: CampaignView | null
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: Plan
  f: Formats
  /** Editorul campaniei pe grupă, la pasul dat. */
  onEdit: (g: GroupPlan, step: Step) => void
  /** Planul campaniei principale (și lansarea ei). */
  onPlan: () => void
  onChanged: () => Promise<unknown>
}

/** Iconița campaniei, ca element: iconOf alege una dintre iconițele fixe, nu creează o componentă la randare. */
const viewIcon = (rules: GroupRules | null) => createElement(iconOf(rules))

export function CampaignSheet({ view, open, onOpenChange, ...rest }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} width={760}>
      {/* Cheia: fiecare campanie își începe fișa curată (confirmările nu trec de la una la alta) */}
      {view && <SheetBody key={view.key} view={view} onClose={() => onOpenChange(false)} {...rest} />}
    </Sheet>
  )
}

function SheetBody({ view: v, onClose, plan, f, onEdit, onPlan, onChanged }: Omit<Props, 'view' | 'open' | 'onOpenChange'> & { view: CampaignView; onClose: () => void }) {
  const { t } = useT()
  const labels = useViewLabels(plan, f)
  const [confirm, setConfirm] = useState<'end' | 'delete' | null>(null)
  const [busy, setBusy] = useState(false)
  // Ce n-a mers (pauza, încheierea), arătat în fișă: pagina de sub ea nu se vede
  const [error, setError] = useState<string | null>(null)
  const onError = (text: string) => setError(text)
  const g = v.group
  const s = STATUS[v.status]
  const live = v.google.filter(c => c.status !== 'ended')
  const hasNumbers = v.google.length > 0 && (v.last30.cost > 0 || live.length > 0)

  async function act(kind: 'end' | 'delete') {
    if (!g) return
    if (confirm !== kind) { setConfirm(kind); return }
    setBusy(true)
    setError(null)
    try {
      const r = await fetch(`/api/campaigns/groups/${g.group.id}`, kind === 'delete'
        ? { method: 'DELETE' }
        : { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ended' }) })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) onError(body.error || t('campaigns.save_error'))
      else if (kind === 'delete') onClose()
      await onChanged()
    } catch {
      onError(t('campaigns.save_error'))
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  // ── Acțiunile ──────────────────────────────────────────────────────────────
  let actions: ReactNode
  if (g) {
    const status = g.group.status
    actions = (
      <>
        {status !== 'live' && (
          <Button variant="primary" size="sm" disabled={busy} onClick={() => onEdit(g, 3)}>
            <Rocket />{t(status === 'ended' ? 'campaigns.g_relaunch' : 'campaigns.g_launch')}
          </Button>
        )}
        <Button size="sm" disabled={busy} onClick={() => onEdit(g, status === 'live' ? 2 : 1)}><Pencil />{t('campaigns.g_edit')}</Button>
        {status === 'live' ? (
          <Button size="sm" variant={confirm === 'end' ? 'danger' : 'secondary'} loading={busy} onClick={() => act('end')}>
            {!busy && <Square />}{t(confirm === 'end' ? 'campaigns.g_end_confirm' : 'campaigns.g_end')}
          </Button>
        ) : (
          <Button size="sm" variant={confirm === 'delete' ? 'danger' : 'ghost'} loading={busy} onClick={() => act('delete')}>
            {!busy && <Trash2 />}{t(confirm === 'delete' ? 'campaigns.g_delete_confirm' : 'campaigns.g_delete')}
          </Button>
        )}
      </>
    )
  } else {
    actions = v.status === 'not_launched'
      ? <Button variant="primary" size="sm" onClick={onPlan}><Rocket />{t('campaigns.sheet_prepare_launch')}</Button>
      : <Button size="sm" onClick={onPlan}>{t('campaigns.board_see_plan')}<ArrowRight /></Button>
  }

  // ROAS sub 1: reclamele au costat mai mult decât au adus vânzările
  const stats: { label: string; value: string; tone?: 'bad' }[] = [
    { label: t('campaigns.kpi_spend'), value: f.money.format(v.last30.cost) },
    { label: t('campaigns.kpi_value'), value: f.money.format(v.last30.value) },
    { label: t('campaigns.kpi_roas'), value: v.roas === null ? '—' : f.num.format(v.roas), tone: v.roas !== null && v.roas < 1 ? 'bad' : undefined },
    { label: t('campaigns.kpi_conversions'), value: f.num.format(Math.round(v.last30.conversions * 10) / 10) },
  ]

  return (
    <>
      <SheetHeader icon={viewIcon(g?.group.rules ?? null)} title={labels.name(v)} description={labels.subtitle(v)} onClose={onClose}>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={s.tone} dot live={s.live}>{t(s.key)}</Badge>
            {v.budget !== null && <Badge>{t('campaigns.g_budget_value', { budget: f.money.format(v.budget) })}</Badge>}
            {g?.group.ends_on && (
              <Badge><CalendarRange className="size-3" />{t(g.group.starts_on ? 'campaigns.g_period_between' : 'campaigns.g_period_until', {
                start: g.group.starts_on ? f.date.format(day(g.group.starts_on)) : '', end: f.date.format(day(g.group.ends_on)),
              })}</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">{actions}</div>
        </div>
      </SheetHeader>

      <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
        {error && <Callout tone="danger" onClose={() => setError(null)}>{error}</Callout>}

        {/* Cifrele pe 30 de zile */}
        {hasNumbers && (
          <section>
            <SectionTitle>{t('campaigns.sheet_last30')}</SectionTitle>
            <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-neutral-200/70 ring-1 ring-neutral-200/70 sm:grid-cols-4">
              {stats.map(k => (
                <div key={k.label} className="bg-white px-4 py-3">
                  <dt className="text-[12px] text-neutral-500">{k.label}</dt>
                  <dd className={cn('mt-1 text-[18px] font-semibold tabular-nums tracking-[-0.015em]', k.tone === 'bad' ? 'text-red-600' : 'text-neutral-950')}>{k.value}</dd>
                </div>
              ))}
            </dl>
            {v.trend.length > 1 && v.trend.some(p => p.value > 0) && (
              <div className="mt-4 rounded-xl border border-neutral-200/80 px-2 pb-2 pt-3">
                <p className="px-2 text-[12px] font-medium text-neutral-500">{t('campaigns.sheet_trend')}</p>
                <TrendChart height={150} color={CHART.brand} format={n => f.money.format(n)} axisFormat={n => f.compact.format(n)}
                  data={v.trend.map(p => ({ label: f.shortDate.format(day(p.date)), value: p.value }))} />
              </div>
            )}
          </section>
        )}

        {/* O grupă nelansată: planul ei pe scurt și ce trebuie știut */}
        {g && g.group.status !== 'live' && (
          <section>
            <SectionTitle>{t(g.group.status === 'ended' ? 'campaigns.sheet_relaunch_plan' : 'campaigns.sheet_plan')}</SectionTitle>
            <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-neutral-200/70 ring-1 ring-neutral-200/70 sm:grid-cols-4">
              {[
                { label: t('campaigns.g_stat_products'), value: f.int.format(g.counts.included) },
                { label: t('campaigns.g_stat_conversions'), value: f.num.format(g.conversions30) },
                g.type === 'shopping'
                  ? { label: t('campaigns.g_stat_cpc'), value: g.cpc_ceiling !== null ? f.money2.format(g.cpc_ceiling) : '—' }
                  : { label: t('campaigns.g_stat_type'), value: t('campaigns.type_pmax') },
                { label: t('campaigns.g_stat_budget'), value: g.budget.daily !== null ? f.money.format(g.budget.daily) : '—' },
              ].map(k => (
                <div key={k.label} className="bg-white px-4 py-3">
                  <dt className="text-[12px] text-neutral-500">{k.label}</dt>
                  <dd className="mt-1 text-[18px] font-semibold tabular-nums tracking-[-0.015em] text-neutral-950">{k.value}</dd>
                </div>
              ))}
            </dl>
            {(g.blockers.length > 0 || g.warnings.length > 0) && (
              <div className="mt-4 space-y-2">
                {g.blockers.map(b => <Callout key={b.id} tone="danger">{t(`campaigns.g_block_${b.id}`, noteParams(b.params, f.money))}</Callout>)}
                {g.warnings.map(w => <Callout key={w.id} tone="warning">{t(`campaigns.g_warn_${w.id}`, noteParams(w.params, f.money))}</Callout>)}
              </div>
            )}
          </section>
        )}

        {/* Ce produse vinde */}
        <section>
          <SectionTitle>{t('campaigns.sheet_products')}</SectionTitle>
          <div className="mt-3 rounded-xl border border-neutral-200/80 p-4">
            <p className="text-[14px] font-semibold text-neutral-900">
              {t('campaigns.g_products_value', { count: labels.products(v) })}
            </p>
            <p className="mt-0.5 text-[13px] text-neutral-500">
              {g ? t('campaigns.sheet_products_group') : t(plan.counts.in_groups > 0 ? 'campaigns.board_main_rest' : 'campaigns.board_main_all')}
            </p>
            {g && <RuleChips plan={g} f={f} />}
            {!g && (
              <button onClick={onPlan} className={cn(textActionStyles, 'mt-3 text-[13px]')}>
                {t('campaigns.sheet_see_products')}<ArrowRight className="size-3.5" />
              </button>
            )}
          </div>
        </section>

        {/* Campaniile din Google Ads */}
        <section>
          <SectionTitle>{t('campaigns.sheet_google')}</SectionTitle>
          {v.google.length ? (
            <div className="mt-3 space-y-3">
              {v.google.map(c => <LiveCampaignItem key={c.id} campaign={c} f={f} onChanged={onChanged} onError={onError} />)}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-center text-[13px] text-neutral-500">{t('campaigns.sheet_google_none')}</p>
          )}
          {v.google.length > 0 && <p className="mt-3 text-[12px] leading-relaxed text-neutral-400">{t('campaigns.live_footer')}</p>}
        </section>
      </div>
    </>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-neutral-400">{children}</h3>
}

const short = (xs: string[]) => (xs.length <= 3 ? xs.join(', ') : `${xs.slice(0, 3).join(', ')} +${xs.length - 3}`)

/** Regulile grupei, ca etichete: tipul, categoriile, brandurile, prețul, reducerile, alegerile de mână. */
function RuleChips({ plan: p, f }: { plan: GroupPlan; f: Formats }) {
  const { t } = useT()
  const r = p.group.rules
  const chips = [
    `${t(p.type === 'shopping' ? 'campaigns.g_type_shopping' : 'campaigns.g_type_performance_max')}${p.group.campaign_type === 'auto' ? ` · ${t('campaigns.g_auto')}` : ''}`,
    r.categories.length ? t('campaigns.rule_categories', { list: short(r.categories) }) : null,
    r.brands.length ? t('campaigns.rule_brands', { list: short(r.brands) }) : null,
    r.price_min !== null || r.price_max !== null
      ? (r.price_min !== null && r.price_max !== null ? t('campaigns.g_price_between', { min: f.money.format(r.price_min), max: f.money.format(r.price_max) })
        : r.price_min !== null ? t('campaigns.g_price_from', { min: f.money.format(r.price_min) }) : t('campaigns.g_price_to', { max: f.money.format(r.price_max ?? 0) }))
      : null,
    r.on_sale ? t('campaigns.rule_sale') : null,
    r.include.length ? t('campaigns.rule_include', { count: r.include.length }) : null,
    r.exclude.length ? t('campaigns.rule_exclude', { count: r.exclude.length }) : null,
  ].filter((x): x is string => !!x)
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {chips.map(c => <span key={c} className="inline-flex h-6 items-center rounded-md bg-neutral-50 px-2 text-[12px] text-neutral-600 ring-1 ring-inset ring-neutral-200/70">{c}</span>)}
    </div>
  )
}
