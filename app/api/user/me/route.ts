import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { logApiError } from '@/lib/logger'

export async function GET() {
  const ROUTE = '/api/user/me'
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      logApiError(ROUTE, 401, 'Sesiune lipsă')
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const userId = (session.user as any).id
    if (!userId) {
      logApiError(ROUTE, 400, 'userId lipsă din token', { sessionUser: JSON.stringify(session.user) })
      return NextResponse.json({ error: 'ID utilizator lipsă din sesiune' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, role, plan, credits, onboarding_completed, avatar_url, created_at')
      .eq('id', userId)
      .single()

    if (error || !user) {
      logApiError(ROUTE, 404, 'User negăsit în DB', { userId, dbError: error?.message })
      return NextResponse.json({ error: 'Utilizatorul nu a fost găsit' }, { status: 404 })
    }

    return NextResponse.json({
      user,
      credits: user.credits,
      plan: user.plan,
      role: user.role,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
    })
  } catch (err) {
    logApiError(ROUTE, 500, 'Eroare neașteptată', { error: String(err) })
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}