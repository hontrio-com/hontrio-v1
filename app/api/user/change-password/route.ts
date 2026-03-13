import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitExpensive } from '@/lib/security/rate-limit'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
    }

    const userId = (session.user as any).id

    // Rate limit: max 5 password changes per hour
    const limit = await rateLimitExpensive(userId, 'change-password')
    if (!limit.success) {
      return NextResponse.json({ error: 'Prea multe încercări. Așteaptă câteva minute.' }, { status: 429 })
    }

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Completează toate câmpurile' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Parola nouă trebuie să aibă minim 6 caractere' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify current password by trying to sign in
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'Utilizator negăsit' }, { status: 404 })
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (signInError) {
      return NextResponse.json({ error: 'Parola curentă este incorectă' }, { status: 400 })
    }

    // Update password using admin client
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (updateError) {
      console.error('Password update error:', updateError)
      return NextResponse.json({ error: 'Eroare la actualizarea parolei' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Parola a fost schimbată cu succes!' })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}