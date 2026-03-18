import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_ML_WEIGHTS } from '@/lib/risk/engine'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const store_id = searchParams.get('store_id')
    if (!store_id) return NextResponse.json({ error: 'store_id required' }, { status: 400 })

    const supabase = createAdminClient()

    // Verifică ownership store
    const { data: store } = await supabase.from('stores')
      .select('id, store_url').eq('id', store_id).eq('user_id', (session.user as any).id).single()
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

    const { data: settings } = await supabase
      .from('risk_store_settings')
      .select('*')
      .eq('store_id', store_id)
      .single()

    // Default settings dacă nu există
    const defaults = {
      store_id,
      max_orders_per_day: 3,
      min_collection_rate_pct: 50,
      flag_night_orders: true,
      flag_temp_email: true,
      flag_new_account_days: 7,
      flag_high_value_cod_ron: 500,
      score_watch_threshold: 41,
      score_problematic_threshold: 61,
      score_blocked_threshold: 81,
      alert_on_blocked: true,
      alert_on_problematic: true,
      alert_on_watch: false,
      email_alerts_enabled: true,
      alert_email: null,
      weekly_report_enabled: true,
      participate_in_global_blacklist: true,
      ml_weights: DEFAULT_ML_WEIGHTS,
      shipping_cost_ron: 15,
      return_shipping_cost_ron: 12,
    }

    const ml = settings?.ml_weights || DEFAULT_ML_WEIGHTS
    const mlAccuracy = ml.total_predictions > 0
      ? Math.round((ml.correct_predictions / ml.total_predictions) * 100)
      : null

    return NextResponse.json({
      settings: { ...defaults, ...settings },
      mlAccuracy,
      mlTotalPredictions: ml.total_predictions,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { store_id, ...updates } = body
    if (!store_id) return NextResponse.json({ error: 'store_id required' }, { status: 400 })

    const supabase = createAdminClient()

    // Verifică ownership
    const { data: store } = await supabase.from('stores')
      .select('id').eq('id', store_id).eq('user_id', (session.user as any).id).single()
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

    // Câmpuri permise de actualizat
    const ALLOWED = [
      'max_orders_per_day', 'min_collection_rate_pct', 'flag_night_orders',
      'flag_temp_email', 'flag_new_account_days', 'flag_high_value_cod_ron',
      'score_watch_threshold', 'score_problematic_threshold', 'score_blocked_threshold',
      'alert_on_blocked', 'alert_on_problematic', 'alert_on_watch',
      'email_alerts_enabled', 'alert_email', 'weekly_report_enabled',
      'participate_in_global_blacklist', 'shipping_cost_ron', 'return_shipping_cost_ron',
    ]

    const sanitized: Record<string, any> = { store_id, user_id: (session.user as any).id, updated_at: new Date().toISOString() }
    for (const key of ALLOWED) {
      if (key in updates) sanitized[key] = updates[key]
    }

    await supabase.from('risk_store_settings').upsert(sanitized, { onConflict: 'store_id' })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}