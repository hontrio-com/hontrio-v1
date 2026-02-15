import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const { user_id, plan } = await request.json()

    if (!user_id || !plan) {
      return NextResponse.json({ error: 'Date incomplete' }, { status: 400 })
    }

    const validPlans = ['free', 'starter', 'professional', 'enterprise']
    if (!validPlans.includes(plan)) {
      return NextResponse.json({ error: 'Plan invalid' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('users')
      .update({ plan })
      .eq('id', user_id)

    if (error) {
      return NextResponse.json({ error: 'Eroare la actualizarea planului' }, { status: 500 })
    }

    return NextResponse.json({ success: true, plan })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}