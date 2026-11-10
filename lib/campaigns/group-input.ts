import { GROUP_TYPES, isDay, isEmptyRules, parseRules, type GroupRules, type GroupType } from '@/lib/campaigns/groups'

// =============================================
// Ce trimite pagina când omul face sau schimbă o grupă, verificat câmp cu
// câmp. Fiecare eroare e o cheie de traducere, ca ruta s-o spună în limba lui.
// =============================================

const MAX_BUDGET = 1_000_000

export type GroupFields = {
  name?: string
  rules?: GroupRules
  daily_budget?: number | null
  campaign_type?: GroupType
  starts_on?: string | null
  ends_on?: string | null
}

/** Câmpurile valide din corpul cererii, sau cheia erorii. `today` = azi (YYYY-MM-DD) în fusul magazinului. */
export function parseGroupFields(body: Record<string, unknown>, today: string): { fields: GroupFields } | { error: string } {
  const fields: GroupFields = {}
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
    if (!name || name.length > 80) return { error: 'campaigns.group_name_invalid' }
    fields.name = name
  }
  if (body.rules !== undefined) {
    const rules = parseRules(body.rules)
    if (isEmptyRules(rules)) return { error: 'campaigns.group_empty' }
    fields.rules = rules
  }
  if (body.daily_budget !== undefined) {
    if (body.daily_budget === null) fields.daily_budget = null
    else {
      const n = Number(body.daily_budget)
      if (typeof body.daily_budget !== 'number' || !Number.isFinite(n) || n <= 0 || n > MAX_BUDGET) return { error: 'campaigns.budget_invalid' }
      fields.daily_budget = Math.round(n * 100) / 100
    }
  }
  if (body.campaign_type !== undefined) {
    if (!GROUP_TYPES.includes(body.campaign_type as GroupType)) return { error: 'campaigns.group_type_invalid' }
    fields.campaign_type = body.campaign_type as GroupType
  }
  for (const k of ['starts_on', 'ends_on'] as const) {
    if (body[k] === undefined) continue
    if (body[k] !== null && !isDay(body[k])) return { error: 'campaigns.group_period_invalid' }
    fields[k] = (body[k] as string | null) ?? null
  }
  if (fields.ends_on && fields.ends_on < today) return { error: 'campaigns.group_period_past' }
  if (fields.starts_on && fields.ends_on && fields.ends_on < fields.starts_on) return { error: 'campaigns.group_period_invalid' }
  return { fields }
}
