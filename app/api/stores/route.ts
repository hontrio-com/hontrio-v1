import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const userId = (session.user as any).id

    const { data: store, error } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: 'Eroare la încărcarea magazinului' }, { status: 500 })
    }

    return NextResponse.json({ store: store || null })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}