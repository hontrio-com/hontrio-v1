import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitExpensive } from '@/lib/security/rate-limit'
import { getT } from '@/lib/i18n/server'

export async function POST(request: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Rate limit: max 5 password changes per hour
    const limit = await rateLimitExpensive(userId, 'change-password')
    if (!limit.success) {
      return NextResponse.json({ error: t('api.too_many_attempts') }, { status: 429 })
    }

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: t('api.fields_required') }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: t('api.password_too_short') }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify current password by trying to sign in
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single()

    if (!user) {
      return NextResponse.json({ error: t('api.user_not_found') }, { status: 404 })
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (signInError) {
      return NextResponse.json({ error: t('api.current_password_wrong') }, { status: 400 })
    }

    // Update password using admin client
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (updateError) {
      console.error('Password update error:', updateError)
      return NextResponse.json({ error: t('api.password_update_failed') }, { status: 500 })
    }

    return NextResponse.json({ message: t('api.password_changed') })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}