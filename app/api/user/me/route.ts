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
      .maybeSingle()

    if (error) {
      logApiError(ROUTE, 500, 'DB error la user/me', { userId, dbError: error.message })
      return NextResponse.json({ error: 'Eroare la citirea profilului' }, { status: 500 })
    }

    if (!user) {
      // Auto-repair: creăm profilul dacă lipsește
      logApiError(ROUTE, 404, 'User negăsit — se repară automat', { userId })
      const { data: newUser, error: createErr } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: (session.user as any).email || '',
          name: session.user.name || 'Utilizator',
          role: 'user',
          credits: 20,
          plan: 'free',
          onboarding_completed: false,
        })
        .select('id, email, name, role, plan, credits, onboarding_completed, avatar_url, created_at')
        .single()

      if (createErr || !newUser) {
        return NextResponse.json({ error: 'Utilizatorul nu a fost găsit și nu s-a putut crea' }, { status: 404 })
      }

      return NextResponse.json({
        user: newUser,
        credits: newUser.credits,
        plan: newUser.plan,
        role: newUser.role,
        name: newUser.name,
        email: newUser.email,
        avatar_url: newUser.avatar_url,
      })
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