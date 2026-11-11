import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'

// =============================================
// GET /api/admin/stats — câți oameni, magazine și produse are platforma și
// cine s-a înscris ultimul. Banii sunt în Raportul financiar.
// =============================================

export async function GET() {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })
    }

    const supabase = createAdminClient()
    const [users, stores, products] = await Promise.all([
      supabase.from('users').select('id, email, name, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(10),
      supabase.from('stores').select('id', { count: 'exact', head: true }),
      // Produsele magazinelor, din modelul comun (o ofertă = un produs sau o variantă)
      supabase.from('commerce_offers').select('id', { count: 'exact', head: true }),
    ])

    return NextResponse.json({
      totalUsers: users.count || 0,
      totalStores: stores.count || 0,
      totalProducts: products.count || 0,
      recentUsers: users.data || [],
    })
  } catch (err) {
    console.error('Stats error:', err)
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
