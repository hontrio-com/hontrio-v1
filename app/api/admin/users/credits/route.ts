import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
    }

    const { user_id, amount, action = 'add' } = await req.json()

    if (!user_id || !amount || isNaN(parseInt(amount))) {
      return NextResponse.json({ error: 'user_id și amount sunt obligatorii' }, { status: 400 })
    }

    const creditAmount = parseInt(amount)
    if (creditAmount <= 0 || creditAmount > 100000) {
      return NextResponse.json({ error: 'Suma trebuie să fie între 1 și 100.000' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get current user credits
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, email, credits, name')
      .eq('id', user_id)
      .single()

    if (userErr || !user) {
      return NextResponse.json({ error: 'Utilizatorul nu a fost găsit' }, { status: 404 })
    }

    let newBalance: number
    let transactionType: string
    let description: string

    if (action === 'add') {
      newBalance = user.credits + creditAmount
      transactionType = 'bonus'
      description = `Admin: +${creditAmount} credite adăugate de ${(session.user as any).email}`
    } else if (action === 'remove') {
      newBalance = Math.max(0, user.credits - creditAmount)
      transactionType = 'usage'
      description = `Admin: -${creditAmount} credite retrase de ${(session.user as any).email}`
    } else {
      return NextResponse.json({ error: 'Acțiune invalidă (add/remove)' }, { status: 400 })
    }

    // Update credits
    const { error: updateErr } = await supabase
      .from('users')
      .update({ credits: newBalance })
      .eq('id', user_id)

    if (updateErr) {
      return NextResponse.json({ error: 'Eroare la actualizarea creditelor' }, { status: 500 })
    }

    // Log transaction
    await supabase.from('credit_transactions').insert({
      user_id,
      type: transactionType,
      amount: action === 'add' ? creditAmount : -creditAmount,
      balance_after: newBalance,
      description,
      reference_type: 'admin_adjustment',
    })

    return NextResponse.json({
      success: true,
      user_id,
      previous_credits: user.credits,
      new_credits: newBalance,
      action,
      amount: creditAmount,
    })
  } catch (err: any) {
    console.error('[Admin Credits]', err)
    return NextResponse.json({ error: err.message || 'Eroare internă' }, { status: 500 })
  }
}
