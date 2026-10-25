import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'
import { storedMessage } from '@/lib/i18n/stored'

export async function POST(req: Request) {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: t('api.forbidden') }, { status: 403 })
    }

    const { user_id, amount, reason } = await req.json()

    if (!user_id || amount === undefined || amount === null || isNaN(parseInt(amount))) {
      return NextResponse.json({ error: t('api.credits_fields_required') }, { status: 400 })
    }

    const rawAmount = parseInt(amount)
    if (rawAmount === 0 || Math.abs(rawAmount) > 100000) {
      return NextResponse.json({ error: t('api.credits_amount_range') }, { status: 400 })
    }

    // Positive amount = add, negative amount = remove
    const action = rawAmount >= 0 ? 'add' : 'remove'
    const creditAmount = Math.abs(rawAmount)

    const supabase = createAdminClient()

    // Get current user credits
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, email, credits, name')
      .eq('id', user_id)
      .single()

    if (userErr || !user) {
      return NextResponse.json({ error: t('api.user_not_found') }, { status: 404 })
    }

    let newBalance: number
    let transactionType: string
    let description: string

    // Descrierea se salvează ca cheie de traducere (o vede omul în limba lui); motivul scris de admin rămâne ca atare
    if (action === 'add') {
      newBalance = user.credits + creditAmount
      transactionType = 'bonus'
      description = reason || storedMessage('api.tx_admin_added', { count: creditAmount, admin: (session.user as any).email })
    } else {
      newBalance = Math.max(0, user.credits - creditAmount)
      transactionType = 'usage'
      description = reason || storedMessage('api.tx_admin_removed', { count: creditAmount, admin: (session.user as any).email })
    }

    // Update credits
    const { error: updateErr } = await supabase
      .from('users')
      .update({ credits: newBalance })
      .eq('id', user_id)

    if (updateErr) {
      return NextResponse.json({ error: t('api.credits_update_failed') }, { status: 500 })
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
    return NextResponse.json({ error: err.message || t('api.internal_error') }, { status: 500 })
  }
}
