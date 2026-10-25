import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitRegister, getClientIp } from '@/lib/security/rate-limit'
import { sendEmail, buildWelcomeEmail } from '@/lib/email'
import { getLocale, tFor } from '@/lib/i18n/server'

export async function POST(request: Request) {
  // Limba cererii: și pentru mesajele de aici, și pentru e-mailul de bun venit
  const locale = await getLocale()
  const t = tFor(locale)
  try {
    // Rate limit by IP
    const ip = getClientIp(request)
    const limit = await rateLimitRegister(ip)
    if (!limit.success) {
      return NextResponse.json(
        { error: t('api.too_many_attempts') },
        { status: 429 }
      )
    }

    const { name, email, password } = await request.json()

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: t('api.fields_required') },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: t('api.password_too_short') },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      console.error('Supabase auth error:', authError.message, authError.status, authError.code)
      // Anti user enumeration: generic message for duplicate email
      if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
        return NextResponse.json(
          { error: t('api.email_taken') },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: t('api.account_create_failed', { detail: authError.message }) },
        { status: 500 }
      )
    }



    const { error: profileError } = await supabase.from('users').insert({
      id: authData.user.id,
      email: authData.user.email!,
      name,
      role: 'user',
      credits: 20,
      plan: 'free',
      onboarding_completed: false,
    })

    if (profileError) {
      console.error('Profile insert error:', profileError.message, profileError.code, profileError.details)
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: t('api.profile_create_failed', { detail: profileError.message }) },
        { status: 500 }
      )
    }

    // Send welcome email (async — don't block response)
    sendEmail({
      to: email,
      ...buildWelcomeEmail(name, locale),
    }).catch(err => console.error('[Register] Welcome email error:', err))

    return NextResponse.json(
      { message: t('api.account_created') },
      { status: 201 }
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json(
      { error: t('api.internal_error') },
      { status: 500 }
    )
  }
}