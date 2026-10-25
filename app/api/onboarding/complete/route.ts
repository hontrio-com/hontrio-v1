import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitExpensive } from '@/lib/security/rate-limit'
import { sanitizeText } from '@/lib/security/validate-url'
import { getT } from '@/lib/i18n/server'

// =============================================
// POST /api/onboarding/complete — marchează onboarding-ul ca terminat.
// Planul și creditele nu se ating aici: contul le primește la înregistrare,
// iar planurile plătite vin doar prin Stripe.
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
      .select('onboarding_completed')
      .eq('id', userId)
      .single()

    if (user?.onboarding_completed) {
      return NextResponse.json({ error: t('api.onboarding_already_done') }, { status: 400 })
    }

    // Sanitize & validate business info
    const updateData: Record<string, unknown> = {
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    }

    if (body.businessName) {
      updateData.business_name = sanitizeText(body.businessName, 100)
    }
    if (body.website) {
      updateData.website = sanitizeText(body.website, 200)
    }
    if (body.niche) {
      updateData.niche = sanitizeText(body.niche, 100)
    }
    if (body.tone && ['professional', 'friendly', 'luxury', 'casual'].includes(body.tone)) {
      updateData.brand_tone = body.tone
    }
    if (body.language && ['ro', 'en', 'de', 'fr', 'hu', 'bg'].includes(body.language)) {
      updateData.brand_language = body.language
    }
    if (body.country) {
      updateData.preferences = { country: sanitizeText(body.country, 50) }
    }

    // GDPR consent timestamp
    if (body.gdprConsent) {
      updateData.preferences = {
        ...(updateData.preferences || {}),
        gdpr_consent_at: new Date().toISOString(),
      }
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