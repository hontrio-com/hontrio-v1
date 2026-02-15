import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const { user_id, amount, reason } = await request.json()

    if (!user_id || amount === undefined || amount === 0) {
      return NextResponse.json({ error: 'Date incomplete' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get current user credits
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('credits')
      .eq('id', user_id)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'Utilizatorul nu a fost găsit' }, { status: 404 })
    }

    const newBalance = Math.max(0, user.credits + amount)

    // Update credits
    const { error: updateError } = await supabase
      .from('users')
      .update({ credits: newBalance })
      .eq('id', user_id)

    if (updateError) {
      return NextResponse.json({ error: 'Eroare la actualizarea creditelor' }, { status: 500 })
    }

    // Log transaction
    await supabase.from('credit_transactions').insert({
      user_id,
      type: amount > 0 ? 'bonus' : 'usage',
      amount,
      balance_after: newBalance,
      description: reason || (amount > 0 ? 'Credite adăugate de admin' : 'Credite retrase de admin'),
      reference_type: 'admin_action',
    })

    return NextResponse.json({
      success: true,
      new_balance: newBalance,
    })
  } catch {
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 })
  }
}