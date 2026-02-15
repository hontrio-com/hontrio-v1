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

    const { data: users } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    return NextResponse.json({ users: users || [] })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}