import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, getClientIp } from '@/lib/security/rate-limit'

export async function POST(request: Request) {
  try {
    // Rate limit: 3 attempts per 15 min per IP
    const ip = getClientIp(request)
    const limit = rateLimit(`forgot:${ip}`, 3, 15 * 60 * 1000)
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Prea multe cereri. Încearcă din nou mai târziu.' },
        { status: 429 }
      )
    }

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email-ul este obligatoriu' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single()

    // Always return same response (anti user enumeration)
    if (user) {
      // TODO: Generate reset token, save hashed to DB, send email
      // Token: crypto.randomUUID(), expires in 30 min, one-time use
    }

    return NextResponse.json({
      success: true,
      message: 'Dacă acest email există în sistem, vei primi instrucțiunile de resetare.',
    })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}