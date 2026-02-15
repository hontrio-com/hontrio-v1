import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email-ul este obligatoriu' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Check if user exists
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single()

    // Always return success (don't reveal if email exists)
    // In production, you would send an actual email here
    // For now, we just simulate it

    if (user) {
      // TODO: Generate reset token, save to DB, send email
      // For now, log it
      console.log(`Password reset requested for: ${email}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Dacă acest email există în sistem, vei primi instrucțiunile de resetare.',
    })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}