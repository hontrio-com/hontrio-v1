import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkName } from '@/lib/auth/validation'
import { logApiError } from '@/lib/logger'
import { getT } from '@/lib/i18n/server'
import { leaveRuleFor } from '@/lib/ads/remove'

// =============================================
// GET /api/user/profile — profilul complet al contului.
// PUT /api/user/profile — { name?, avatar_url?: null, preferences?: { emailNotifications } }
//   Doar ce poate schimba omul: numele, ștergerea pozei (o poză nouă vine prin
//   /api/user/avatar) și preferințele cunoscute. Restul din preferences (ex.
//   momentul acordului GDPR) îl scrie doar serverul și rămâne neatins.
// =============================================

const ROUTE = '/api/user/profile'
// Preferințele pe care le alege omul (toate da/nu)
const USER_PREFERENCES = ['emailNotifications'] as const

export async function GET() {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })

    const { data: user, error } = await createAdminClient()
      .from('users')
      .select('id, name, email, avatar_url, role, preferences, created_at')
      .eq('id', session.user.id)
      .maybeSingle()
    if (error) {
      logApiError(ROUTE, 500, 'Profilul n-a putut fi citit', { userId: session.user.id, error: error.message })
      return NextResponse.json({ error: t('api.profile_load_failed') }, { status: 500 })
    }
    if (!user) return NextResponse.json({ error: t('api.user_not_found') }, { status: 404 })
    // La deconectare sau ștergere, campaniile Hontrio se șterg din Google Ads (Termeni, art. 14.5)?
    return NextResponse.json({ user: { ...user, leave_removes_campaigns: await leaveRuleFor(createAdminClient(), session.user.id) } })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    const userId = session.user.id

    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })

    const supabase = createAdminClient()
    const update: Record<string, unknown> = {}

    if (body.name !== undefined) {
      const name = checkName(body.name)
      if (!name.ok) return NextResponse.json({ error: t(name.error) }, { status: 400 })
      update.name = name.name
    }
    if (body.avatar_url !== undefined) {
      if (body.avatar_url !== null) return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
      update.avatar_url = null
    }
    if (body.preferences !== undefined) {
      const prefs = body.preferences as Record<string, unknown> | null
      if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
      const { data: current } = await supabase.from('users').select('preferences').eq('id', userId).maybeSingle()
      const merged: Record<string, unknown> = { ...((current?.preferences as Record<string, unknown> | null) ?? {}) }
      for (const key of USER_PREFERENCES) {
        if (prefs[key] === undefined) continue
        if (typeof prefs[key] !== 'boolean') return NextResponse.json({ error: t('api.invalid_request') }, { status: 400 })
        merged[key] = prefs[key]
      }
      update.preferences = merged
    }

    if (!Object.keys(update).length) return NextResponse.json({ error: t('api.nothing_to_save') }, { status: 400 })
    update.updated_at = new Date().toISOString()

    const { data: user, error } = await supabase
      .from('users')
      .update(update)
      .eq('id', userId)
      .select('id, name, email, avatar_url, role, preferences')
      .single()
    if (error) {
      logApiError(ROUTE, 500, 'Profilul n-a putut fi salvat', { userId, error: error.message })
      return NextResponse.json({ error: t('api.save_failed') }, { status: 500 })
    }
    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}
