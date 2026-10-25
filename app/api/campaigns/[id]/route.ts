import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'
import { applyAndLog, loadApplyEnv, reconcileProducts } from '@/lib/ads/autopilot'
import { translateStored } from '@/lib/i18n/stored'
import { getT } from '@/lib/i18n/server'

// =============================================
// PATCH /api/campaigns/{id} — omul oprește sau repornește o campanie Hontrio.
// Repornirea pune și produsele la zi cu planul (s-ar putea să se fi schimbat
// cât a stat oprită). Body: { status: 'paused' | 'active' }
// =============================================

const ROUTE = '/api/campaigns/[id]'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await getT()
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
  const userId = session.user.id
  const { id } = await params

  let body: { status?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
  }
  if (body.status !== 'paused' && body.status !== 'active') return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })

  const supabase = createAdminClient()
  const { data: campaign } = await supabase.from('ad_campaigns').select('id, store_id, status')
    .eq('id', id).eq('user_id', userId).in('status', ['active', 'paused']).maybeSingle()
  if (!campaign) return NextResponse.json({ error: t('campaigns.action_not_found') }, { status: 404 })
  if (campaign.status === body.status) return NextResponse.json({ status: campaign.status })

  const env = await loadApplyEnv(supabase, campaign.store_id)
  if ('error' in env) return NextResponse.json({ error: translateStored(t, env.error) }, { status: 409 })

  const kind = body.status === 'paused' ? 'pause' : 'enable'
  const r = await applyAndLog(env, kind, campaign.id, {}, { source: 'user' })
  if (!r.ok) {
    logApiError(ROUTE, 502, 'Campania n-a putut fi schimbată', { userId, kind, error: r.error })
    return NextResponse.json({ error: translateStored(t, r.error ?? null) }, { status: 502 })
  }
  if (kind === 'enable') {
    env.campaigns = env.campaigns.map(c => (c.id === campaign.id ? { ...c, status: 'active' } : c))
    await reconcileProducts(env)
  }
  return NextResponse.json({ status: body.status })
}
