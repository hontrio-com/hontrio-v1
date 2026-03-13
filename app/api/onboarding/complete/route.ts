import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitExpensive } from '@/lib/security/rate-limit'
import { sanitizeText } from '@/lib/security/validate-url'

// Valid plans that can be selected during onboarding
const VALID_PLANS = ['free', 'starter', 'professional', 'enterprise']
const PLAN_CREDITS: Record<string, number> = {
  free: 20,
  starter: 200,
  professional: 500,
  enterprise: 2000,
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Rate limit
    const rl = await rateLimitExpensive(userId, 'onboarding-complete')
    if (!rl.success) {
      return NextResponse.json({ error: 'Prea multe încercări' }, { status: 429 })
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
      return NextResponse.json({ error: 'Onboarding-ul a fost deja finalizat' }, { status: 400 })
    }

    // Sanitize & validate business info
    const updateData: Record<string, any> = {
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

    // Validate plan server-side — ONLY free is auto-applied
    // Paid plans require Stripe payment confirmation via webhook
    if (body.selectedPlan && VALID_PLANS.includes(body.selectedPlan)) {
      if (body.selectedPlan === 'free') {
        updateData.plan = 'free'
        updateData.credits = 20
      }
      // For paid plans: don't set plan here, require Stripe webhook
      // Just store the intent for the billing page
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
      return NextResponse.json({ error: 'Eroare la salvare' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}