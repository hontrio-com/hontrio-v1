import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitExpensive } from '@/lib/security/rate-limit'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/onboarding/complete — marchează onboarding-ul ca terminat și
// păstrează când și-a dat omul acordul (GDPR).
// =============================================

export async function POST(request: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    }

    const userId = session.user.id

    // Rate limit
    const rl = await rateLimitExpensive(userId, 'onboarding-complete')
    if (!rl.success) {
      return NextResponse.json({ error: t('api.too_many_attempts') }, { status: 429 })
    }

    const body = await request.json()
    const supabase = createAdminClient()

    // Check if already completed
    const { data: user } = await supabase
      .from('users')
      .select('onboarding_completed, preferences')
      .eq('id', userId)
      .single()

    if (user?.onboarding_completed) {
      return NextResponse.json({ error: t('api.onboarding_already_done') }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    }

    // Momentul acordului GDPR, adăugat la preferințele existente (ex. emailurile pilotului)
    if (body.gdprConsent) {
      const current = user?.preferences && typeof user.preferences === 'object' ? user.preferences as Record<string, unknown> : {}
      updateData.preferences = { ...current, gdpr_consent_at: new Date().toISOString() }
    }

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)

    if (error) {
      return NextResponse.json({ error: t('api.save_failed') }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}