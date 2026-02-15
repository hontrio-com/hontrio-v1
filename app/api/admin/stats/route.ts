import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const supabase = createAdminClient()

    const [users, stores, products, images, transactions] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(10),
      supabase.from('stores').select('*', { count: 'exact' }),
      supabase.from('products').select('*', { count: 'exact' }),
      supabase.from('generated_images').select('*', { count: 'exact' }),
      supabase.from('credit_transactions').select('*').eq('type', 'usage'),
    ])

    const totalCreditsUsed = (transactions.data || []).reduce(
      (sum: number, t: any) => sum + Math.abs(t.amount), 0
    )

    // Ultimele joburi de generare
    const { data: recentJobs } = await supabase
      .from('generation_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      totalUsers: users.count || 0,
      totalStores: stores.count || 0,
      totalProducts: products.count || 0,
      totalImages: images.count || 0,
      totalCreditsUsed,
      recentUsers: users.data || [],
      recentJobs: recentJobs || [],
    })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}