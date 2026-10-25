import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, getClientIp } from '@/lib/security/rate-limit'
import { sendEmail, buildResetEmail } from '@/lib/email'
import crypto from 'crypto'
import { getLocale, tFor } from '@/lib/i18n/server'

export async function POST(request: Request) {
  // Limba cererii: și pentru mesajele de aici, și pentru e-mailul de resetare
  const locale = await getLocale()
  const t = tFor(locale)
  try {
    // Rate limit: 3 attempts per 15 min per IP
    const ip = getClientIp(request)
    const limit = rateLimit(`forgot:${ip}`, 3, 15 * 60 * 1000)
    if (!limit.success) {
      return NextResponse.json(
        { error: t('api.too_many_attempts') },
        { status: 429 }
      )
    }

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: t('api.email_required') }, { status: 400 })
    }

    const supabase = createAdminClient()
    const cleanEmail = email.trim().toLowerCase()

    const { data: user } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', cleanEmail)
      .maybeSingle()

    // Always return same response (anti user enumeration)
    if (user) {
      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min

      // Delete old tokens for this user
      await supabase
        .from('password_reset_tokens')
        .delete()
        .eq('user_id', user.id)

      // Save hashed token to DB
      await supabase
        .from('password_reset_tokens')
        .insert({
          user_id: user.id,
          token_hash: tokenHash,
          expires_at: expiresAt,
        })

      // Build reset URL with raw token (not hash)
      const appUrl = process.env.NEXTAUTH_URL || 'https://hontrio.com'
      const resetUrl = `${appUrl}/reset-password?token=${token}&email=${encodeURIComponent(cleanEmail)}`

      // Send email
      await sendEmail({
        to: cleanEmail,
        ...buildResetEmail(resetUrl, locale),
      })
    }

    return NextResponse.json({
      success: true,
      message: t('api.reset_email_sent'),
    })
  } catch (err) {
    console.error('[Forgot Password]', err)
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}