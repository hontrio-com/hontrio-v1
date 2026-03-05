import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { recalibrateWeights, DEFAULT_ML_WEIGHTS, type MLWeights } from '@/lib/risk/engine'

// POST — recalibrare manuală sau automată după finalizarea unei comenzi
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const { store_id, order_id, actual_outcome } = await req.json()
    if (!store_id || !order_id || !actual_outcome) {
      return NextResponse.json({ error: 'store_id, order_id, actual_outcome obligatorii' }, { status: 400 })
    }

    const VALID_OUTCOMES = ['collected', 'refused', 'returned', 'not_home', 'cancelled']
    if (!VALID_OUTCOMES.includes(actual_outcome)) {
      return NextResponse.json({ error: 'actual_outcome invalid' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Ia comanda cu flag-urile la momentul plasării
    const { data: order } = await supabase
      .from('risk_orders')
      .select('id, risk_score_at_order, risk_flags, customer_id')
      .eq('id', order_id)
      .eq('user_id', session.user.id)
      .single()
    if (!order) return NextResponse.json({ error: 'Comandă negăsită' }, { status: 404 })

    // Ia label-ul predictit la momentul comenzii (din customer snapshot sau din flags)
    const { data: customer } = await supabase
      .from('risk_customers')
      .select('risk_label, risk_score')
      .eq('id', order.customer_id)
      .single()

    const predictedLabel = customer?.risk_label || 'new'
    const flagsActivated = (order.risk_flags || []).map((f: any) => f.code).filter(Boolean)

    // Ia setările curente cu ML weights
    const { data: settings } = await supabase
      .from('risk_store_settings')
      .select('*')
      .eq('store_id', store_id)
      .single()

    const currentWeights: MLWeights = settings?.ml_weights || { ...DEFAULT_ML_WEIGHTS }

    // Recalibrare
    const newWeights = recalibrateWeights(
      currentWeights,
      predictedLabel,
      actual_outcome as any,
      flagsActivated
    )

    const accuracy = newWeights.total_predictions > 0
      ? Math.round((newWeights.correct_predictions / newWeights.total_predictions) * 100)
      : 0

    // Salvează weights actualizate
    if (settings) {
      await supabase.from('risk_store_settings').update({
        ml_weights: newWeights,
        updated_at: new Date().toISOString(),
      }).eq('store_id', store_id)
    } else {
      await supabase.from('risk_store_settings').insert({
        store_id,
        user_id: session.user.id,
        ml_weights: newWeights,
      })
    }

    return NextResponse.json({
      ok: true,
      accuracy,
      totalPredictions: newWeights.total_predictions,
      correctPredictions: newWeights.correct_predictions,
      weights: newWeights,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET — citește weights curente + acuratețe model pentru un store
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const store_id = searchParams.get('store_id')
    if (!store_id) return NextResponse.json({ error: 'store_id obligatoriu' }, { status: 400 })

    const supabase = createAdminClient()
    const { data: settings } = await supabase
      .from('risk_store_settings')
      .select('ml_weights')
      .eq('store_id', store_id)
      .single()

    const weights: MLWeights = settings?.ml_weights || { ...DEFAULT_ML_WEIGHTS }
    const accuracy = weights.total_predictions > 0
      ? Math.round((weights.correct_predictions / weights.total_predictions) * 100)
      : null

    return NextResponse.json({ weights, accuracy, totalPredictions: weights.total_predictions })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}