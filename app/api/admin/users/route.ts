import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const supabase = createAdminClient()

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 100
    const offset = (page - 1) * limit

    const { data: users, count } = await supabase
      .from('users')
      .select('id, email, name, credits, plan, role, created_at, stripe_customer_id, stripe_subscription_id', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    return NextResponse.json({ users: users || [], total: count || 0, page, limit })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}