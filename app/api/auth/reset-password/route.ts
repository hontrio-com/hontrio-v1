import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, getClientIp } from '@/lib/security/rate-limit'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const limit = rateLimit(`reset:${ip}`, 5, 15 * 60 * 1000)
    if (!limit.success) {
      return NextResponse.json({ error: 'Prea multe incercari.' }, { status: 429 })
    }

    const { token, email, password } = await request.json()

    if (!token || !email || !password) {
      return NextResponse.json({ error: 'Parametri lipsa' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Parola trebuie sa aiba minim 6 caractere' }, { status: 400 })
    }

    if (password.length > 128) {
      return NextResponse.json({ error: 'Parola e prea lunga' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const cleanEmail = email.trim().toLowerCase()
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    // Find user in our table
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'Link invalid sau expirat' }, { status: 400 })
    }

    // Find valid token
    const { data: resetToken } = await supabase
      .from('password_reset_tokens')
      .select('id, expires_at')
      .eq('user_id', user.id)
      .eq('token_hash', tokenHash)
      .single()

    if (!resetToken) {
      return NextResponse.json({ error: 'Link invalid sau expirat' }, { status: 400 })
    }

    // Check expiration
    if (new Date(resetToken.expires_at) < new Date()) {
      await supabase.from('password_reset_tokens').delete().eq('id', resetToken.id)
      return NextResponse.json({ error: 'Linkul a expirat. Solicita un nou link de resetare.' }, { status: 400 })
    }

    // FIX: Folosim user.id direct (din tabela users, care e identic cu auth.users.id)
    // Eliminat listUsers() full scan — nu e necesar deoarece users.id = auth.users.id
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password,
    })

    if (updateError) {
      console.error('[Reset Password] Update error:', updateError.message)
      return NextResponse.json({ error: 'Eroare la actualizarea parolei' }, { status: 500 })
    }

    console.log('[Reset Password] Password updated for:', cleanEmail, 'user_id:', user.id)

    // Delete all reset tokens for this user (one-time use)
    await supabase.from('password_reset_tokens').delete().eq('user_id', user.id)

    return NextResponse.json({ success: true, message: 'Parola a fost resetata cu succes' })
  } catch (err) {
    console.error('[Reset Password]', err)
    return NextResponse.json({ error: 'Eroare interna' }, { status: 500 })
  }
}