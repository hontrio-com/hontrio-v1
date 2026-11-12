import type { Plan } from '@/lib/campaigns/plan'
import type { GroupPlan } from '@/lib/campaigns/groups'
import type { AuditResult } from '@/lib/google/audit'
import type { LiveCampaign } from '@/components/campaigns/live-campaigns'

// =============================================
// Ce primește pagina Campanii de la GET /api/campaigns/plan.
// =============================================

export type AuditData = { checked_at: string; fresh: boolean; error: string | null; result: AuditResult | null }

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

/** O zi din evoluția campaniilor Hontrio, la un loc. */
export type SeriesPoint = { date: string; cost: number; value: number; conversions: number }

export type CampaignsData = {
  store: {
    platform: string; supported: boolean; store_name?: string | null; currency?: string
    /** Ultima trecere a pilotului și, dacă n-a putut lucra (cont necitit, acces pierdut), de ce: cheie salvată. */
    pilot?: { synced_at: string | null; error: string | null }
  } | null
  plan: Plan | null
  audit?: AuditData | null
  campaigns?: LiveCampaign[]
  proposals?: ActionItem[]
  journal?: ActionItem[]
  groups?: GroupPlan[]
  today?: string
  series?: SeriesPoint[]
}
