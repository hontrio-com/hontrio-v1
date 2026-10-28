import type { Plan } from '@/lib/campaigns/plan'
import type { GroupPlan } from '@/lib/campaigns/groups'
import { isRunning, type LiveCampaign } from '@/components/campaigns/live-campaigns'

// =============================================
// Campaniile, cum le vede omul: campania principală și câte una pentru
// fiecare grupă a lui. În spatele fiecăreia pot fi mai multe campanii Google
// (pornirea încheiată și Performance Max-ul de după, segmentele de marjă):
// cifrele lor se adună.
// =============================================

export type ViewStatus = 'running' | 'paused' | 'draft' | 'ended' | 'not_launched'

export type CampaignView = {
  key: string
  kind: 'main' | 'group'
  group: GroupPlan | null
  status: ViewStatus
  /** Campaniile ei din Google Ads: întâi cele care rulează. */
  google: LiveCampaign[]
  type: 'shopping' | 'performance_max'
  /** Bugetul pe zi: al celor care rulează, altfel cel plănuit. */
  budget: number | null
  last30: { cost: number; value: number; conversions: number; profit: number | null }
  roas: number | null
  trend: { date: string; value: number; profit: number | null }[]
}

const byRunning = (a: LiveCampaign, b: LiveCampaign) => Number(isRunning(b)) - Number(isRunning(a))

function sum(google: LiveCampaign[]): CampaignView['last30'] {
  const anyProfit = google.some(c => c.last30.profit !== null)
  return google.reduce((s, c) => ({
    cost: s.cost + c.last30.cost,
    value: s.value + c.last30.value,
    conversions: s.conversions + c.last30.conversions,
    profit: anyProfit ? (s.profit ?? 0) + (c.last30.profit ?? 0) : null,
  }), { cost: 0, value: 0, conversions: 0, profit: anyProfit ? 0 : null } as CampaignView['last30'])
}

function trendOf(google: LiveCampaign[]): CampaignView['trend'] {
  const out = new Map<string, { value: number; profit: number | null }>()
  for (const c of google) for (const p of c.trend ?? []) {
    const prev = out.get(p.date) ?? { value: 0, profit: null }
    out.set(p.date, { value: prev.value + p.value, profit: p.profit === null ? prev.profit : (prev.profit ?? 0) + p.profit })
  }
  return [...out].sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, ...v }))
}

function statusOf(google: LiveCampaign[], fallback: ViewStatus): ViewStatus {
  if (google.some(c => c.status === 'active')) return 'running'
  if (google.some(c => c.status === 'paused')) return 'paused'
  return fallback
}

export function buildViews(plan: Plan, groups: GroupPlan[], campaigns: LiveCampaign[]): CampaignView[] {
  const view = (key: string, kind: CampaignView['kind'], group: GroupPlan | null, google: LiveCampaign[], fallback: ViewStatus, planned: { type: CampaignView['type']; budget: number | null }): CampaignView => {
    const running = google.filter(isRunning)
    const totals = sum(google)
    return {
      key, kind, group,
      status: statusOf(google, fallback),
      google: [...google].sort(byRunning),
      type: running.length ? (running.every(c => c.type === 'shopping') ? 'shopping' : 'performance_max') : planned.type,
      budget: running.length ? running.reduce((s, c) => s + (c.daily_budget ?? 0), 0) : planned.budget,
      last30: totals,
      roas: totals.cost > 0 ? totals.value / totals.cost : null,
      trend: trendOf(google),
    }
  }

  // Campaniile unei grupe șterse nu mai sunt ale nimănui: cifrele lor rămân în Rapoarte
  const main = campaigns.filter(c => !c.group_id && c.segment !== 'group')
  const out: CampaignView[] = [
    view('main', 'main', null, main, main.length ? 'ended' : 'not_launched', { type: plan.structure.type, budget: plan.budget.daily }),
  ]
  for (const g of groups) {
    const google = campaigns.filter(c => c.group_id === g.group.id)
    const fallback: ViewStatus = g.group.status === 'draft' ? 'draft' : g.group.status === 'ended' ? 'ended' : 'paused'
    out.push(view(g.group.id, 'group', g, google, fallback, { type: g.type, budget: g.budget.daily }))
  }
  return out
}

/** Ordinea în listă: ce rulează, ce stă pe pauză, ciornele, apoi ce s-a încheiat. */
export const STATUS_ORDER: Record<ViewStatus, number> = { running: 0, paused: 1, not_launched: 2, draft: 3, ended: 4 }
