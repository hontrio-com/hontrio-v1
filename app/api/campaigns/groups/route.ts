import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { isCommercePlatform } from '@/lib/commerce/sync'
import { getActiveStore } from '@/lib/stores/active'
import { GROUP_COLUMNS } from '@/lib/campaigns/context'
import { MAX_GROUPS, parseGroup, todayIn } from '@/lib/campaigns/groups'
import { parseGroupFields } from '@/lib/campaigns/group-input'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/campaigns/groups — o grupă nouă (ciornă) a magazinului activ:
// numele, regulile (categorii, branduri, preț, reduceri, produse alese de
// mână), obiectivul, bugetul, tipul campaniei și perioada. Lansarea e separată
// (POST /api/campaigns/launch cu group_id).
// =============================================

const ROUTE = '/api/campaigns/groups'

export async function POST(request: Request) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: store, error: storeError } = await getActiveStore<{ id: string; platform: string; timezone: string | null }>(supabase, userId, 'id, platform, timezone')
  if (storeError) {
    logApiError(ROUTE, 500, 'Eroare la citirea magazinului', { userId, error: storeError.message })
    return NextResponse.json({ error: t('sync.store_read_failed') }, { status: 500 })
  }
  if (!store || !isCommercePlatform(store.platform)) return NextResponse.json({ error: t('sync.platform_unsupported') }, { status: 400 })

  const parsed = parseGroupFields(body, todayIn(store.timezone))
  if ('error' in parsed) return NextResponse.json({ error: t(parsed.error) }, { status: 400 })
  const { fields } = parsed
  if (!fields.name || !fields.rules) return NextResponse.json({ error: t('campaigns.group_empty') }, { status: 400 })

  const { data: existing } = await supabase.from('ad_product_groups').select('position, status').eq('store_id', store.id)
  const open = (existing ?? []).filter(g => g.status !== 'ended').length
  if (open >= MAX_GROUPS) return NextResponse.json({ error: t('campaigns.group_limit', { max: MAX_GROUPS }) }, { status: 409 })
  const position = Math.max(0, ...(existing ?? []).map(g => Number(g.position) || 0)) + 1

  // Obiectivul implicit e al magazinului (ciorna planului)
  const { data: draft } = await supabase.from('ad_campaigns').select('goal').eq('store_id', store.id).eq('status', 'draft').maybeSingle()
  const { data: row, error } = await supabase.from('ad_product_groups').insert({
    user_id: userId,
    store_id: store.id,
    name: fields.name,
    rules: fields.rules,
    goal: fields.goal ?? draft?.goal ?? 'balanced',
    daily_budget: fields.daily_budget ?? null,
    campaign_type: fields.campaign_type ?? 'auto',
    starts_on: fields.starts_on ?? null,
    ends_on: fields.ends_on ?? null,
    position,
  }).select(GROUP_COLUMNS).single()
  if (error || !row) {
    logApiError(ROUTE, 500, 'Eroare la salvarea grupei', { userId, error: error?.message ?? 'niciun rând' })
    return NextResponse.json({ error: t('api.save_failed') }, { status: 500 })
  }
  return NextResponse.json({ group: parseGroup(row as Record<string, unknown>) })
}
