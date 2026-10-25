import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/client'
import { getT } from '@/lib/i18n/server'

export async function POST() {
  const t = await getT()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: t('api.unauthorized') }, { status: 401 })
    }

    const userId = (session.user as any).id
    const supabase = createAdminClient()

    const { data: user } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single()

    if (!user?.stripe_customer_id) {
      return NextResponse.json({ error: t('api.no_active_subscription') }, { status: 400 })
    }

    // Create a billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.NEXTAUTH_URL}/credits`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error: any) {
    console.error('Stripe portal error:', error)
    return NextResponse.json(
      { error: error.message || t('api.internal_error') },
      { status: 500 }
    )
  }
}