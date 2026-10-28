'use client'

import { BadgePercent, ChevronRight, Coins, FolderTree, Layers, ListChecks, Tag, type LucideIcon } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { Badge, type Tone } from '@/components/app/badge'
import { Table, Td, Th, Tr } from '@/components/app/table'
import { Sparkline, CHART } from '@/components/app/charts'
import type { GroupRules } from '@/lib/campaigns/groups'
import type { Plan } from '@/lib/campaigns/plan'
import type { Formats } from '@/components/campaigns/formats'
import type { CampaignView, ViewStatus } from '@/components/campaigns/views'

// =============================================
// Lista campaniilor (ca tabelele Stripe): fiecare rând e o campanie a
// omului (principala sau o grupă), cu starea, banii pe 30 de zile și
// tendința; un clic deschide fișa ei.
// =============================================

export const STATUS: Record<ViewStatus, { tone: Tone; key: string; live?: boolean }> = {
  running: { tone: 'green', key: 'campaigns.status_active', live: true },
  paused: { tone: 'amber', key: 'campaigns.status_paused' },
  draft: { tone: 'sky', key: 'campaigns.g_status_draft' },
  ended: { tone: 'neutral', key: 'campaigns.status_ended' },
  not_launched: { tone: 'neutral', key: 'campaigns.board_not_launched' },
}

/** Iconița unei campanii, după ce o definește. */
export function iconOf(rules: GroupRules | null): LucideIcon {
  if (!rules) return Layers
  if (rules.categories.length) return FolderTree
  if (rules.brands.length) return Tag
  if (rules.on_sale) return BadgePercent
  if (rules.price_min !== null || rules.price_max !== null) return Coins
  return ListChecks
}

const short = (xs: string[]) => (xs.length <= 2 ? xs.join(', ') : `${xs.slice(0, 2).join(', ')} +${xs.length - 2}`)

/** Numele și rândul de sub el (ce produse, ce tip). */
export function useViewLabels(plan: Plan, f: Formats) {
  const { t } = useT()
  const typeName = (v: CampaignView) => t(v.type === 'shopping' ? 'campaigns.g_type_shopping' : 'campaigns.g_type_performance_max')
  return {
    name: (v: CampaignView) => (v.kind === 'main' ? t('campaigns.board_main') : v.group!.group.name),
    subtitle: (v: CampaignView) => {
      // Doar grupele lansate iau produse din campania principală
      if (v.kind === 'main') return `${t(plan.counts.in_groups > 0 ? 'campaigns.view_main_rest' : 'campaigns.view_main_all')} · ${typeName(v)}`
      const r = v.group!.group.rules
      const what = r.categories.length ? short(r.categories)
        : r.brands.length ? short(r.brands)
        : r.on_sale ? t('campaigns.rule_sale')
        : r.price_min !== null || r.price_max !== null
          ? (r.price_min !== null && r.price_max !== null ? t('campaigns.g_price_between', { min: f.money.format(r.price_min), max: f.money.format(r.price_max) })
            : r.price_min !== null ? t('campaigns.g_price_from', { min: f.money.format(r.price_min) }) : t('campaigns.g_price_to', { max: f.money.format(r.price_max ?? 0) }))
          : t('campaigns.g_name_manual')
      return `${what} · ${typeName(v)}`
    },
    products: (v: CampaignView) => (v.kind === 'main' ? plan.counts.included : v.group!.counts.included),
  }
}

export function CampaignTable({ views, plan, f, onOpen, compact }: {
  views: CampaignView[]; plan: Plan; f: Formats; onOpen: (v: CampaignView) => void; compact?: boolean
}) {
  const { t } = useT()
  const labels = useViewLabels(plan, f)
  return (
    <Table>
      <thead>
        <tr>
          <Th className="min-w-[240px]">{t('campaigns.col_campaign')}</Th>
          <Th>{t('campaigns.col_status')}</Th>
          {!compact && <Th align="right">{t('campaigns.col_budget')}</Th>}
          <Th align="right">{t('campaigns.kpi_spend')}</Th>
          {!compact && <Th align="right">{t('campaigns.kpi_value')}</Th>}
          <Th align="right">{t('campaigns.kpi_roas')}</Th>
          <Th align="right">{t('campaigns.kpi_profit')}</Th>
          {!compact && <Th className="w-[120px]">{t('campaigns.col_trend')}</Th>}
          <Th className="w-8" />
        </tr>
      </thead>
      <tbody>
        {views.map(v => {
          const Icon = iconOf(v.group?.group.rules ?? null)
          const s = STATUS[v.status]
          const silent = v.status === 'draft' || v.status === 'not_launched'
          const profit = v.last30.profit
          return (
            <Tr key={v.key} clickable onClick={() => onOpen(v)} onKeyDown={e => { if (e.key === 'Enter') onOpen(v) }} tabIndex={0}>
              <Td>
                <div className="flex items-center gap-3">
                  <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg ring-1',
                    v.kind === 'main' ? 'bg-brand-50 text-brand-600 ring-brand-100' : 'bg-neutral-50 text-neutral-600 ring-neutral-200/70')}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-900">{labels.name(v)}</p>
                    <p className="truncate text-[12px] text-neutral-500">{labels.subtitle(v)}</p>
                  </div>
                </div>
              </Td>
              <Td><Badge tone={s.tone} dot live={s.live}>{t(s.key)}</Badge></Td>
              {!compact && <Td align="right" className="text-neutral-700">{v.budget !== null ? f.money.format(v.budget) : '—'}</Td>}
              <Td align="right" className={silent ? 'text-neutral-300' : 'text-neutral-700'}>{silent ? '—' : f.money.format(v.last30.cost)}</Td>
              {!compact && <Td align="right" className={silent ? 'text-neutral-300' : 'text-neutral-700'}>{silent ? '—' : f.money.format(v.last30.value)}</Td>}
              <Td align="right" className={silent || v.roas === null ? 'text-neutral-300' : 'font-medium text-neutral-900'}>{silent || v.roas === null ? '—' : f.num.format(v.roas)}</Td>
              <Td align="right" className={cn('font-medium', silent || profit === null ? 'text-neutral-300' : profit < 0 ? 'text-red-600' : profit > 0 ? 'text-emerald-600' : 'text-neutral-700')}>
                {silent || profit === null ? '—' : f.money.format(profit)}
              </Td>
              {!compact && (
                <Td>
                  {v.trend.length > 1 && v.trend.some(p => p.value > 0)
                    ? <div className="w-[104px]"><Sparkline data={v.trend.map(p => ({ label: p.date, value: p.value }))} height={28} color={v.status === 'running' ? CHART.brand : CHART.neutral} /></div>
                    : <span className="text-[12px] text-neutral-300">—</span>}
                </Td>
              )}
              <Td><ChevronRight className="size-4 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-500" /></Td>
            </Tr>
          )
        })}
      </tbody>
    </Table>
  )
}
