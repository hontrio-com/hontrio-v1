import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'
import { translateStored } from '@/lib/i18n/stored'

export async function GET() {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    }

    const supabase = createAdminClient()
    const userId = (session.user as any).id

    // Ia balanta
    const { data: user } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single()

    // Ia istoricul
    const { data: transactions } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json({
      balance: user?.credits || 0,
      // Descrierile salvate ca chei de traducere, în limba celui care se uită
      transactions: (transactions || []).map(tx => ({ ...tx, description: translateStored(t, tx.description) })),
    })
  } catch {
    return NextResponse.json({ error: t('api.internal_error') }, { status: 500 })
  }
}