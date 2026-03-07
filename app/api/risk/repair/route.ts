import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { recalc, getSettings } from '@/lib/risk/identity'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    const supabase = createAdminClient()
    const { data: store } = await supabase.from('stores')
      .select('id').eq('user_id', (session.user as any).id).single()
    if (!store) return NextResponse.json({ error: 'Niciun magazin' }, { status: 404 })

    const { data: customers } = await supabase.from('risk_customers')
      .select('id').eq('store_id', store.id)
    if (!customers?.length) return NextResponse.json({ ok: true, recalculated: 0 })

    const settings = await getSettings(supabase, store.id)
    let recalculated = 0
    for (const c of customers) {
      try { await recalc(supabase, c.id, store.id, settings); recalculated++ } catch {}
    }
    return NextResponse.json({ ok: true, recalculated })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}